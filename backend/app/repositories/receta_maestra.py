import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import RecetaMaestra
from app.repositories.exceptions import ItemNotFoundError


class RecetaMaestraRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self, activa_only: bool = False) -> list[RecetaMaestra]:
        q = select(RecetaMaestra)
        if activa_only:
            q = q.where(RecetaMaestra.activa.is_(True))
        q = q.order_by(RecetaMaestra.nombre)
        result = await self._session.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, receta_id: uuid.UUID) -> RecetaMaestra:
        result = await self._session.execute(
            select(RecetaMaestra).where(RecetaMaestra.id == receta_id)
        )
        receta = result.scalar_one_or_none()
        if receta is None:
            raise ItemNotFoundError(str(receta_id), "admin")
        return receta

    async def create(
        self,
        nombre: str,
        ingredientes: list[str],
        pasos: list[str],
        categoria: str,
        temporada: str | None,
        aprovechamiento: bool,
    ) -> RecetaMaestra:
        receta = RecetaMaestra(
            nombre=nombre,
            ingredientes=ingredientes,
            pasos=pasos,
            categoria=categoria,
            temporada=temporada,
            aprovechamiento=aprovechamiento,
        )
        self._session.add(receta)
        await self._session.flush()
        await self._session.refresh(receta)
        return receta

    async def update(self, receta_id: uuid.UUID, **kwargs: object) -> RecetaMaestra:
        receta = await self.get_by_id(receta_id)
        for field, value in kwargs.items():
            if value is not None:
                setattr(receta, field, value)
        await self._session.flush()
        await self._session.refresh(receta)
        return receta

    async def delete(self, receta_id: uuid.UUID) -> None:
        receta = await self.get_by_id(receta_id)
        await self._session.delete(receta)
        await self._session.flush()
