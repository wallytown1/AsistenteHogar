import os
import logging
import httpx
import datetime
from app.schemas.schemas import DashboardUnifiedContext

logger = logging.getLogger("app.llm")

# Obtener clave de la API de Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Si no está definida, registrar advertencia
if not GEMINI_API_KEY:
    logger.warning("La variable de entorno GEMINI_API_KEY no está configurada. El servicio de LLM operará en modo de contingencia (fallback).")


def generate_fallback_briefing(context: DashboardUnifiedContext) -> str:
    """Genera un resumen estático amigable del hogar en caso de fallo del LLM o ausencia de API Key."""
    logger.info("Generando briefing alternativo predefinido (fallback)...")
    
    lines = [
        "### ☀️ ¡Buenos días! 🏡",
        "No hemos podido conectar con el asistente de IA para redactar el informe personalizado, pero aquí tienes los datos importantes de tu hogar listos:",
        ""
    ]
    
    # 1. Clima
    lines.append(f"**🌡️ Clima hoy:** {context.clima_temperatura} · {context.clima_estado} (Madrid)")
    lines.append("")

    # 2. Eventos
    lines.append("**📅 Agenda de hoy:**")
    if context.eventos_hoy:
        for ev in context.eventos_hoy:
            hora_inicio = ev.fecha_inicio.strftime("%H:%M") if ev.fecha_inicio else "Todo el día"
            participantes = f" con {', '.join(ev.participantes)}" if ev.participantes else ""
            lines.append(f"- **{hora_inicio}**: {ev.titulo}{participantes}")
    else:
        lines.append("- No hay eventos programados para hoy.")
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

    # 4. Despensa
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
    """Genera el resumen personalizado utilizando la API de Gemini (gemini-1.5-flash).
    Implementa tolerancia a fallos y fallback en caso de errores de API o red.
    """
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

    # Prompt detallado con información de contexto estructurada
    prompt_usuario = (
        f"Fecha: {context.fecha}\n"
        f"Clima: {context.clima_temperatura}, {context.clima_estado}\n"
        f"Eventos programados para hoy: {resumen_eventos}\n"
        f"Tareas pendientes de hoy: {resumen_tareas}\n"
        f"Alimentos que vencen pronto en despensa: {resumen_alimentos}\n"
    )

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
        "- Temperatura obligatoria: 0.0 (máxima precisión, sin creatividad o alucinación).\n"
        "- Sé extremadamente veraz y fiel a los datos proporcionados. Prohibido inventar eventos, tareas, alimentos, nombres, horas o temperaturas.\n"
        "- No des introducciones protocolares ni conclusiones vacías. Empieza directamente con el informe matutino.\n"
        "- Tu rol es exclusivamente de lectura; nunca intentes cambiar ni simular escrituras en la base de datos."
    )

    # Configuración de llamada HTTP asíncrona hacia Gemini API
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt_usuario}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 400
        },
        "systemInstruction": {
            "parts": [
                {"text": system_instruction}
            ]
        }
    }

    try:
        # Definir timeout de 10 segundos para evitar colgar el servidor
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)
            
            if response.status_code == 200:
                data = response.json()
                # Extraer texto del formato de respuesta de Gemini
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text.strip()
            else:
                logger.error(
                    f"La API de Gemini retornó un código de estado {response.status_code}. "
                    f"Detalle: {response.text}"
                )
    except httpx.RequestError as e:
        logger.error(f"Error de red/petición al conectar con la API de Gemini: {e}")
    except KeyError as e:
        logger.error(f"Error al parsear el JSON retornado por la API de Gemini (estructura inesperada): {e}")
    except Exception as e:
        logger.error(f"Error inesperado al generar el briefing del LLM: {e}")

    # Si ocurre cualquier excepción, devolver el fallback
    return generate_fallback_briefing(context)
