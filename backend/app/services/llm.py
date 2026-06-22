import asyncio
import datetime
import hashlib
import json
import logging
import re
import time
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.services.prompt_config import PromptConfigService

import httpx

from app.core.config import GEMINI_API_KEY, GEMINI_MODEL
from app.core.redis_client import get_redis
from app.schemas.schemas import (
    AlimentoInterpretado,
    ChefChatResponse,
    ChefMensaje,
    ConsumoItem,
    DashboardUnifiedContext,
    DiaPlanComidas,
    FotoNeveraResponse,
    HabitoCompraItem,
    InterpretarDespensaResponse,
    InventarioAlimentoResponse,
    MemoriaGustosResponse,
    PerfilHogarResponse,
    PerfilIndividualResponse,
    PlanComidasResponse,
    RecetaHistorialResponse,
    RecetaMaestraResponse,
    RecetasSugeridasResponse,
    RecetaSugerida,
    SugerenciaMetadataResponse,
    TicketOcrResponse,
)

logger = logging.getLogger("app.llm")

if not GEMINI_API_KEY:
    logger.warning(
        "La variable de entorno GEMINI_API_KEY no está configurada. El servicio de LLM operará en modo de contingencia (fallback)."
    )

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# --- Caché TTL dual (Redis / memoria) ------------------------------------------
# Si Redis está disponible, la caché es distribuida y sobrevive a reinicios.
# Sin Redis, opera en memoria (comportamiento original, solo instancia única).
# La clave incluye un hash SHA-256 de los datos de entrada: cualquier cambio real
# invalida la entrada automáticamente.

# Fallback en memoria (solo se usa si Redis no está disponible)
_memory_cache: dict[str, tuple[float, Any]] = {}
_CACHE_MAX_ENTRIES = 1000

BRIEFING_CACHE_TTL = 30 * 60  # 30 minutos
RECETAS_CACHE_TTL = 60 * 60  # 1 hora


async def _cache_get(key: str) -> Any | None:
    """Obtiene un valor de la caché (Redis o memoria)."""
    redis = get_redis()
    if redis is not None:
        try:
            raw = await redis.get(f"cache:{key}")
            if raw is not None:
                return json.loads(raw)
        except Exception as e:
            logger.warning(f"Error leyendo caché de Redis ({e}); fallback a memoria.")

    # Fallback en memoria
    entry = _memory_cache.get(key)
    if entry is None:
        return None
    expires, value = entry
    if time.monotonic() > expires:
        del _memory_cache[key]
        return None
    return value


async def _cache_set(key: str, value: Any, ttl: float) -> None:
    """Guarda un valor en la caché (Redis y memoria)."""
    redis = get_redis()
    if redis is not None:
        try:
            serialized = json.dumps(value, default=_json_serialize)
            await redis.setex(f"cache:{key}", int(ttl), serialized)
            return
        except Exception as e:
            logger.warning(
                f"Error escribiendo caché en Redis ({e}); fallback a memoria."
            )

    # Fallback en memoria
    if len(_memory_cache) >= _CACHE_MAX_ENTRIES:
        now = time.monotonic()
        for k in [k for k, (exp, _) in _memory_cache.items() if exp < now]:
            del _memory_cache[k]
        if len(_memory_cache) >= _CACHE_MAX_ENTRIES:
            _memory_cache.clear()
    _memory_cache[key] = (time.monotonic() + ttl, value)


def _json_serialize(obj: Any) -> Any:
    """Serializador para objetos que json.dumps no soporta nativamente."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if isinstance(obj, datetime.date | datetime.datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _hash_key(prefix: str, data: str) -> str:
    return f"{prefix}:{hashlib.sha256(data.encode('utf-8')).hexdigest()}"


# --- Cliente HTTP compartido --------------------------------------------------
# Un único AsyncClient para todo el proceso: reutiliza conexiones (keep-alive) y
# evita el coste del handshake TLS en cada llamada. Se crea perezosamente y se
# cierra en el lifespan de la app (main.py) vía aclose_http_client().
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _http_client


async def aclose_http_client() -> None:
    """Cierra el cliente HTTP compartido. Llamado desde el shutdown del lifespan."""
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
    _http_client = None


# --- Llamada genérica a Gemini ------------------------------------------------

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 2  # 1 reintento ante fallos transitorios


async def _call_gemini(
    system_instruction: str,
    user_prompt: str = "",
    max_output_tokens: int = 400,
    response_schema: dict[str, Any] | None = None,
    timeout: float = 15.0,
    image_base64: str | None = None,
    contents: list[dict[str, Any]] | None = None,
) -> str | None:
    """Llamada a la API de Gemini con reintento acotado ante fallos transitorios.
    Devuelve el texto generado o None si falla definitivamente.
    thinkingBudget=0 desactiva el razonamiento interno del modelo: innecesario para
    estas tareas y reduce latencia y coste.
    Si se pasa `contents` (lista de turnos con rol), se usa para conversaciones
    multi-turno; si no, se construye un único turno a partir de `user_prompt`."""
    generation_config: dict[str, Any] = {
        "temperature": 0.0,
        "maxOutputTokens": max_output_tokens,
        "thinkingConfig": {"thinkingBudget": 0},
    }
    if response_schema is not None:
        generation_config["responseMimeType"] = "application/json"
        generation_config["responseSchema"] = response_schema

    if contents is None:
        parts: list[dict[str, Any]] = [{"text": user_prompt}]
        if image_base64:
            parts.append(
                {
                    "inlineData": {
                        # Se asume JPEG genérico; la API de Gemini es flexible,
                        # pero idealmente el frontend enviará JPEGs.
                        "mimeType": "image/jpeg",
                        "data": image_base64,
                    }
                }
            )
        contents = [{"parts": parts}]

    payload = {
        "contents": contents,
        "generationConfig": generation_config,
        "systemInstruction": {"parts": [{"text": system_instruction}]},
    }
    client = _get_http_client()

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            # La clave va en header x-goog-api-key (no en URL) para no exponerla en logs.
            response = await client.post(
                GEMINI_URL,
                json=payload,
                headers={"x-goog-api-key": GEMINI_API_KEY},
                timeout=timeout,
            )

            if response.status_code == 200:
                return _extract_text(response.json())

            # Reintentar solo ante errores transitorios y si quedan intentos
            if response.status_code in _RETRYABLE_STATUS and attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(0.6 * attempt)
                continue

            logger.error(
                f"La API de Gemini retornó un código de estado {response.status_code}. "
                f"Detalle: {response.text[:300]}"
            )
            return None

        except httpx.RequestError as e:
            if attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(0.6 * attempt)
                continue
            logger.error(
                f"Error de red/petición al conectar con la API de Gemini: {type(e).__name__}"
            )
            return None
        except Exception as e:
            logger.error(f"Error inesperado al llamar a la API de Gemini: {e}")
            return None

    return None


def _extract_text(data: dict[str, Any]) -> str | None:
    """Extrae el texto de la respuesta de Gemini, distinguiendo causas de fallo
    (bloqueo de seguridad, sin candidatos, truncado) para diagnóstico."""
    candidates = data.get("candidates") or []
    if not candidates:
        # Sin candidatos suele ser un bloqueo por filtros de seguridad del prompt.
        feedback = data.get("promptFeedback", {})
        logger.error(
            f"Gemini no devolvió candidatos (posible bloqueo de seguridad). promptFeedback={feedback}"
        )
        return None

    candidate = candidates[0]
    finish = candidate.get("finishReason")
    if finish and finish not in ("STOP", "MAX_TOKENS"):
        logger.error(f"Gemini terminó con finishReason inesperado: {finish}")
        return None

    parts = (candidate.get("content") or {}).get("parts") or []
    if not parts:
        logger.error(
            f"Gemini devolvió un candidato sin contenido (finishReason={finish})."
        )
        return None

    if finish == "MAX_TOKENS":
        logger.warning(
            "Gemini truncó la respuesta (MAX_TOKENS); puede invalidar el JSON estructurado."
        )

    texto = (parts[0].get("text") or "").strip()
    return texto or None


# --- Briefing matutino ----------------------------------------------------------


def generate_fallback_briefing(context: DashboardUnifiedContext) -> str:
    """Genera un resumen estático amigable del hogar en caso de fallo del LLM o ausencia de API Key."""
    logger.info("Generando briefing alternativo predefinido (fallback)...")

    lines = [
        "### ☀️ ¡Buenos días! 🏡",
        "No hemos podido conectar con el asistente de IA para redactar el informe personalizado, pero aquí tienes el estado de tu despensa:",
        "",
    ]

    # Despensa: alimentos próximos a caducar (núcleo de la app)
    lines.append("**🥫 Alertas de despensa:**")
    if context.alertas_despensa and context.alertas_despensa.alertas_caducidad:
        for a in context.alertas_despensa.alertas_caducidad:
            dias_cad = ""
            if a.fecha_caducidad:
                delta = a.fecha_caducidad - datetime.date.today()
                dias_cad = f" (caduca en {delta.days} día(s))"
            lines.append(f"- {a.nombre}: {a.cantidad} {a.unidad}{dias_cad}")
    else:
        lines.append("- No hay alertas de caducidad en el inventario.")

    return "\n".join(lines)


async def generate_morning_briefing(
    context: DashboardUnifiedContext,
) -> tuple[str, bool]:
    """Genera el resumen personalizado del hogar con Gemini, con caché TTL y
    fallback estático en caso de error de API o red.
    Devuelve (texto, generado_por_ia): el flag permite al cliente mostrar el
    aviso de transparencia de IA solo cuando el texto proviene del modelo."""
    if not GEMINI_API_KEY:
        return generate_fallback_briefing(context), False

    # El briefing solo maneja datos de despensa (nombres de alimentos), nunca
    # datos personales, por lo que no requiere anonimización.
    resumen_alimentos = [
        {
            "nombre": a.nombre,
            "cantidad": a.cantidad,
            "unidad": a.unidad,
            "fecha_caducidad": a.fecha_caducidad.isoformat()
            if a.fecha_caducidad
            else "",
        }
        for a in context.alertas_despensa.alertas_caducidad
    ]

    prompt_usuario = (
        f"Fecha: {context.fecha}\n"
        f"Alimentos que vencen pronto en despensa: {resumen_alimentos}\n"
    )

    # Caché: si la despensa no cambió, reutilizar el briefing reciente.
    cache_key = _hash_key("briefing", prompt_usuario)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return cached, True

    system_instruction = (
        _PERSONA_CHEF + "\n\n"
        "TAREA: da los buenos días al hogar con un mensaje conversacional (sin listas, "
        "viñetas ni asteriscos), en 2 párrafos cortos y fluidos separados por saltos de línea:\n"
        "1. Un saludo matutino cálido y apetitoso que invite a cocinar algo casero hoy.\n"
        "2. Una recomendación amable sobre qué alimentos de la despensa aprovechar pronto "
        "porque están a punto de caducar, sugiriendo de forma natural algún plato tradicional "
        "español para aprovecharlos.\n\n"
        "Restricciones críticas de seguridad e IA:\n"
        "- Sé extremadamente veraz y fiel a los datos proporcionados. Prohibido inventar alimentos.\n"
        "- Cocina mediterránea española tradicional y de aprovechamiento; nada de fusiones impropias.\n"
        "- NO uses NINGUNA marca de formato Markdown (ni *, ni -, ni #). Solo usa texto plano y puntos y aparte."
    )

    texto = await _call_gemini(
        system_instruction, prompt_usuario, max_output_tokens=400
    )
    if texto is None:
        return generate_fallback_briefing(context), False

    await _cache_set(cache_key, texto, BRIEFING_CACHE_TTL)
    return texto, True


# --- Sugerencias de recetas -----------------------------------------------------

_RECETAS_RESPONSE_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "titulo": {"type": "STRING"},
            "tiempo_min": {"type": "INTEGER"},
            "ingredientes_usados": {"type": "ARRAY", "items": {"type": "STRING"}},
            "pasos": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
        "required": ["titulo", "tiempo_min", "ingredientes_usados", "pasos"],
    },
}


# Filosofía gastronómica: restricción NO-NEGOCIABLE de prompts (ver CLAUDE.md).
# Debe inyectarse en generate_recipe_suggestions y generate_meal_plan, y sobrevivir
# cualquier refactorización de los prompts. No eliminar ni suavizar.
_FILOSOFIA_MEDITERRANEA = (
    "FILOSOFÍA GASTRONÓMICA (obligatoria e innegociable):\n"
    "- Cocina mediterránea española tradicional y de aprovechamiento.\n"
    "- Prioriza sofritos, ingredientes frescos y productos de temporada.\n"
    "- Platos caseros y honestos: guisos, potajes, arroces, tortillas, legumbres, "
    "verduras de temporada, pescado y carne a la plancha, sopas y cremas.\n"
    "- PROHIBIDO mezclar culturas culinarias de forma incorrecta o hacer fusiones "
    "impropias (p. ej. pasta con salsa teriyaki, paella con curry, gazpacho con "
    "leche de coco). Nada de fusiones asiáticas, americanas ni experimentales: "
    "únicamente tradición mediterránea española.\n"
)


# Persona del asistente: voz cálida y cercana, consistente en TODOS los flujos
# (briefing, recetas, plan, chat). Igual de innegociable que la filosofía: define
# QUIÉN es el chef y CÓMO habla. El nombre "Marce" es el valor por defecto y puede
# ajustarse desde el panel admin editando los prompts. No eliminar la identidad cálida.
_PERSONA_CHEF = (
    "IDENTIDAD Y TONO (cómo hablas SIEMPRE):\n"
    "- Eres Marce, el chef de confianza y amigo de este hogar. Hablas en primera "
    "persona, con cercanía y calidez, como un amigo que lleva años cocinando con ellos.\n"
    "- Tutea siempre. Si conoces el apodo del hogar o de la persona, úsalo con naturalidad.\n"
    "- Apóyate en lo que sabes de sus gustos, hábitos y de lo que han cocinado antes para "
    "que sientan que les conoces de verdad (p. ej. 'como te gustan los guisos de cuchara…', "
    "'el otro día te encantó la fabada…'). Si no tienes ese dato, NO lo inventes.\n"
    "- Tono natural, apetitoso y alentador; nunca acartonado ni robótico. Frases humanas y cercanas.\n"
)


def _bloque_perfil(perfil: PerfilHogarResponse | None) -> str:
    """Construye el bloque de personalización del prompt a partir del perfil del hogar.
    Cadena vacía si no hay perfil (el hogar no completó el onboarding). Se incluye en
    `prompt_usuario`, por lo que forma parte de la clave de caché: perfiles distintos
    obtienen sugerencias distintas."""
    if perfil is None:
        return ""
    lineas = []
    if perfil.gustos_culinarios:
        lineas.append(
            "Gustos del hogar (prioriza estos estilos cuando encajen con el inventario): "
            f"{', '.join(perfil.gustos_culinarios)}."
        )
    lineas.append(
        f"Número de comensales: {perfil.num_comensales} "
        "(ajusta las cantidades de las recetas a este número de personas)."
    )
    return "Perfil del hogar:\n" + "\n".join(lineas) + "\n"


def _bloque_memoria_gustos(memoria: MemoriaGustosResponse | None) -> str:
    """Inyecta la memoria de gustos destilada (resumen NL aprendido con el uso). Es la
    pieza que hace que el chef 'recuerde' al hogar. Tamaño acotado (resumen fijo) frente
    al historial creciente → controla el coste de tokens. Cadena vacía si no hay memoria."""
    if memoria is None or not memoria.resumen.strip():
        return ""
    return (
        "Lo que sabes de este hogar (úsalo con naturalidad para que sientan que les "
        "conoces; NO inventes nada que no esté aquí):\n"
        + memoria.resumen.strip()
        + "\n"
    )


def _bloque_historial(historial: list[RecetaHistorialResponse] | None) -> str:
    """Construye el bloque de historial de comportamiento para el prompt.
    Señales: 'me_encanto' refuerza ese estilo; cocinadas evitan repetición a corto plazo;
    rechazadas y 'no_me_gusto' se excluyen. La valoración pondera la señal."""
    if not historial:
        return ""
    encantaron = [h.nombre_receta for h in historial if h.valoracion == "me_encanto"]
    cocinadas = [h.nombre_receta for h in historial if h.accion == "cocinada"]
    rechazadas = [
        h.nombre_receta
        for h in historial
        if h.accion == "rechazada" or h.valoracion == "no_me_gusto"
    ]
    lineas = []
    if encantaron:
        lineas.append(
            "Recetas que le ENCANTARON (sugiere platos en esa misma línea/estilo): "
            f"{', '.join(encantaron[:10])}."
        )
    if cocinadas:
        lineas.append(
            "Recetas cocinadas recientemente (evita repetirlas a menos que hayan pasado varios días): "
            f"{', '.join(cocinadas[:10])}."
        )
    if rechazadas:
        lineas.append(
            "Recetas rechazadas o que NO le gustaron (NO sugerir bajo ningún concepto): "
            f"{', '.join(rechazadas[:10])}."
        )
    if not lineas:
        return ""
    return "Historial del hogar:\n" + "\n".join(lineas) + "\n"


def _bloque_perfiles_individuales(
    perfiles: list[PerfilIndividualResponse] | None,
) -> str:
    """Construye el bloque de perfiles individuales para el prompt.
    Solo preferencias culinarias — nunca datos médicos."""
    if not perfiles:
        return ""
    lineas = []
    for p in perfiles:
        partes = [f"- {p.nombre}:"]
        if p.preferencias_dieta:
            partes.append(f"dieta ({', '.join(p.preferencias_dieta)})")
        if p.excluir_ingredientes:
            partes.append(f"evita ({', '.join(p.excluir_ingredientes)})")
        if len(partes) > 1:
            lineas.append(" ".join(partes))
    if not lineas:
        return ""
    return (
        "Preferencias culinarias de los miembros del hogar "
        "(respétalas en TODAS las recetas):\n" + "\n".join(lineas) + "\n"
    )


def _bloque_recetario(recetario: list[RecetaMaestraResponse] | None) -> str:
    """Construye el bloque de referencia del recetario maestro para el prompt.
    Cadena vacía si el catálogo está vacío: sin impacto en el comportamiento actual."""
    if not recetario:
        return ""
    lineas = []
    for r in recetario[:15]:
        etiqueta = " [aprovechamiento]" if r.aprovechamiento else ""
        ingredientes_clave = ", ".join(r.ingredientes[:8])
        lineas.append(f"- {r.nombre}{etiqueta}: {ingredientes_clave}")
    return (
        "Recetario de referencia del hogar (inspírate en estas recetas mediterráneas, "
        "adapta con el inventario disponible):\n" + "\n".join(lineas) + "\n"
    )


_DISTILL_SYSTEM = (
    "Eres un analista de preferencias gastronómicas. A partir de los datos del hogar "
    "(perfil, miembros, historial de recetas cocinadas/valoradas/rechazadas y hábitos de "
    "compra/consumo), redacta un RESUMEN breve en español (máximo 120 palabras, en 2ª "
    "persona, dirigido al hogar) de sus gustos y hábitos APRENDIDOS: estilos que disfruta, "
    "ingredientes/platos favoritos, lo que evita o no le gusta, QUÉ SUELE COMPRAR y a qué "
    "ritmo, y patrones (p. ej. cocina rápida entre semana).\n"
    "Reglas: básate SOLO en los datos dados; no inventes. Solo gustos gastronómicos, NUNCA "
    "datos de salud. Texto plano, sin listas ni markdown. Si no hay datos suficientes, "
    "devuelve una cadena vacía."
)


def _bloque_habitos(
    habitos: list[HabitoCompraItem] | None,
    consumo: list[ConsumoItem] | None,
) -> str:
    """Bloque compacto de hábitos de compra/consumo derivados del ledger de movimientos.
    Permite a la destilación aprender QUÉ suele comprar el hogar y a qué ritmo."""
    lineas = []
    if habitos:
        partes = []
        for h in habitos[:15]:
            extra = ""
            if h.intervalo_medio_dias:
                extra = f" (cada ~{h.intervalo_medio_dias:.0f} días)"
            partes.append(f"{h.nombre} x{h.veces}{extra}")
        lineas.append("Suele comprar: " + ", ".join(partes) + ".")
    if consumo:
        top = ", ".join(f"{c.nombre} x{c.veces}" for c in consumo[:15])
        lineas.append("Suele consumir/gastar: " + top + ".")
    if not lineas:
        return ""
    return "Hábitos de compra y consumo del hogar:\n" + "\n".join(lineas) + "\n"


async def distill_taste_memory(
    perfil: PerfilHogarResponse | None = None,
    perfiles_individuales: list[PerfilIndividualResponse] | None = None,
    historial: list[RecetaHistorialResponse] | None = None,
    habitos: list[HabitoCompraItem] | None = None,
    consumo: list[ConsumoItem] | None = None,
) -> str | None:
    """Destila los datos del hogar en un resumen NL corto de sus gustos y hábitos
    aprendidos. Es la base de la 'memoria' que hace que el chef parezca conocer al hogar.
    Llamada Gemini barata (temp 0); None si no hay API key, fallo o datos insuficientes."""
    if not GEMINI_API_KEY:
        return None

    datos = (
        _bloque_perfil(perfil)
        + _bloque_perfiles_individuales(perfiles_individuales)
        + _bloque_historial(historial)
        + _bloque_habitos(habitos, consumo)
    )
    if not datos.strip():
        return None

    texto = await _call_gemini(
        _DISTILL_SYSTEM,
        f"Datos del hogar:\n{datos}",
        max_output_tokens=300,
    )
    if texto is None:
        return None
    return texto.strip() or None


_DEFAULT_RECETAS = (
    "Eres el chef asistente de un hogar en España. A partir del inventario real de la "
    "despensa, sugiere entre 1 y 3 recetas caseras sencillas en español.\n"
    "Reglas estrictas:\n"
    "- Usa únicamente ingredientes del inventario proporcionado (más básicos universales: agua, sal, aceite, pimienta).\n"
    "- Prioriza recetas que aprovechen los alimentos que caducan pronto.\n"
    "- 'ingredientes_usados' solo puede contener nombres que aparezcan en el inventario.\n"
    "- 'pasos': máximo 5 pasos breves por receta.\n"
    "- 'tiempo_min': tiempo realista de preparación en minutos.\n"
    "- Si el inventario es insuficiente para una receta digna, devuelve un array vacío []."
)


async def generate_recipe_suggestions(
    items: list[InventarioAlimentoResponse],
    alertas_caducidad: list[InventarioAlimentoResponse],
    perfil: PerfilHogarResponse | None = None,
    historial: list[RecetaHistorialResponse] | None = None,
    prompt_config: "PromptConfigService | None" = None,
    perfiles_individuales: list[PerfilIndividualResponse] | None = None,
    recetario: list[RecetaMaestraResponse] | None = None,
    memoria: MemoriaGustosResponse | None = None,
) -> RecetasSugeridasResponse:
    """Sugiere hasta 3 recetas a partir de la despensa del hogar, priorizando los
    alimentos a punto de caducar. IA pasiva: solo sugiere, nunca modifica datos."""
    if not items:
        return RecetasSugeridasResponse(
            recetas=[],
            generado_por_ia=False,
            mensaje="Añade alimentos a tu despensa para recibir sugerencias de recetas.",
        )

    if not GEMINI_API_KEY:
        return RecetasSugeridasResponse(
            recetas=[],
            generado_por_ia=False,
            mensaje="El asistente de IA no está disponible en este momento.",
        )

    nombres_caducan = sorted({a.nombre for a in alertas_caducidad})
    inventario = sorted(f"{i.nombre} ({i.cantidad} {i.unidad})" for i in items)

    prompt_usuario = (
        f"Inventario disponible en la despensa: {inventario}\n"
        f"Alimentos que caducan pronto (priorízalos): {nombres_caducan or 'ninguno'}\n"
        f"{_bloque_memoria_gustos(memoria)}"
        f"{_bloque_perfil(perfil)}"
        f"{_bloque_historial(historial)}"
        f"{_bloque_perfiles_individuales(perfiles_individuales)}"
        f"{_bloque_recetario(recetario)}"
    )

    cache_key = _hash_key("recetas", prompt_usuario)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return RecetasSugeridasResponse.model_validate(cached)

    if prompt_config is not None:
        system_instruction = await prompt_config.get_system_instruction(
            "recetas", _DEFAULT_RECETAS
        )
    else:
        system_instruction = (
            _PERSONA_CHEF + "\n\n" + _DEFAULT_RECETAS + "\n\n" + _FILOSOFIA_MEDITERRANEA
        )

    texto = await _call_gemini(
        system_instruction,
        prompt_usuario,
        max_output_tokens=1500,
        response_schema=_RECETAS_RESPONSE_SCHEMA,
    )

    if texto is None:
        return RecetasSugeridasResponse(
            recetas=[],
            generado_por_ia=False,
            mensaje="No se pudieron generar sugerencias en este momento. Inténtalo más tarde.",
        )

    try:
        recetas_raw = json.loads(texto)
        recetas = [RecetaSugerida.model_validate(r) for r in recetas_raw][:3]
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(
            f"La respuesta de recetas de Gemini no es un JSON válido según el esquema: {e}"
        )
        return RecetasSugeridasResponse(
            recetas=[],
            generado_por_ia=False,
            mensaje="No se pudieron generar sugerencias en este momento. Inténtalo más tarde.",
        )

    respuesta = RecetasSugeridasResponse(
        recetas=recetas,
        generado_por_ia=True,
        mensaje=None
        if recetas
        else "La despensa actual no da para una receta completa. ¡Añade más ingredientes!",
    )
    await _cache_set(cache_key, respuesta, RECETAS_CACHE_TTL)
    return respuesta


# --- Interpretación de despensa en lenguaje natural (multi-item) -----------------

_DESPENSA_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "interpretable": {"type": "BOOLEAN"},
        "alimentos": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "nombre": {"type": "STRING"},
                    "cantidad": {"type": "NUMBER"},
                    "unidad": {"type": "STRING"},
                    "categoria": {"type": "STRING"},
                    "fecha_caducidad": {"type": "STRING"},
                },
                "required": ["nombre", "cantidad", "unidad", "categoria"],
            },
        },
    },
    "required": ["interpretable", "alimentos"],
}

_MENSAJE_DESPENSA_NO_INTERPRETABLE = (
    "No he podido identificar productos en esa frase. "
    "Prueba con algo como: 'compré 6 huevos y un litro de leche que caduca el viernes'."
)


_MAX_USER_TEXT_LEN = 600


def _sanitize_user_text(texto: str, max_len: int = _MAX_USER_TEXT_LEN) -> str:
    """Saneo defensivo del texto libre del usuario antes de enviarlo a Gemini.

    Acota la longitud y neutraliza secuencias de control habituales en intentos de
    prompt injection (delimitadores de bloque ```, llaves de plantilla {{ }}, y
    rachas largas de saltos de línea tipo 'IGNORA LO ANTERIOR\\n\\n...'). La salida
    estructurada (responseSchema, temperatura 0) ya limita lo que el modelo puede
    devolver; esto es defensa en profundidad, no la única barrera.
    """
    limpio = texto.strip()[:max_len]
    limpio = limpio.replace("`", "'").replace("{{", "{ {").replace("}}", "} }")
    limpio = re.sub(r"\n{3,}", "\n\n", limpio)
    return limpio


async def interpret_pantry_text(
    texto: str, fecha_referencia: datetime.date
) -> InterpretarDespensaResponse:
    """Extrae uno o varios productos de despensa de una frase en lenguaje natural.
    IA pasiva: devuelve propuestas; el usuario las confirma antes de añadirlas."""
    if not GEMINI_API_KEY:
        return InterpretarDespensaResponse(
            alimentos=[],
            mensaje="El asistente de IA no está disponible. Usa el formulario de producto.",
        )

    system_instruction = (
        "Eres el asistente de despensa de un hogar en España. Extrae de la frase del usuario los "
        "productos de alimentación con su cantidad.\n"
        f"Fecha actual de referencia: {fecha_referencia.isoformat()}\n"
        "Reglas estrictas:\n"
        "- Un objeto por producto distinto mencionado.\n"
        "- 'cantidad': número (si no se indica, 1).\n"
        "- 'unidad': unidad mencionada (litros, kg, unidades...); si no se indica, 'unidades'.\n"
        "- 'categoria': clasifícalo (Lácteos, Carnes, Frutas, Verduras, Bebidas, Despensa...).\n"
        "- 'fecha_caducidad': formato ISO YYYY-MM-DD resolviendo expresiones relativas ('el viernes', 'en 3 días') respecto a la fecha de referencia; cadena vacía si no se menciona.\n"
        "- Si la frase NO menciona productos de despensa, devuelve interpretable=false y alimentos=[]."
    )

    texto_llm = await _call_gemini(
        system_instruction,
        _sanitize_user_text(texto),
        max_output_tokens=600,
        response_schema=_DESPENSA_RESPONSE_SCHEMA,
    )
    if texto_llm is None:
        return InterpretarDespensaResponse(
            alimentos=[],
            mensaje="No se pudo contactar con el asistente de IA. Inténtalo de nuevo o usa el formulario.",
        )

    try:
        data = json.loads(texto_llm)
        if not data.get("interpretable"):
            return InterpretarDespensaResponse(
                alimentos=[], mensaje=_MENSAJE_DESPENSA_NO_INTERPRETABLE
            )
        alimentos: list[AlimentoInterpretado] = []
        for a in data.get("alimentos", []):
            nombre = (a.get("nombre") or "").strip()
            if not nombre:
                continue
            try:
                cantidad = float(a.get("cantidad") or 1)
            except (TypeError, ValueError):
                cantidad = 1.0
            if cantidad <= 0:
                cantidad = 1.0
            fc_raw = (a.get("fecha_caducidad") or "").strip()
            try:
                fecha_caducidad = (
                    datetime.date.fromisoformat(fc_raw) if fc_raw else None
                )
            except ValueError:
                fecha_caducidad = None
            alimentos.append(
                AlimentoInterpretado(
                    nombre=nombre,
                    cantidad=cantidad,
                    unidad=(a.get("unidad") or "unidades").strip() or "unidades",
                    categoria=(a.get("categoria") or "Despensa").strip() or "Despensa",
                    fecha_caducidad=fecha_caducidad,
                )
            )
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.error(
            f"La respuesta de interpretación de despensa de Gemini no es válida: {e}"
        )
        return InterpretarDespensaResponse(
            alimentos=[], mensaje=_MENSAJE_DESPENSA_NO_INTERPRETABLE
        )

    if not alimentos:
        return InterpretarDespensaResponse(
            alimentos=[], mensaje=_MENSAJE_DESPENSA_NO_INTERPRETABLE
        )
    return InterpretarDespensaResponse(alimentos=alimentos, mensaje=None)


async def interpret_pantry_audio(
    texto: str, fecha_referencia: datetime.date
) -> InterpretarDespensaResponse:
    """Interpreta texto dictado por voz para extraer productos de despensa.

    El texto llega transcrito por el STT nativo del dispositivo (teclado iOS/Android
    u otro motor). Puede contener muletillas, falsos comienzos y lenguaje coloquial
    ('pues mira, compré como seis huevos y leche'). Delega en interpret_pantry_text
    que ya maneja este lenguaje informal; el endpoint propio permite rate limit
    independiente y trazabilidad por canal de entrada."""
    return await interpret_pantry_text(texto, fecha_referencia)


# --- Sugerencia de metadatos de alimento (categoría + caducidad estimada) -------

_METADATA_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "categoria": {"type": "STRING"},
        "dias_estimados": {"type": "INTEGER"},
    },
    "required": ["categoria", "dias_estimados"],
}


async def suggest_food_metadata(
    nombre: str, fecha_referencia: datetime.date
) -> SugerenciaMetadataResponse:
    """Sugiere categoría y caducidad estimada para un alimento dado su nombre.
    IA pasiva: es una sugerencia para rellenar el formulario; el usuario la edita/confirma."""
    if not GEMINI_API_KEY:
        return SugerenciaMetadataResponse(
            generado_por_ia=False, mensaje="El asistente de IA no está disponible."
        )

    system_instruction = (
        "Eres un asistente de despensa. Para el alimento indicado, devuelve su categoría y su vida útil "
        "típica en días desde la compra (sin abrir).\n"
        "Reglas:\n"
        "- 'categoria': una palabra (Lácteos, Carnes, Frutas, Verduras, Bebidas, Congelados, Despensa...).\n"
        "- 'dias_estimados': entero realista de conservación típica.\n"
        "- Sé conservador: ante la duda, estima a la baja."
    )

    texto_llm = await _call_gemini(
        system_instruction,
        nombre.strip(),
        max_output_tokens=80,
        response_schema=_METADATA_RESPONSE_SCHEMA,
    )
    if texto_llm is None:
        return SugerenciaMetadataResponse(
            generado_por_ia=False,
            mensaje="No se pudo contactar con el asistente de IA.",
        )

    try:
        data = json.loads(texto_llm)
        categoria = (data.get("categoria") or "").strip() or None
        dias = data.get("dias_estimados")
        dias = int(dias) if dias is not None else None
        if dias is not None and dias < 0:
            dias = None
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.error(
            f"La respuesta de metadata de alimento de Gemini no es válida: {e}"
        )
        return SugerenciaMetadataResponse(
            generado_por_ia=False,
            mensaje="No se pudo estimar la información del alimento.",
        )

    fecha_estimada = (
        fecha_referencia + datetime.timedelta(days=dias) if dias is not None else None
    )
    return SugerenciaMetadataResponse(
        categoria=categoria,
        dias_estimados=dias,
        fecha_caducidad_estimada=fecha_estimada,
        generado_por_ia=True,
        mensaje=None,
    )


# --- Plan de comidas semanal ----------------------------------------------------

_PLAN_RESPONSE_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "dia": {"type": "STRING"},
            "comida": {"type": "STRING"},
            "cena": {"type": "STRING"},
        },
        "required": ["dia", "comida", "cena"],
    },
}

PLAN_CACHE_TTL = 2 * 60 * 60  # 2 horas


_DEFAULT_PLAN = (
    "Eres el planificador de comidas de un hogar en España. A partir del inventario real de la "
    "despensa, propón un plan semanal de 7 días (lunes a domingo) con comida y cena.\n"
    "Reglas estrictas:\n"
    "- Usa preferentemente ingredientes del inventario (más básicos universales: agua, sal, aceite).\n"
    "- Prioriza en los primeros días los alimentos que caducan pronto.\n"
    "- 'comida' y 'cena': nombre breve del plato, no la receta completa.\n"
    "- Devuelve exactamente 7 objetos, uno por día, en orden de lunes a domingo."
)


async def generate_meal_plan(
    items: list[InventarioAlimentoResponse],
    alertas_caducidad: list[InventarioAlimentoResponse],
    perfil: PerfilHogarResponse | None = None,
    prompt_config: "PromptConfigService | None" = None,
    perfiles_individuales: list[PerfilIndividualResponse] | None = None,
    recetario: list[RecetaMaestraResponse] | None = None,
    memoria: MemoriaGustosResponse | None = None,
) -> PlanComidasResponse:
    """Genera un plan de comidas semanal (comida + cena) aprovechando la despensa,
    priorizando lo que caduca pronto. IA pasiva: solo sugiere. Cacheado 2 h."""
    if not items:
        return PlanComidasResponse(
            dias=[],
            generado_por_ia=False,
            mensaje="Añade alimentos a tu despensa para generar un plan de comidas.",
        )
    if not GEMINI_API_KEY:
        return PlanComidasResponse(
            dias=[],
            generado_por_ia=False,
            mensaje="El asistente de IA no está disponible en este momento.",
        )

    nombres_caducan = sorted({a.nombre for a in alertas_caducidad})
    inventario = sorted(f"{i.nombre} ({i.cantidad} {i.unidad})" for i in items)

    prompt_usuario = (
        f"Inventario disponible en la despensa: {inventario}\n"
        f"Alimentos que caducan pronto (priorízalos en los primeros días): {nombres_caducan or 'ninguno'}\n"
        f"{_bloque_memoria_gustos(memoria)}"
        f"{_bloque_perfil(perfil)}"
        f"{_bloque_perfiles_individuales(perfiles_individuales)}"
        f"{_bloque_recetario(recetario)}"
    )

    cache_key = _hash_key("plancomidas", prompt_usuario)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return PlanComidasResponse.model_validate(cached)

    if prompt_config is not None:
        system_instruction = await prompt_config.get_system_instruction(
            "plan_comidas", _DEFAULT_PLAN
        )
    else:
        system_instruction = (
            _PERSONA_CHEF + "\n\n" + _DEFAULT_PLAN + "\n\n" + _FILOSOFIA_MEDITERRANEA
        )

    texto = await _call_gemini(
        system_instruction,
        prompt_usuario,
        max_output_tokens=1200,
        response_schema=_PLAN_RESPONSE_SCHEMA,
    )
    if texto is None:
        return PlanComidasResponse(
            dias=[],
            generado_por_ia=False,
            mensaje="No se pudo generar el plan en este momento. Inténtalo más tarde.",
        )

    try:
        dias_raw = json.loads(texto)
        dias = [DiaPlanComidas.model_validate(d) for d in dias_raw][:7]
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"La respuesta de plan de comidas de Gemini no es válida: {e}")
        return PlanComidasResponse(
            dias=[],
            generado_por_ia=False,
            mensaje="No se pudo generar el plan en este momento. Inténtalo más tarde.",
        )

    respuesta = PlanComidasResponse(
        dias=dias,
        generado_por_ia=True,
        mensaje=None if dias else "No se pudo generar un plan con la despensa actual.",
    )
    await _cache_set(cache_key, respuesta, PLAN_CACHE_TTL)
    return respuesta


# --- OCR DE TICKETS DE COMPRA (IA) ---------------------------------------------


async def process_receipt_ocr(
    imagen_base64: str, fecha_referencia: datetime.date
) -> TicketOcrResponse:
    """Procesa una imagen (Base64) de un ticket de compra y extrae los alimentos usando Gemini Vision."""
    if not GEMINI_API_KEY:
        return TicketOcrResponse(
            alimentos=[],
            mensaje="Gemini AI no configurado. Función de escáner deshabilitada.",
        )

    system_instruction = (
        "Eres un asistente de hogar experto en extraer compras de tickets de supermercado. "
        "Analiza la imagen adjunta, que es un ticket de compra. Identifica TODOS los ALIMENTOS o "
        "productos de hogar. Omite tasas, bolsas o métodos de pago.\n"
        "Para cada producto:\n"
        "1. Limpia el nombre (ej: 'LECHE SEMIDESN 1L' -> 'Leche Semidesnatada').\n"
        "2. Calcula la cantidad y unidad (1 litro, 500 gramos, 6 unidades).\n"
        "3. Asigna una categoría lógica (Lácteos, Carne, Limpieza, etc.).\n"
        "4. Estima una fecha_caducidad razonable contando desde la fecha de referencia. "
        "Si no caduca o dura meses, devuélvelo como nulo.\n"
        f"Fecha actual de referencia: {fecha_referencia.isoformat()}"
    )

    user_prompt = "Aquí tienes el ticket de compra. Extrae los productos."

    start_time = time.time()
    try:
        raw_json = await _call_gemini(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            response_schema=_DESPENSA_RESPONSE_SCHEMA,
            timeout=30.0,
            image_base64=imagen_base64,
        )
        if not raw_json:
            return TicketOcrResponse(
                alimentos=[], mensaje="No se pudo procesar la imagen del ticket."
            )

        data = json.loads(raw_json)
        alimentos_dict = data.get("alimentos", [])
        alimentos = [
            AlimentoInterpretado(**item)
            for item in alimentos_dict
            if isinstance(item, dict)
        ]

        logger.info(
            f"Ticket procesado en {time.time() - start_time:.2f}s. "
            f"Extraídos {len(alimentos)} productos."
        )
        return TicketOcrResponse(alimentos=alimentos)

    except json.JSONDecodeError:
        logger.error("Error decodificando respuesta JSON del OCR de ticket.")
        return TicketOcrResponse(
            alimentos=[], mensaje="El formato de respuesta de la IA fue inválido."
        )
    except Exception as e:
        logger.error(f"Error parseando OCR de ticket: {e}")
        return TicketOcrResponse(
            alimentos=[], mensaje="Error interno procesando el ticket."
        )


# --- Análisis de foto de nevera (Gemini Vision) ---

_FOTO_NEVERA_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "alimentos": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "nombre": {"type": "STRING"},
                    "cantidad": {"type": "NUMBER"},
                    "unidad": {"type": "STRING"},
                    "categoria": {"type": "STRING"},
                    "fecha_caducidad": {"type": "STRING"},
                },
                "required": [
                    "nombre",
                    "cantidad",
                    "unidad",
                    "categoria",
                    "fecha_caducidad",
                ],
            },
        },
        "sugerencias_rapidas": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
        },
    },
    "required": ["alimentos", "sugerencias_rapidas"],
}


async def analyze_fridge_photo(
    imagen_base64: str, fecha_referencia: datetime.date
) -> FotoNeveraResponse:
    """Analiza una foto de nevera o despensa con Gemini Vision e identifica los
    ingredientes visibles. Devuelve propuesta de alimentos y sugerencias de recetas
    express. IA pasiva: el usuario confirma cada ingrediente antes de añadirlo."""
    if not GEMINI_API_KEY:
        return FotoNeveraResponse(
            alimentos=[],
            sugerencias_rapidas=[],
            mensaje="Gemini AI no configurado. Función de foto de nevera deshabilitada.",
        )

    system_instruction = (
        "Eres el asistente de despensa de un hogar en España. Analiza la foto de la nevera "
        "o despensa y extrae los ingredientes o alimentos que se ven con claridad.\n"
        f"Fecha actual de referencia: {fecha_referencia.isoformat()}\n"
        "Para cada alimento visible:\n"
        "1. Nombre descriptivo en español (ej: 'Huevos', 'Leche semidesnatada', 'Pimiento rojo').\n"
        "2. Cantidad estimada visible y unidad (ej: 6 unidades, 1 litro, 200 gramos).\n"
        "3. Categoría (Lácteos, Huevos, Frutas, Verduras, Carnes, Bebidas, Despensa, etc.).\n"
        "4. fecha_caducidad: estima una fecha realista si el producto tiene vida corta; "
        "cadena vacía si es indefinida o no visible.\n"
        "5. En 'sugerencias_rapidas': hasta 3 nombres de recetas sencillas mediterráneas "
        "que se podrían hacer con lo que se ve (solo nombres, sin detalles).\n"
        "Si la imagen no muestra alimentos o es ilegible, devuelve alimentos=[] y "
        "sugerencias_rapidas=[]."
    )

    user_prompt = "Aquí tienes la foto de mi nevera/despensa. Identifica los ingredientes visibles."

    start_time = time.time()
    try:
        raw_json = await _call_gemini(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            response_schema=_FOTO_NEVERA_RESPONSE_SCHEMA,
            timeout=30.0,
            image_base64=imagen_base64,
        )
        if not raw_json:
            return FotoNeveraResponse(
                alimentos=[],
                sugerencias_rapidas=[],
                mensaje="No se pudo procesar la imagen. Intenta con una foto más clara.",
            )

        data = json.loads(raw_json)
        alimentos = [
            AlimentoInterpretado(**item)
            for item in data.get("alimentos", [])
            if isinstance(item, dict)
        ]
        sugerencias_rapidas = [
            s
            for s in data.get("sugerencias_rapidas", [])
            if isinstance(s, str) and s.strip()
        ][:3]

        logger.info(
            f"Foto nevera procesada en {time.time() - start_time:.2f}s. "
            f"{len(alimentos)} ingredientes, {len(sugerencias_rapidas)} sugerencias."
        )
        return FotoNeveraResponse(
            alimentos=alimentos, sugerencias_rapidas=sugerencias_rapidas
        )

    except json.JSONDecodeError:
        logger.error(
            "Error decodificando respuesta JSON del análisis de foto de nevera."
        )
        return FotoNeveraResponse(
            alimentos=[],
            sugerencias_rapidas=[],
            mensaje="El formato de respuesta de la IA fue inválido.",
        )
    except Exception as e:
        logger.error(f"Error analizando foto de nevera: {e}")
        return FotoNeveraResponse(
            alimentos=[],
            sugerencias_rapidas=[],
            mensaje="Error interno analizando la foto.",
        )


# --- Identificación de ingredientes rechazados (Fase 4b) ------------------------

_INGREDIENTES_RECHAZADOS_SCHEMA = {
    "type": "ARRAY",
    "items": {"type": "STRING"},
}


async def identify_rejected_ingredients(
    nombre_receta: str,
    ingredientes: list[str],
    excluir_actuales: list[str],
) -> list[str]:
    """Identifica los ingredientes de una receta rechazada que probablemente
    motivaron el rechazo, para añadirlos al perfil individual del miembro.
    Escritura de bajo riesgo + reversible: el frontend ofrece undo visible."""
    if not GEMINI_API_KEY:
        return []

    ya_excluidos = (
        f"Ya excluidos previamente (no repetir): {excluir_actuales}"
        if excluir_actuales
        else ""
    )
    prompt_usuario = (
        f"Receta rechazada: {nombre_receta}\n"
        f"Ingredientes: {ingredientes}\n"
        f"{ya_excluidos}"
    )

    texto = await _call_gemini(
        "Eres el asistente culinario de un hogar. Dado el nombre de una receta rechazada "
        "y su lista de ingredientes, identifica cuáles son el motivo más probable del rechazo. "
        "Devuelve únicamente los nombres de los ingredientes problemáticos (array de strings). "
        "Si no puedes determinarlo con certeza, devuelve [].",
        prompt_usuario,
        max_output_tokens=150,
        response_schema=_INGREDIENTES_RECHAZADOS_SCHEMA,
    )
    if texto is None:
        return []

    try:
        candidatos = json.loads(texto)
        if not isinstance(candidatos, list):
            return []
        return [
            c.strip()
            for c in candidatos
            if isinstance(c, str) and c.strip() and c.strip() not in excluir_actuales
        ]
    except (json.JSONDecodeError, ValueError):
        return []


# --- CHEF CONVERSACIONAL (CHAT) ------------------------------------------------

_CHEF_CHAT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "respuesta": {"type": "STRING"},
        "platos": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "titulo": {"type": "STRING"},
                    "tiempo_min": {"type": "INTEGER"},
                    "ingredientes_usados": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                    },
                    "pasos": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
                "required": ["titulo", "tiempo_min", "ingredientes_usados", "pasos"],
            },
        },
        "consumo_estimado": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "item_id": {"type": "STRING"},
                    "cantidad": {"type": "NUMBER"},
                    "nombre": {"type": "STRING"},
                },
                "required": ["item_id", "cantidad", "nombre"],
            },
        },
    },
    "required": ["respuesta"],
}

_CHEF_CHAT_SYSTEM = (
    "TAREA: estás conversando por chat con el hogar. Responde de forma breve, cálida y "
    "útil a lo que te pregunten sobre qué cocinar, ideas con su despensa, dudas de cocina "
    "o ajustes rápidos. Apóyate en lo que sabes del hogar y en su despensa actual.\n"
    "Reglas: respuestas cortas (2 a 5 frases), texto plano SIN markdown (ni *, ni -, ni #). "
    "Sugiere platos concretos cuando ayude rellenando el array 'platos'. "
    "Si el usuario indica que ha cocinado o gastado algo de la despensa, añade los "
    "ingredientes consumidos al array 'consumo_estimado' devolviendo el ID exacto y la cantidad "
    "basándote en el inventario actual. "
    "Si te piden algo ajeno a la cocina, redirige con cariño al terreno gastronómico. "
    "No inventes datos del hogar que no tengas."
)


async def chef_chat(
    mensajes: list[ChefMensaje],
    items: list[InventarioAlimentoResponse],
    alertas_caducidad: list[InventarioAlimentoResponse],
    perfil: PerfilHogarResponse | None = None,
    memoria: MemoriaGustosResponse | None = None,
    perfiles_individuales: list[PerfilIndividualResponse] | None = None,
    recetario: list[RecetaMaestraResponse] | None = None,
) -> ChefChatResponse:
    """Responde a la conversación del hogar con la persona del chef, fundamentado en la
    despensa actual + memoria de gustos + perfiles. Multi-turno: el cliente envía los
    turnos recientes; el servidor NO persiste el texto crudo del chat (RGPD)."""
    if not GEMINI_API_KEY:
        return ChefChatResponse(
            respuesta="",
            generado_por_ia=False,
            mensaje="El chef no está disponible en este momento.",
        )

    nombres_caducan = sorted({a.nombre for a in alertas_caducidad})
    inventario = sorted(
        f"{i.nombre} ({i.cantidad} {i.unidad}) [ID: {i.id}]" for i in items
    )
    contexto = (
        f"Despensa actual del hogar: {inventario or 'vacía'}\n"
        f"Caducan pronto: {nombres_caducan or 'nada'}\n"
        f"{_bloque_memoria_gustos(memoria)}"
        f"{_bloque_perfil(perfil)}"
        f"{_bloque_perfiles_individuales(perfiles_individuales)}"
        f"{_bloque_recetario(recetario)}"
    )

    system_instruction = (
        _PERSONA_CHEF
        + "\n\n"
        + _CHEF_CHAT_SYSTEM
        + "\n\n"
        + "CONTEXTO DEL HOGAR (úsalo con naturalidad, no lo recites literalmente):\n"
        + contexto
        + "\n"
        + _FILOSOFIA_MEDITERRANEA
    )

    # Multi-turno: sanea SOLO los mensajes del usuario antes de enviarlos a Gemini.
    contents: list[dict[str, Any]] = [
        {
            "role": "user" if m.rol == "usuario" else "model",
            "parts": [
                {
                    "text": _sanitize_user_text(m.texto, max_len=1000)
                    if m.rol == "usuario"
                    else m.texto
                }
            ],
        }
        for m in mensajes
    ]

    texto = await _call_gemini(
        system_instruction,
        max_output_tokens=1000,
        contents=contents,
        response_schema=_CHEF_CHAT_SCHEMA,
    )
    if texto is None:
        return ChefChatResponse(
            respuesta="No he podido responder ahora mismo. Inténtalo de nuevo en un momento.",
            generado_por_ia=False,
        )

    try:
        data = json.loads(texto)
        respuesta_str = data.get("respuesta", "")
        platos_raw = data.get("platos", [])
        consumos_raw = data.get("consumo_estimado", [])

        from app.schemas.schemas import ConsumoEstimado

        platos = (
            [RecetaSugerida.model_validate(p) for p in platos_raw]
            if platos_raw
            else None
        )
        consumo_estimado = (
            [ConsumoEstimado.model_validate(c) for c in consumos_raw]
            if consumos_raw
            else None
        )

        return ChefChatResponse(
            respuesta=respuesta_str,
            generado_por_ia=True,
            platos=platos,
            consumo_estimado=consumo_estimado,
        )
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Error decodificando respuesta estructurada de chat: {e}")
        return ChefChatResponse(
            respuesta="Ups, ha habido un problema entendiendo mi propia respuesta.",
            generado_por_ia=False,
        )
