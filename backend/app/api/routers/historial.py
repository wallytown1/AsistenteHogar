import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import get_historial_service, get_hogar_id, get_perfiles_repo
from app.repositories.perfiles_individual import PerfilIndividualRepository
from app.schemas.schemas import (
    PerfilIndividualUpdate,
    RecetaHistorialCreate,
    RecetaHistorialResponse,
    RechazarIngredienteRequest,
    RechazarIngredienteResponse,
)
from app.services.historial import RecetaHistorialService
from app.services.llm import identify_rejected_ingredients

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


@router.post(
    "/pantry/recetas/rechazar-ingrediente",
    response_model=RechazarIngredienteResponse,
)
async def rechazar_ingrediente(
    schema: RechazarIngredienteRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    perfiles_repo: PerfilIndividualRepository = Depends(get_perfiles_repo),
) -> RechazarIngredienteResponse:
    """Identifica los ingredientes problemáticos de una receta rechazada y los añade
    al perfil individual indicado. Escritura de bajo riesgo y reversible: el frontend
    ofrece undo visible. El perfil_id debe pertenecer al hogar del token JWT."""
    perfil = await perfiles_repo.get_by_id(schema.perfil_id, hogar_id)
    nuevos = await identify_rejected_ingredients(
        schema.nombre_receta,
        schema.ingredientes_receta,
        perfil.excluir_ingredientes,
    )
    if nuevos:
        actualizado = list(set(perfil.excluir_ingredientes) | set(nuevos))
        perfil = await perfiles_repo.update(
            schema.perfil_id,
            hogar_id,
            PerfilIndividualUpdate(excluir_ingredientes=actualizado),
        )
        return RechazarIngredienteResponse(
            perfil_id=perfil.id,
            nombre_perfil=perfil.nombre,
            ingredientes_anadidos=nuevos,
            excluir_ingredientes_actualizado=perfil.excluir_ingredientes,
            generado_por_ia=True,
        )
    return RechazarIngredienteResponse(
        perfil_id=perfil.id,
        nombre_perfil=perfil.nombre,
        ingredientes_anadidos=[],
        excluir_ingredientes_actualizado=perfil.excluir_ingredientes,
        generado_por_ia=False,
        mensaje="No se identificaron ingredientes problemáticos.",
    )
