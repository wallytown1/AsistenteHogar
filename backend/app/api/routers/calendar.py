import uuid

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.api.deps import get_calendar_service, get_hogar_id, requiere_premium
from app.core.rate_limit import interpretar_rate_limiter
from app.schemas.schemas import (
    CalendarAgendaResponse,
    EventoCalendarioCreate,
    EventoCalendarioResponse,
    EventoCalendarioUpdate,
    InterpretarEventoRequest,
    InterpretarEventoResponse,
)
from app.services.calendar import CalendarService
from app.services.llm import interpret_event_text

router = APIRouter(tags=["Calendar"])


@router.get("/calendar", response_model=CalendarAgendaResponse)
async def get_calendar_agenda(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    calendar_service: CalendarService = Depends(get_calendar_service),
) -> CalendarAgendaResponse:
    """Obtiene la agenda del calendario y detecta conflictos de solapamiento para el Hogar, filtrado por cabecera."""
    agenda, conflictos = await calendar_service.get_household_agenda(hogar_id)
    return CalendarAgendaResponse(eventos=agenda, conflictos=conflictos)


@router.post(
    "/calendar",
    response_model=EventoCalendarioResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_calendar_event(
    schema: EventoCalendarioCreate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    calendar_service: CalendarService = Depends(get_calendar_service),
) -> EventoCalendarioResponse:
    """Crea un nuevo evento en el calendario familiar."""
    return await calendar_service.add_event(hogar_id, schema)


@router.post(
    "/calendar/interpretar",
    response_model=InterpretarEventoResponse,
    dependencies=[Depends(requiere_premium), Depends(interpretar_rate_limiter)],
)
async def interpretar_evento(
    schema: InterpretarEventoRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> InterpretarEventoResponse:
    """Interpreta texto en lenguaje natural y devuelve una PROPUESTA de evento.

    IA pasiva: nunca crea el evento; el cliente debe confirmar y llamar a POST /calendar.
    La dependencia de hogar_id solo exige autenticación.
    """
    return await interpret_event_text(schema.texto, schema.fecha_referencia)


@router.patch("/calendar/{evento_id}", response_model=EventoCalendarioResponse)
async def patch_calendar_event(
    evento_id: uuid.UUID = Path(..., description="UUID del evento a actualizar"),
    schema: EventoCalendarioUpdate | None = None,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    calendar_service: CalendarService = Depends(get_calendar_service),
) -> EventoCalendarioResponse:
    """Actualiza parcialmente un evento del calendario familiar (título, fechas, participantes).

    Un evento inexistente o de otro hogar provoca EventoNotFoundError, que el
    manejador global mapea a 404 (garantizando el aislamiento multi-tenant).
    """
    if not schema:
        raise HTTPException(
            status_code=400, detail="Cuerpo de actualización vacío o no proporcionado."
        )
    return await calendar_service.update_event(evento_id, hogar_id, schema)


@router.delete("/calendar/{evento_id}", response_model=EventoCalendarioResponse)
async def delete_calendar_event(
    evento_id: uuid.UUID = Path(..., description="UUID del evento a eliminar"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    calendar_service: CalendarService = Depends(get_calendar_service),
) -> EventoCalendarioResponse:
    """Elimina lógicamente un evento de la agenda familiar (soft delete)."""
    return await calendar_service.remove_event(evento_id, hogar_id)
