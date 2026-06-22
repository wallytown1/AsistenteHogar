import uuid
from datetime import UTC, datetime

from app.core.utils import sanitize_text
from app.schemas.schemas import DashboardUnifiedContext
from app.services.llm import generate_morning_briefing
from app.services.memoria import MemoriaService
from app.services.pantry import PantryService


class DashboardService:
    def __init__(self, pantry_service: PantryService, memoria_service: MemoriaService):
        self.pantry_service = pantry_service
        self.memoria_service = memoria_service

    async def get_unified_dashboard(
        self, hogar_id: uuid.UUID
    ) -> DashboardUnifiedContext:
        """Recopila el estado de la despensa del hogar y genera el resumen de la
        mañana centrado en stock, caducidades y recetas de aprovechamiento."""
        alertas_despensa = await self.pantry_service.get_stock_metrics(hogar_id)
        memoria = await self.memoria_service.obtener(hogar_id)

        # Consistencia de zona horaria: fecha actual en UTC
        hoy_utc = datetime.now(UTC).date()

        # Sanitizar alimentos de la despensa (model_copy para no mutar el DTO original)
        alertas_despensa = alertas_despensa.model_copy(
            update={
                "alertas_caducidad": [
                    alt.model_copy(update={"nombre": sanitize_text(alt.nombre)})
                    for alt in alertas_despensa.alertas_caducidad
                ]
            }
        )

        context = DashboardUnifiedContext(
            fecha=hoy_utc.isoformat(),
            alertas_despensa=alertas_despensa,
        )

        # Generar briefing de texto con IA (Gemini) o fallback de contingencia ante fallos.
        # El flag briefing_generado_por_ia activa el aviso de transparencia (EU AI Act art. 50)
        # en el cliente solo cuando el texto proviene realmente del modelo.
        (
            context.briefing_texto,
            context.notificacion_push,
            context.briefing_generado_por_ia,
        ) = await generate_morning_briefing(context, memoria)

        return context
