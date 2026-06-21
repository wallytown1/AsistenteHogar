import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import RecetaHistorial
from app.schemas.schemas import RecetaHistorialCreate


class RecetaHistorialRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def registrar(
        self, hogar_id: uuid.UUID, schema: RecetaHistorialCreate
    ) -> RecetaHistorial:
        """Guarda una acción del hogar sobre una receta (cocinada o rechazada)."""
        entrada = RecetaHistorial(
            hogar_id=hogar_id,
            nombre_receta=schema.nombre_receta,
            accion=schema.accion,
            valoracion=schema.valoracion,
            categoria=schema.categoria,
        )
        self.session.add(entrada)
        await self.session.commit()
        await self.session.refresh(entrada)
        return entrada

    async def get_recientes(
        self, hogar_id: uuid.UUID, limit: int = 20
    ) -> list[RecetaHistorial]:
        """Devuelve las últimas `limit` entradas del historial del hogar, más reciente primero."""
        stmt = (
            select(RecetaHistorial)
            .where(RecetaHistorial.hogar_id == hogar_id)
            .order_by(RecetaHistorial.cocinada_en.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def contar(self, hogar_id: uuid.UUID) -> int:
        """Total de acciones registradas por el hogar (para detectar memoria obsoleta)."""
        stmt = select(func.count()).where(RecetaHistorial.hogar_id == hogar_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
