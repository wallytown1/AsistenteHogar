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
from app.core.utils import sanitize_text

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
        eventos_hoy: List[EventoCalendarioResponse] = [
            ev.model_copy(update={
                "titulo": sanitize_text(ev.titulo),
                "descripcion": sanitize_text(ev.descripcion),
            })
            for ev in agenda_completa
            if ev.fecha_inicio.astimezone(timezone.utc).date() == hoy_utc
        ]

        conflictos_hoy: List[ConflictoDetalle] = [
            conf.model_copy(update={
                "evento_a": conf.evento_a.model_copy(update={
                    "titulo": sanitize_text(conf.evento_a.titulo),
                    "descripcion": sanitize_text(conf.evento_a.descripcion),
                }),
                "evento_b": conf.evento_b.model_copy(update={
                    "titulo": sanitize_text(conf.evento_b.titulo),
                    "descripcion": sanitize_text(conf.evento_b.descripcion),
                }),
            })
            for conf in conflictos_completos
            if conf.evento_a.fecha_inicio.astimezone(timezone.utc).date() == hoy_utc
            or conf.evento_b.fecha_inicio.astimezone(timezone.utc).date() == hoy_utc
        ]

        # 3. Sanitizar alimentos de la despensa (model_copy para no mutar el DTO original)
        alertas_despensa = alertas_despensa.model_copy(update={
            "alertas_caducidad": [
                alt.model_copy(update={"nombre": sanitize_text(alt.nombre)})
                for alt in alertas_despensa.alertas_caducidad
            ]
        })

        # 4. Mapear y sanitizar tareas pendientes
        tareas_pendientes: List[TareaHogarResponse] = [
            TareaHogarResponse.model_validate(tarea).model_copy(update={
                "nombre": sanitize_text(tarea.nombre),
                "asignado_a": sanitize_text(tarea.asignado_a),
            })
            for tarea in tareas_db
        ]

        context = DashboardUnifiedContext(
            fecha=hoy_utc.isoformat(),
            eventos_hoy=eventos_hoy,
            alertas_despensa=alertas_despensa,
            tareas_pendientes=tareas_pendientes,
            conflictos_agenda=conflictos_hoy
        )

        # Generar briefing de texto con IA (Gemini) o fallback de contingencia ante fallos.
        # El flag briefing_generado_por_ia activa el aviso de transparencia (EU AI Act art. 50)
        # en el cliente solo cuando el texto proviene realmente del modelo.
        context.briefing_texto, context.briefing_generado_por_ia = await generate_morning_briefing(context)

        return context
