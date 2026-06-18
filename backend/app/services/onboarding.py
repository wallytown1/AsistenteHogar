import uuid

from app.repositories.perfil import PerfilHogarRepository
from app.schemas.schemas import OnboardingRequest, PerfilHogarResponse


class OnboardingService:
    def __init__(self, perfil_repo: PerfilHogarRepository):
        self.perfil_repo = perfil_repo

    async def get_perfil(self, hogar_id: uuid.UUID) -> PerfilHogarResponse | None:
        """Devuelve el perfil del hogar, o None si aún no ha completado el onboarding."""
        perfil = await self.perfil_repo.get_by_hogar(hogar_id)
        return PerfilHogarResponse.model_validate(perfil) if perfil else None

    async def guardar_perfil(
        self, hogar_id: uuid.UUID, schema: OnboardingRequest
    ) -> PerfilHogarResponse:
        """Guarda (upsert) el perfil del hogar a partir de la encuesta de onboarding."""
        perfil = await self.perfil_repo.upsert(hogar_id, schema)
        return PerfilHogarResponse.model_validate(perfil)
