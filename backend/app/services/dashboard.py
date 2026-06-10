import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional, List

from app.repositories.task import TaskRepository
from app.services.pantry import PantryService
from app.services.calendar import CalendarService
from app.schemas.schemas import (
    DashboardUnifiedContext, 
    EventoCalendarioResponse, 
    TareaHogarResponse, 
    ConflictoDetalle
)
from app.services.llm import generate_morning_briefing

class DashboardService:
    def __init__(
        self,
        task_repo: TaskRepository,
        pantry_service: PantryService,
        calendar_service: CalendarService
    ):
        self.task_repo = task_repo
        self.pantry_service = pantry_service
        self.calendar_service = calendar_service

    def _sanitize_text(self, t: Optional[str]) -> Optional[str]:
        """Sanitiza strings de texto libre para evitar caracteres de escape rotos."""
        if t is None:
            return None
        # Escape simple de comillas dobles y barras invertidas, y quitar espacios adicionales
        return t.replace("\\", "\\\\").replace('"', '\\"').strip()

    async def get_unified_dashboard(self, hogar_id: uuid.UUID) -> DashboardUnifiedContext:
        """Orquesta la recopilación de datos del hogar de manera concurrente con asyncio.gather,
        filtrando y sanitizando los datos para el Informe de la Mañana."""
        # 1. Ejecutar las consultas de repositorios y servicios de forma concurrente
        results = await asyncio.gather(
            self.calendar_service.get_household_agenda(hogar_id),
            self.pantry_service.get_stock_metrics(hogar_id),
            self.task_repo.get_pending_tasks(hogar_id)
        )

        agenda_completa, conflictos_completos = results[0]
        alertas_despensa = results[1]
        tareas_db = results[2]

        # Consistencia de zona horaria: fecha actual en UTC
        hoy_utc = datetime.now(timezone.utc).date()

        # 2. Filtrar eventos y conflictos correspondientes a hoy
        eventos_hoy: List[EventoCalendarioResponse] = []
        for ev in agenda_completa:
            if ev.fecha_inicio.astimezone(timezone.utc).date() == hoy_utc:
                # Sanitizar textos libres del evento
                ev.titulo = self._sanitize_text(ev.titulo)
                ev.descripcion = self._sanitize_text(ev.descripcion)
                eventos_hoy.append(ev)

        conflictos_hoy: List[ConflictoDetalle] = []
        for conf in conflictos_completos:
            date_a = conf.evento_a.fecha_inicio.astimezone(timezone.utc).date()
            date_b = conf.evento_b.fecha_inicio.astimezone(timezone.utc).date()
            if date_a == hoy_utc or date_b == hoy_utc:
                # Sanitizar textos del conflicto
                conf.evento_a.titulo = self._sanitize_text(conf.evento_a.titulo)
                conf.evento_a.descripcion = self._sanitize_text(conf.evento_a.descripcion)
                conf.evento_b.titulo = self._sanitize_text(conf.evento_b.titulo)
                conf.evento_b.descripcion = self._sanitize_text(conf.evento_b.descripcion)
                conflictos_hoy.append(conf)

        # 3. Sanitizar alimentos de la despensa
        for alt in alertas_despensa.alertas_caducidad:
            alt.nombre = self._sanitize_text(alt.nombre)

        # 4. Mapear y sanitizar tareas pendientes
        tareas_pendientes: List[TareaHogarResponse] = []
        for tarea in tareas_db:
            res = TareaHogarResponse.model_validate(tarea)
            res.nombre = self._sanitize_text(res.nombre)
            res.asignado_a = self._sanitize_text(res.asignado_a)
            tareas_pendientes.append(res)

        context = DashboardUnifiedContext(
            fecha=hoy_utc.isoformat(),
            eventos_hoy=eventos_hoy,
            alertas_despensa=alertas_despensa,
            tareas_pendientes=tareas_pendientes,
            conflictos_agenda=conflictos_hoy
        )

        # Generar briefing de texto con IA (Gemini) o fallback de contingencia ante fallos
        context.briefing_texto = await generate_morning_briefing(context)

        return context
