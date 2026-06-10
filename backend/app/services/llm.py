import hashlib
import json
import logging
import time
import datetime
from typing import Any, List, Optional

import httpx

from app.core.config import GEMINI_API_KEY, GEMINI_MODEL
from app.schemas.schemas import (
    DashboardUnifiedContext,
    EventoInterpretado,
    InterpretarEventoResponse,
    InventarioAlimentoResponse,
    RecetaSugerida,
    RecetasSugeridasResponse,
)

logger = logging.getLogger("app.llm")

if not GEMINI_API_KEY:
    logger.warning("La variable de entorno GEMINI_API_KEY no está configurada. El servicio de LLM operará en modo de contingencia (fallback).")

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# --- Caché TTL en memoria -----------------------------------------------------
# Evita una llamada a Gemini por cada GET del dashboard/recetas: la clave incluye
# un hash de los datos de entrada, así que cualquier cambio real invalida sola la
# entrada. Deuda técnica conocida: con varias réplicas migrar a Redis (igual que
# el rate limiter).
_cache: dict[str, tuple[float, Any]] = {}
_CACHE_MAX_ENTRIES = 1000

BRIEFING_CACHE_TTL = 30 * 60   # 30 minutos
RECETAS_CACHE_TTL = 60 * 60    # 1 hora


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry is None:
        return None
    expires, value = entry
    if time.monotonic() > expires:
        del _cache[key]
        return None
    return value


def _cache_set(key: str, value: Any, ttl: float) -> None:
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        now = time.monotonic()
        for k in [k for k, (exp, _) in _cache.items() if exp < now]:
            del _cache[k]
        if len(_cache) >= _CACHE_MAX_ENTRIES:
            _cache.clear()
    _cache[key] = (time.monotonic() + ttl, value)


def _hash_key(prefix: str, data: str) -> str:
    return f"{prefix}:{hashlib.sha256(data.encode('utf-8')).hexdigest()}"


# --- Llamada genérica a Gemini ------------------------------------------------

async def _call_gemini(
    system_instruction: str,
    user_prompt: str,
    max_output_tokens: int = 400,
    response_schema: Optional[dict] = None,
) -> Optional[str]:
    """Llamada única a la API de Gemini. Devuelve el texto generado o None si falla.
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

    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": generation_config,
        "systemInstruction": {"parts": [{"text": system_instruction}]},
    }

    try:
        # La clave va en header x-goog-api-key (no en URL) para evitar que aparezca en logs.
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GEMINI_URL,
                json=payload,
                headers={"x-goog-api-key": GEMINI_API_KEY},
                timeout=15.0,
            )
        if response.status_code == 200:
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        logger.error(
            f"La API de Gemini retornó un código de estado {response.status_code}. "
            f"Detalle: {response.text[:500]}"
        )
    except httpx.RequestError as e:
        logger.error(f"Error de red/petición al conectar con la API de Gemini: {type(e).__name__}")
    except (KeyError, IndexError) as e:
        logger.error(f"Error al parsear el JSON retornado por la API de Gemini (estructura inesperada): {e}")
    except Exception as e:
        logger.error(f"Error inesperado al llamar a la API de Gemini: {e}")
    return None


# --- Briefing matutino ----------------------------------------------------------

def generate_fallback_briefing(context: DashboardUnifiedContext) -> str:
    """Genera un resumen estático amigable del hogar en caso de fallo del LLM o ausencia de API Key."""
    logger.info("Generando briefing alternativo predefinido (fallback)...")

    lines = [
        "### ☀️ ¡Buenos días! 🏡",
        "No hemos podido conectar con el asistente de IA para redactar el informe personalizado, pero aquí tienes los datos importantes de tu hogar listos:",
        ""
    ]

    # 1. Eventos
    lines.append("**📅 Agenda de hoy:**")
    if context.eventos_hoy:
        for ev in context.eventos_hoy:
            hora_inicio = ev.fecha_inicio.strftime("%H:%M") if ev.fecha_inicio else "Todo el día"
            participantes = f" con {', '.join(ev.participantes)}" if ev.participantes else ""
            lines.append(f"- **{hora_inicio}**: {ev.titulo}{participantes}")
    else:
        lines.append("- No hay eventos programados para hoy.")
    lines.append("")

    # 2. Tareas
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


async def generate_morning_briefing(context: DashboardUnifiedContext) -> str:
    """Genera el resumen personalizado del hogar con Gemini, con caché TTL y
    fallback estático en caso de error de API o red."""
    if not GEMINI_API_KEY:
        return generate_fallback_briefing(context)

    # Optimización de tokens para el payload del prompt (enviando solo campos esenciales)
    resumen_eventos = [
        {
            "titulo": ev.titulo,
            "hora_inicio": ev.fecha_inicio.strftime("%H:%M") if ev.fecha_inicio else "",
            "participantes": ev.participantes
        }
        for ev in context.eventos_hoy
    ]

    resumen_tareas = [
        {
            "nombre": t.nombre,
            "asignado_a": t.asignado_a
        }
        for t in context.tareas_pendientes
    ]

    resumen_alimentos = [
        {
            "nombre": a.nombre,
            "cantidad": a.cantidad,
            "unidad": a.unidad,
            "fecha_caducidad": a.fecha_caducidad.isoformat() if a.fecha_caducidad else ""
        }
        for a in context.alertas_despensa.alertas_caducidad
    ]

    prompt_usuario = (
        f"Fecha: {context.fecha}\n"
        f"Eventos programados para hoy: {resumen_eventos}\n"
        f"Tareas pendientes de hoy: {resumen_tareas}\n"
        f"Alimentos que vencen pronto en despensa: {resumen_alimentos}\n"
    )

    # Caché: si los datos del hogar no cambiaron, reutilizar el briefing reciente
    cache_key = _hash_key("briefing", prompt_usuario)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    system_instruction = (
        "Eres el asistente inteligente oficial de un núcleo familiar en España. "
        "Tu tarea consiste en generar un briefing matutino o 'Informe de la Mañana' en español "
        "que sea sumamente amigable, empático y ultra-conciso. "
        "Estructura el informe en un resumen general de un solo párrafo corto seguido de unos pocos "
        "puntos de Markdown para resumir de manera limpia y escaneable lo más relevante:\n"
        "1. Agenda de hoy (mencionando las horas y quiénes participan).\n"
        "2. Tareas críticas pendientes del hogar.\n"
        "3. Recordatorio de alimentos a punto de vencer en la despensa.\n\n"
        "Restricciones críticas de seguridad e IA:\n"
        "- Sé extremadamente veraz y fiel a los datos proporcionados. Prohibido inventar eventos, tareas, alimentos, nombres, horas o temperaturas.\n"
        "- No des introducciones protocolares ni conclusiones vacías. Empieza directamente con el informe matutino.\n"
        "- Tu rol es exclusivamente de lectura; nunca intentes cambiar ni simular escrituras en la base de datos."
    )

    texto = await _call_gemini(system_instruction, prompt_usuario, max_output_tokens=400)
    if texto is None:
        return generate_fallback_briefing(context)

    _cache_set(cache_key, texto, BRIEFING_CACHE_TTL)
    return texto


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


async def generate_recipe_suggestions(
    items: List[InventarioAlimentoResponse],
    alertas_caducidad: List[InventarioAlimentoResponse],
) -> RecetasSugeridasResponse:
    """Sugiere hasta 3 recetas a partir de la despensa del hogar, priorizando los
    alimentos a punto de caducar. IA pasiva: solo sugiere, nunca modifica datos."""
    if not items:
        return RecetasSugeridasResponse(
            recetas=[],
            generado_por_ia=False,
            mensaje="Añade alimentos a tu despensa para recibir sugerencias de recetas."
        )

    if not GEMINI_API_KEY:
        return RecetasSugeridasResponse(
            recetas=[],
            generado_por_ia=False,
            mensaje="El asistente de IA no está disponible en este momento."
        )

    nombres_caducan = sorted({a.nombre for a in alertas_caducidad})
    inventario = sorted(
        f"{i.nombre} ({i.cantidad} {i.unidad})" for i in items
    )

    prompt_usuario = (
        f"Inventario disponible en la despensa: {inventario}\n"
        f"Alimentos que caducan pronto (priorízalos): {nombres_caducan or 'ninguno'}\n"
    )

    cache_key = _hash_key("recetas", prompt_usuario)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    system_instruction = (
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
            mensaje="No se pudieron generar sugerencias en este momento. Inténtalo más tarde."
        )

    try:
        recetas_raw = json.loads(texto)
        recetas = [RecetaSugerida.model_validate(r) for r in recetas_raw][:3]
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"La respuesta de recetas de Gemini no es un JSON válido según el esquema: {e}")
        return RecetasSugeridasResponse(
            recetas=[],
            generado_por_ia=False,
            mensaje="No se pudieron generar sugerencias en este momento. Inténtalo más tarde."
        )

    respuesta = RecetasSugeridasResponse(
        recetas=recetas,
        generado_por_ia=True,
        mensaje=None if recetas else "La despensa actual no da para una receta completa. ¡Añade más ingredientes!"
    )
    _cache_set(cache_key, respuesta, RECETAS_CACHE_TTL)
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

_DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

_MENSAJE_NO_INTERPRETABLE = (
    "No he podido interpretar esa frase como un evento. "
    "Prueba con algo como: 'dentista mañana a las 10' o 'cena familiar el viernes a las 21'."
)


async def interpret_event_text(texto: str, fecha_referencia: datetime.datetime) -> InterpretarEventoResponse:
    """Convierte una frase en lenguaje natural en una propuesta de evento de calendario.
    IA pasiva: devuelve solo una propuesta; el usuario debe confirmarla antes de crearla."""
    if not GEMINI_API_KEY:
        return InterpretarEventoResponse(
            evento=None,
            mensaje="El asistente de IA no está disponible. Usa el formulario de evento detallado."
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
            mensaje="No se pudo contactar con el asistente de IA. Inténtalo de nuevo o usa el formulario detallado."
        )

    try:
        data = json.loads(texto_llm)
        if not data.get("interpretable") or not data.get("titulo", "").strip():
            return InterpretarEventoResponse(evento=None, mensaje=_MENSAJE_NO_INTERPRETABLE)

        evento = EventoInterpretado(
            titulo=data["titulo"].strip(),
            descripcion=(data.get("descripcion") or "").strip() or None,
            fecha_inicio=datetime.datetime.fromisoformat(data["fecha_inicio"]),
            fecha_fin=datetime.datetime.fromisoformat(data["fecha_fin"]),
            participantes=data.get("participantes") or None,
        )
        if evento.fecha_fin <= evento.fecha_inicio:
            return InterpretarEventoResponse(evento=None, mensaje=_MENSAJE_NO_INTERPRETABLE)
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.error(f"La respuesta de interpretación de evento de Gemini no es válida: {e}")
        return InterpretarEventoResponse(evento=None, mensaje=_MENSAJE_NO_INTERPRETABLE)

    return InterpretarEventoResponse(evento=evento, mensaje=None)
