import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import get_historial_service, get_hogar_id
from app.schemas.schemas import RecetaHistorialCreate, RecetaHistorialResponse
from app.services.historial import RecetaHistorialService

router = APIRouter(tags=["Historial Recetas"])


@router.post(
    "/pantry/recetas/historial",
    response_model=RecetaHistorialResponse,
    status_code=status.HTTP_201_CREATED,
)
async def registrar_accion_receta(
    schema: RecetaHistorialCreate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    historial_service: RecetaHistorialService = Depends(get_historial_service),
) -> RecetaHistorialResponse:
    """Registra que el hogar cocinó o rechazó una receta sugerida.

    Este historial se inyecta en futuros prompts de Gemini para evitar
    repetir recetas recientes y evitar las rechazadas.
    """
    return await historial_service.registrar_accion(hogar_id, schema)


@router.get(
    "/pantry/recetas/historial",
    response_model=list[RecetaHistorialResponse],
)
async def get_historial_recetas(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    historial_service: RecetaHistorialService = Depends(get_historial_service),
) -> list[RecetaHistorialResponse]:
    """Devuelve las últimas 20 acciones del hogar sobre recetas sugeridas."""
    return await historial_service.get_historial(hogar_id)
