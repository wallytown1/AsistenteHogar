import asyncio
import datetime
import hashlib
import json
import logging
import time
from typing import Any

import httpx

from app.core.config import GEMINI_API_KEY, GEMINI_MODEL
from app.core.redis_client import get_redis
from app.schemas.schemas import (
    AlimentoInterpretado,
    DashboardUnifiedContext,
    DiaPlanComidas,
    EventoInterpretado,
    InterpretarDespensaResponse,
    InterpretarEventoResponse,
    InterpretarTareaResponse,
    InventarioAlimentoResponse,
    PerfilHogarResponse,
    PlanComidasResponse,
    RecetaHistorialResponse,
    RecetasSugeridasResponse,
    RecetaSugerida,
    SugerenciaMetadataResponse,
    TareaInterpretada,
    TicketOcrResponse,
)
from app.services.privacy import AnonimizadorLLM

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
    user_prompt: str,
    max_output_tokens: int = 400,
    response_schema: dict[str, Any] | None = None,
    timeout: float = 15.0,
    image_base64: str | None = None,
) -> str | None:
    """Llamada a la API de Gemini con reintento acotado ante fallos transitorios.
    Devuelve el texto generado o None si falla definitivamente.
    thinkingBudget=0 desactiva el razonamiento interno del modelo: innecesario para
    estas tareas y reduce latencia y coste."""
    generation_config: dict[str, Any] = {
        "temperature": 0.0,
        "maxOutputTokens": max_output_tokens,
        "thinkingConfig": {"thinkingBudget": 0},
    }
    if response_schema is not None:
        generation_config["responseMimeType"] = "application/json"
        generation_config["responseSchema"] = response_schema

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

    payload = {
        "contents": [{"parts": parts}],
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
        "No hemos podido conectar con el asistente de IA para redactar el informe personalizado, pero aquí tienes los datos importantes de tu hogar listos:",
        "",
    ]

    # 1. Eventos
    lines.append("**📅 Agenda de hoy:**")
    if context.eventos_hoy:
        for ev in context.eventos_hoy:
            hora_inicio = (
                ev.fecha_inicio.strftime("%H:%M") if ev.fecha_inicio else "Todo el día"
            )
            participantes = (
                f" con {', '.join(ev.participantes)}" if ev.participantes else ""
            )
            lines.append(f"- **{hora_inicio}**: {ev.titulo}{participantes}")
    else:
        lines.append("- No hay eventos programados para hoy.")
    lines.append("")

    # 2. Conflictos de agenda
    if context.conflictos_agenda:
        lines.append("**⚠️ Conflictos de horario:**")
        for c in context.conflictos_agenda:
            hora_a = (
                c.evento_a.fecha_inicio.strftime("%H:%M")
                if c.evento_a.fecha_inicio
                else "?"
            )
            hora_b = (
                c.evento_b.fecha_inicio.strftime("%H:%M")
                if c.evento_b.fecha_inicio
                else "?"
            )
            mins = round(c.duracion_solapamiento_segundos / 60)
            lines.append(
                f"- **{c.evento_a.titulo}** ({hora_a}) y **{c.evento_b.titulo}** ({hora_b}) "
                f"se solapan {mins} min"
            )
        lines.append("")

    # 3. Tareas
    lines.append("**⚡ Tareas pendientes:**")
    if context.tareas_pendientes:
        for t in context.tareas_pendientes:
            asignado = f" (Asignado a: {t.asignado_a})" if t.asignado_a else ""
            lines.append(f"- {t.nombre}{asignado}")
    else:
        lines.append("- No hay tareas domésticas pendientes para hoy.")
    lines.append("")

    # 3. Despensa
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

    # Minimización de datos (RGPD): los nombres propios de la familia se
    # sustituyen por tokens Familiar_N antes de salir hacia Gemini. El
    # diccionario de alias se construye solo desde los campos estructurados.
    nombres: list[str | None] = [t.asignado_a for t in context.tareas_pendientes]
    for ev in context.eventos_hoy:
        nombres.extend(ev.participantes or [])
    for conflicto in context.conflictos_agenda:
        nombres.extend(conflicto.evento_a.participantes or [])
        nombres.extend(conflicto.evento_b.participantes or [])
    anonimizador = AnonimizadorLLM(nombres)

    # Optimización de tokens para el payload del prompt (enviando solo campos esenciales)
    resumen_eventos = [
        {
            "titulo": ev.titulo,
            "hora_inicio": ev.fecha_inicio.strftime("%H:%M") if ev.fecha_inicio else "",
            "participantes": ev.participantes,
        }
        for ev in context.eventos_hoy
    ]

    resumen_tareas = [
        {"nombre": t.nombre, "asignado_a": t.asignado_a}
        for t in context.tareas_pendientes
    ]

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

    resumen_conflictos = [
        {
            "evento_a": conflicto.evento_a.titulo,
            "hora_a": conflicto.evento_a.fecha_inicio.strftime("%H:%M")
            if conflicto.evento_a.fecha_inicio
            else "",
            "evento_b": conflicto.evento_b.titulo,
            "hora_b": conflicto.evento_b.fecha_inicio.strftime("%H:%M")
            if conflicto.evento_b.fecha_inicio
            else "",
            "solapamiento_min": round(conflicto.duracion_solapamiento_segundos / 60),
        }
        for conflicto in context.conflictos_agenda
    ]

    prompt_usuario = anonimizador.anonimizar(
        f"Fecha: {context.fecha}\n"
        f"Eventos programados para hoy: {resumen_eventos}\n"
        f"Conflictos de horario detectados (solapamientos): {resumen_conflictos}\n"
        f"Tareas pendientes de hoy: {resumen_tareas}\n"
        f"Alimentos que vencen pronto en despensa: {resumen_alimentos}\n"
    )

    # Caché: si los datos del hogar no cambiaron, reutilizar el briefing reciente.
    # Orden crítico: la clave se calcula sobre el prompt YA anonimizado y la
    # entrada cacheada es la respuesta AÚN anonimizada (la reversión va después),
    # de modo que la caché nunca contiene datos personales.
    cache_key = _hash_key("briefing", prompt_usuario)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return anonimizador.revertir(cached), True

    system_instruction = (
        "Eres el asistente y mayordomo inteligente de este hogar en España. "
        "Tu tarea consiste en dar los buenos días de manera sumamente natural, amena y cálida. "
        "Debes redactar un mensaje conversacional (no uses listas, ni viñetas, ni asteriscos). "
        "Habla en primera persona del singular, con un tono elegante pero muy cercano.\n"
        "Estructura tu mensaje en exactamente 3 párrafos cortos y fluidos separados por saltos de línea:\n"
        "1. Un saludo matutino inspirador que mencione fluidamente la agenda. Si hay conflictos de horario en los datos, avisa de ellos con naturalidad y urgencia suave (ej: 'ten en cuenta que la reunión de las 10 se solapa con...').\n"
        "2. Un recordatorio suave sobre quién tiene que hacer las tareas más importantes de la casa hoy.\n"
        "3. Una recomendación amable sobre qué alimentos de la despensa aprovechar pronto porque están a punto de caducar.\n\n"
        "Restricciones críticas de seguridad e IA:\n"
        "- Sé extremadamente veraz y fiel a los datos proporcionados. Prohibido inventar eventos, tareas, alimentos o nombres.\n"
        "- NO uses NINGUNA marca de formato Markdown (ni *, ni -, ni #). Solo usa texto plano y puntos y aparte.\n"
        "- Tu rol es exclusivamente de lectura; no sugieras acciones que no puedan realizar en la casa de forma natural."
    )

    texto = await _call_gemini(
        system_instruction, prompt_usuario, max_output_tokens=400
    )
    if texto is None:
        return generate_fallback_briefing(context), False

    await _cache_set(cache_key, texto, BRIEFING_CACHE_TTL)
    return anonimizador.revertir(texto), True


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


def _bloque_historial(historial: list[RecetaHistorialResponse] | None) -> str:
    """Construye el bloque de historial de comportamiento para el prompt.
    Señales positivas (cocinadas) evitan repeticiones a corto plazo.
    Señales negativas (rechazadas) excluyen esas recetas permanentemente."""
    if not historial:
        return ""
    cocinadas = [h.nombre_receta for h in historial if h.accion == "cocinada"]
    rechazadas = [h.nombre_receta for h in historial if h.accion == "rechazada"]
    lineas = []
    if cocinadas:
        lineas.append(
            f"Recetas cocinadas recientemente (evita repetirlas a menos que hayan pasado varios días): "
            f"{', '.join(cocinadas[:10])}."
        )
    if rechazadas:
        lineas.append(
            f"Recetas rechazadas por el hogar (NO sugerir bajo ningún concepto): "
            f"{', '.join(rechazadas[:10])}."
        )
    if not lineas:
        return ""
    return "Historial del hogar:\n" + "\n".join(lineas) + "\n"


async def generate_recipe_suggestions(
    items: list[InventarioAlimentoResponse],
    alertas_caducidad: list[InventarioAlimentoResponse],
    perfil: PerfilHogarResponse | None = None,
    historial: list[RecetaHistorialResponse] | None = None,
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
        f"{_bloque_perfil(perfil)}"
        f"{_bloque_historial(historial)}"
    )

    cache_key = _hash_key("recetas", prompt_usuario)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return RecetasSugeridasResponse.model_validate(cached)

    system_instruction = (
        "Eres el chef asistente de un hogar en España. A partir del inventario real de la "
        "despensa, sugiere entre 1 y 3 recetas caseras sencillas en español.\n"
        f"{_FILOSOFIA_MEDITERRANEA}"
        "Reglas estrictas:\n"
        "- Usa únicamente ingredientes del inventario proporcionado (más básicos universales: agua, sal, aceite, pimienta).\n"
        "- Prioriza recetas que aprovechen los alimentos que caducan pronto.\n"
        "- 'ingredientes_usados' solo puede contener nombres que aparezcan en el inventario.\n"
        "- 'pasos': máximo 5 pasos breves por receta.\n"
        "- 'tiempo_min': tiempo realista de preparación en minutos.\n"
        "- Si el inventario es insuficiente para una receta digna, devuelve un array vacío []."
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


# --- Interpretación de eventos en lenguaje natural ------------------------------

_EVENTO_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "titulo": {"type": "STRING"},
        "descripcion": {"type": "STRING"},
        "fecha_inicio": {"type": "STRING"},
        "fecha_fin": {"type": "STRING"},
        "participantes": {"type": "ARRAY", "items": {"type": "STRING"}},
        "interpretable": {"type": "BOOLEAN"},
    },
    "required": ["titulo", "fecha_inicio", "fecha_fin", "interpretable"],
}

_DIAS_SEMANA = [
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
    "domingo",
]

_MENSAJE_NO_INTERPRETABLE = (
    "No he podido interpretar esa frase como un evento. "
    "Prueba con algo como: 'dentista mañana a las 10' o 'cena familiar el viernes a las 21'."
)


async def interpret_event_text(
    texto: str, fecha_referencia: datetime.datetime
) -> InterpretarEventoResponse:
    """Convierte una frase en lenguaje natural en una propuesta de evento de calendario.
    IA pasiva: devuelve solo una propuesta; el usuario debe confirmarla antes de crearla."""
    if not GEMINI_API_KEY:
        return InterpretarEventoResponse(
            evento=None,
            mensaje="El asistente de IA no está disponible. Usa el formulario de evento detallado.",
        )

    dia_semana = _DIAS_SEMANA[fecha_referencia.weekday()]
    system_instruction = (
        "Eres el asistente de calendario de un hogar en España. Convierte la frase del usuario "
        "en un evento de calendario estructurado.\n"
        f"Fecha y hora actual de referencia: {dia_semana} {fecha_referencia.isoformat()}\n"
        "Reglas estrictas:\n"
        "- Resuelve expresiones relativas ('mañana', 'el viernes', 'en dos horas') respecto a la fecha de referencia.\n"
        "- Las fechas resultantes deben ser futuras y en el mismo huso horario que la referencia, formato ISO-8601 con offset.\n"
        "- Si no se indica duración, el evento dura 1 hora.\n"
        "- Si no se indica hora, asume una hora razonable según el tipo de evento (citas médicas por la mañana, cenas a las 21:00...).\n"
        "- 'participantes': solo nombres de personas mencionados explícitamente en la frase.\n"
        "- No inventes datos que no estén en la frase; 'descripcion' solo si la frase aporta detalles extra.\n"
        "- Si la frase NO describe un evento de calendario, devuelve interpretable=false."
    )

    texto_llm = await _call_gemini(
        system_instruction,
        texto.strip(),
        max_output_tokens=300,
        response_schema=_EVENTO_RESPONSE_SCHEMA,
    )

    if texto_llm is None:
        return InterpretarEventoResponse(
            evento=None,
            mensaje="No se pudo contactar con el asistente de IA. Inténtalo de nuevo o usa el formulario detallado.",
        )

    try:
        data = json.loads(texto_llm)
        if not data.get("interpretable") or not data.get("titulo", "").strip():
            return InterpretarEventoResponse(
                evento=None, mensaje=_MENSAJE_NO_INTERPRETABLE
            )

        evento = EventoInterpretado(
            titulo=data["titulo"].strip(),
            descripcion=(data.get("descripcion") or "").strip() or None,
            fecha_inicio=datetime.datetime.fromisoformat(data["fecha_inicio"]),
            fecha_fin=datetime.datetime.fromisoformat(data["fecha_fin"]),
            participantes=data.get("participantes") or None,
        )
        if evento.fecha_fin <= evento.fecha_inicio:
            return InterpretarEventoResponse(
                evento=None, mensaje=_MENSAJE_NO_INTERPRETABLE
            )
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.error(
            f"La respuesta de interpretación de evento de Gemini no es válida: {e}"
        )
        return InterpretarEventoResponse(evento=None, mensaje=_MENSAJE_NO_INTERPRETABLE)

    return InterpretarEventoResponse(evento=evento, mensaje=None)


# --- Interpretación de tareas en lenguaje natural -------------------------------

_TAREA_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "nombre": {"type": "STRING"},
        "asignado_a": {"type": "STRING"},
        "frecuencia": {
            "type": "STRING",
            "enum": ["diaria", "semanal", "mensual", "ocasional"],
        },
        "prioridad": {"type": "STRING", "enum": ["alta", "media", "baja"]},
        "interpretable": {"type": "BOOLEAN"},
    },
    "required": ["nombre", "frecuencia", "prioridad", "interpretable"],
}

_MENSAJE_TAREA_NO_INTERPRETABLE = (
    "No he podido interpretar esa frase como una tarea. "
    "Prueba con algo como: 'sacar la basura los lunes' o 'limpiar el baño cada semana, le toca a Ana'."
)


async def interpret_task_text(texto: str) -> InterpretarTareaResponse:
    """Convierte una frase en lenguaje natural en una propuesta de tarea doméstica.
    IA pasiva: devuelve solo una propuesta; el usuario debe confirmarla antes de crearla."""
    if not GEMINI_API_KEY:
        return InterpretarTareaResponse(
            tarea=None,
            mensaje="El asistente de IA no está disponible. Usa el formulario de tarea.",
        )

    system_instruction = (
        "Eres el asistente de tareas domésticas de un hogar en España. Convierte la frase del usuario "
        "en una tarea estructurada.\n"
        "Reglas estrictas:\n"
        "- 'nombre': descripción breve y clara de la tarea (sin incluir la frecuencia ni la persona).\n"
        "- 'frecuencia': una de diaria, semanal, mensual, ocasional (dedúcela; si no se indica, 'ocasional').\n"
        "- 'prioridad': una de alta, media, baja (si no se indica, 'media').\n"
        "- 'asignado_a': solo si la frase menciona explícitamente a una persona; si no, cadena vacía.\n"
        "- Si la frase NO describe una tarea doméstica, devuelve interpretable=false."
    )

    texto_llm = await _call_gemini(
        system_instruction,
        texto.strip(),
        max_output_tokens=200,
        response_schema=_TAREA_RESPONSE_SCHEMA,
    )
    if texto_llm is None:
        return InterpretarTareaResponse(
            tarea=None,
            mensaje="No se pudo contactar con el asistente de IA. Inténtalo de nuevo o usa el formulario.",
        )

    try:
        data = json.loads(texto_llm)
        if not data.get("interpretable") or not (data.get("nombre") or "").strip():
            return InterpretarTareaResponse(
                tarea=None, mensaje=_MENSAJE_TAREA_NO_INTERPRETABLE
            )
        tarea = TareaInterpretada(
            nombre=data["nombre"].strip(),
            asignado_a=(data.get("asignado_a") or "").strip() or None,
            frecuencia=(data.get("frecuencia") or "ocasional"),
            prioridad=(data.get("prioridad") or "media"),
        )
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.error(
            f"La respuesta de interpretación de tarea de Gemini no es válida: {e}"
        )
        return InterpretarTareaResponse(
            tarea=None, mensaje=_MENSAJE_TAREA_NO_INTERPRETABLE
        )

    return InterpretarTareaResponse(tarea=tarea, mensaje=None)


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
        texto.strip(),
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


async def generate_meal_plan(
    items: list[InventarioAlimentoResponse],
    alertas_caducidad: list[InventarioAlimentoResponse],
    perfil: PerfilHogarResponse | None = None,
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
        f"{_bloque_perfil(perfil)}"
    )

    cache_key = _hash_key("plancomidas", prompt_usuario)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return PlanComidasResponse.model_validate(cached)

    system_instruction = (
        "Eres el planificador de comidas de un hogar en España. A partir del inventario real de la "
        "despensa, propón un plan semanal de 7 días (lunes a domingo) con comida y cena.\n"
        f"{_FILOSOFIA_MEDITERRANEA}"
        "Reglas estrictas:\n"
        "- Usa preferentemente ingredientes del inventario (más básicos universales: agua, sal, aceite).\n"
        "- Prioriza en los primeros días los alimentos que caducan pronto.\n"
        "- 'comida' y 'cena': nombre breve del plato, no la receta completa.\n"
        "- Devuelve exactamente 7 objetos, uno por día, en orden de lunes a domingo."
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
