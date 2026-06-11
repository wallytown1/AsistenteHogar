from fastapi import APIRouter, Depends, Path, status
import uuid

from app.api.deps import get_hogar_id, get_calendar_service
from app.services.calendar import CalendarService
from app.services.llm import interpret_event_text
from app.schemas.schemas import (
    CalendarAgendaResponse,
    EventoCalendarioCreate,
    EventoCalendarioResponse,
    InterpretarEventoRequest,
    InterpretarEventoResponse
)

router = APIRouter(tags=["Calendar"])

@router.get("/calendar", response_model=CalendarAgendaResponse)
async def get_calendar_agenda(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    calendar_service: CalendarService = Depends(get_calendar_service)
):
    """Obtiene la agenda del calendario y detecta conflictos de solapamiento para el Hogar, filtrado por cabecera."""
    agenda, conflictos = await calendar_service.get_household_agenda(hogar_id)
    return CalendarAgendaResponse(
        eventos=agenda,
        conflictos=conflictos
    )

@router.post("/calendar", response_model=EventoCalendarioResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    schema: EventoCalendarioCreate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    calendar_service: CalendarService = Depends(get_calendar_service)
):
    """Crea un nuevo evento en el calendario familiar."""
    return await calendar_service.add_event(hogar_id, schema)

@router.post("/calendar/interpretar", response_model=InterpretarEventoResponse)
async def interpretar_evento(
    schema: InterpretarEventoRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
):
    """Interpreta texto en lenguaje natural y devuelve una PROPUESTA de evento.

    IA pasiva: nunca crea el evento; el cliente debe confirmar y llamar a POST /calendar.
    La dependencia de hogar_id solo exige autenticación.
    """
    return await interpret_event_text(schema.texto, schema.fecha_referencia)

@router.delete("/calendar/{evento_id}", response_model=EventoCalendarioResponse)
async def delete_calendar_event(
    evento_id: uuid.UUID = Path(..., description="UUID del evento a eliminar"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    calendar_service: CalendarService = Depends(get_calendar_service)
):
    """Elimina lógicamente un evento de la agenda familiar (soft delete)."""
    return await calendar_service.remove_event(evento_id, hogar_id)
