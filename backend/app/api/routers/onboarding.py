import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_hogar_id, get_onboarding_service
from app.schemas.schemas import OnboardingRequest, PerfilHogarResponse
from app.services.onboarding import OnboardingService

router = APIRouter(tags=["Onboarding"])


@router.get("/onboarding", response_model=PerfilHogarResponse)
async def get_perfil_hogar(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    service: OnboardingService = Depends(get_onboarding_service),
) -> PerfilHogarResponse:
    """Devuelve el perfil de onboarding del hogar autenticado."""
    perfil = await service.get_perfil(hogar_id)
    if perfil is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El hogar aún no ha completado el onboarding.",
        )
    return perfil


@router.post("/onboarding", response_model=PerfilHogarResponse)
async def guardar_perfil_hogar(
    schema: OnboardingRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    service: OnboardingService = Depends(get_onboarding_service),
) -> PerfilHogarResponse:
    """Guarda (upsert) el perfil del hogar desde la encuesta de onboarding.

    El hogar_id proviene siempre del JWT (aislamiento multi-tenant). El perfil se
    usará para personalizar las recetas; nunca lo escribe la IA por su cuenta.
    """
    return await service.guardar_perfil(hogar_id, schema)
