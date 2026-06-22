import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import MemoriaGustos


class MemoriaGustosRepository:
    """Acceso a la memoria de gustos destilada del hogar (una fila por hogar)."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_hogar(self, hogar_id: uuid.UUID) -> MemoriaGustos | None:
        stmt = select(MemoriaGustos).where(MemoriaGustos.hogar_id == hogar_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(
        self, hogar_id: uuid.UUID, resumen: str, senales_fuente: int
    ) -> MemoriaGustos:
        """Crea o actualiza la memoria del hogar con el resumen destilado."""
        memoria = await self.get_by_hogar(hogar_id)
        if memoria is None:
            memoria = MemoriaGustos(
                hogar_id=hogar_id,
                resumen=resumen,
                eventos_fuente=senales_fuente,
            )
            self.session.add(memoria)
        else:
            memoria.resumen = resumen
            memoria.eventos_fuente = senales_fuente
        await self.session.commit()
        await self.session.refresh(memoria)
        return memoria
