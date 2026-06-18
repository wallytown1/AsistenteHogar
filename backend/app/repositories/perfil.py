import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import PerfilHogar
from app.repositories.exceptions import DatabaseIntegrityError
from app.schemas.schemas import OnboardingRequest


class PerfilHogarRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_hogar(self, hogar_id: uuid.UUID) -> PerfilHogar | None:
        """Devuelve el perfil del hogar, o None si aún no ha hecho onboarding."""
        stmt = select(PerfilHogar).where(PerfilHogar.hogar_id == hogar_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(
        self, hogar_id: uuid.UUID, schema: OnboardingRequest
    ) -> PerfilHogar:
        """Crea o actualiza el perfil del hogar (un único perfil por hogar)."""
        perfil = await self.get_by_hogar(hogar_id)
        if perfil is None:
            perfil = PerfilHogar(
                hogar_id=hogar_id,
                gustos_culinarios=schema.gustos_culinarios,
                num_comensales=schema.num_comensales,
            )
            self.session.add(perfil)
        else:
            perfil.gustos_culinarios = schema.gustos_culinarios
            perfil.num_comensales = schema.num_comensales

        try:
            await self.session.commit()
            await self.session.refresh(perfil)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig)) from e
        return perfil
