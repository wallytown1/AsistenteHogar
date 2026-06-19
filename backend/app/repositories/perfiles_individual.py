"""Repositorio para perfiles individuales de miembros del hogar (Fase 3)."""
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import PerfilIndividual
from app.repositories.exceptions import ItemNotFoundError, ReglaNegocioError
from app.schemas.schemas import PerfilIndividualCreate, PerfilIndividualUpdate

MAX_PERFILES_POR_HOGAR = 10


class PerfilIndividualRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_hogar(self, hogar_id: uuid.UUID) -> list[PerfilIndividual]:
        result = await self._session.execute(
            select(PerfilIndividual)
            .where(
                PerfilIndividual.hogar_id == hogar_id,
                PerfilIndividual.is_deleted.is_(False),
            )
            .order_by(PerfilIndividual.created_at)
        )
        return list(result.scalars().all())

    async def get_by_id(
        self, perfil_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> PerfilIndividual:
        result = await self._session.execute(
            select(PerfilIndividual).where(
                PerfilIndividual.id == perfil_id,
                PerfilIndividual.hogar_id == hogar_id,
                PerfilIndividual.is_deleted.is_(False),
            )
        )
        perfil = result.scalar_one_or_none()
        if perfil is None:
            raise ItemNotFoundError(str(perfil_id), str(hogar_id))
        return perfil

    async def create(
        self, hogar_id: uuid.UUID, data: PerfilIndividualCreate
    ) -> PerfilIndividual:
        count_result = await self._session.execute(
            select(PerfilIndividual).where(
                PerfilIndividual.hogar_id == hogar_id,
                PerfilIndividual.is_deleted.is_(False),
            )
        )
        if len(count_result.scalars().all()) >= MAX_PERFILES_POR_HOGAR:
            raise ReglaNegocioError(
                f"El hogar no puede tener más de {MAX_PERFILES_POR_HOGAR} perfiles individuales"
            )
        perfil = PerfilIndividual(
            id=uuid.uuid4(),
            hogar_id=hogar_id,
            nombre=data.nombre,
            preferencias_dieta=data.preferencias_dieta,
            excluir_ingredientes=data.excluir_ingredientes,
        )
        self._session.add(perfil)
        await self._session.commit()
        await self._session.refresh(perfil)
        return perfil

    async def update(
        self, perfil_id: uuid.UUID, hogar_id: uuid.UUID, data: PerfilIndividualUpdate
    ) -> PerfilIndividual:
        perfil = await self.get_by_id(perfil_id, hogar_id)
        if data.nombre is not None:
            perfil.nombre = data.nombre
        if data.preferencias_dieta is not None:
            perfil.preferencias_dieta = data.preferencias_dieta
        if data.excluir_ingredientes is not None:
            perfil.excluir_ingredientes = data.excluir_ingredientes
        perfil.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(perfil)
        return perfil

    async def delete(self, perfil_id: uuid.UUID, hogar_id: uuid.UUID) -> None:
        perfil = await self.get_by_id(perfil_id, hogar_id)
        perfil.is_deleted = True
        perfil.updated_at = datetime.now(UTC)
        await self._session.commit()
