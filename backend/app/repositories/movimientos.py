import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import MovimientoDespensa
from app.schemas.schemas import ConsumoItem, HabitoCompraItem


class MovimientoDespensaRepository:
    """Ledger de movimientos de la despensa: registra entradas/salidas y deriva los
    hábitos de compra/consumo del hogar (para afinar las sugerencias)."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def registrar(
        self,
        hogar_id: uuid.UUID,
        nombre: str,
        tipo: str,
        cantidad: float | None = None,
        unidad: str | None = None,
        origen: str = "manual",
    ) -> MovimientoDespensa:
        """Registra un movimiento (compra/consumo/caducado/ajuste). El nombre se
        normaliza a minúsculas para que los agregados no se fragmenten por mayúsculas."""
        mov = MovimientoDespensa(
            hogar_id=hogar_id,
            nombre=nombre.strip().lower(),
            tipo=tipo,
            cantidad=cantidad,
            unidad=unidad,
            origen=origen,
        )
        self.session.add(mov)
        await self.session.commit()
        await self.session.refresh(mov)
        return mov

    async def habitos_compra(
        self, hogar_id: uuid.UUID, dias: int = 180, limite: int = 20
    ) -> list[HabitoCompraItem]:
        """Agrega las compras del hogar por alimento en los últimos `dias`: veces,
        última compra, cantidad habitual y un intervalo medio aproximado entre compras
        (span / (veces-1)). Ordenado por frecuencia descendente."""
        desde = datetime.now(UTC) - timedelta(days=dias)
        stmt = (
            select(
                MovimientoDespensa.nombre,
                func.count().label("veces"),
                func.min(MovimientoDespensa.fecha).label("primera"),
                func.max(MovimientoDespensa.fecha).label("ultima"),
                func.avg(MovimientoDespensa.cantidad).label("cantidad_media"),
            )
            .where(
                MovimientoDespensa.hogar_id == hogar_id,
                MovimientoDespensa.tipo == "compra",
                MovimientoDespensa.fecha >= desde,
            )
            .group_by(MovimientoDespensa.nombre)
            .order_by(func.count().desc())
            .limit(limite)
        )
        result = await self.session.execute(stmt)

        habitos: list[HabitoCompraItem] = []
        for row in result.all():
            veces = int(row.veces)
            intervalo: float | None = None
            if veces > 1 and row.primera is not None and row.ultima is not None:
                span_dias = (row.ultima - row.primera).total_seconds() / 86400.0
                intervalo = round(span_dias / (veces - 1), 1) if span_dias > 0 else None
            habitos.append(
                HabitoCompraItem(
                    nombre=row.nombre,
                    veces=veces,
                    ultima_compra=row.ultima,
                    intervalo_medio_dias=intervalo,
                    cantidad_habitual=(
                        round(float(row.cantidad_media), 2)
                        if row.cantidad_media is not None
                        else None
                    ),
                )
            )
        return habitos

    async def ritmo_consumo(
        self, hogar_id: uuid.UUID, dias: int = 180, limite: int = 20
    ) -> list[ConsumoItem]:
        """Agrega el consumo del hogar por alimento en los últimos `dias`: veces,
        cantidad total consumida y fecha del último consumo. Ordenado por frecuencia."""
        desde = datetime.now(UTC) - timedelta(days=dias)
        stmt = (
            select(
                MovimientoDespensa.nombre,
                func.count().label("veces"),
                func.sum(MovimientoDespensa.cantidad).label("cantidad_total"),
                func.max(MovimientoDespensa.fecha).label("ultimo"),
            )
            .where(
                MovimientoDespensa.hogar_id == hogar_id,
                MovimientoDespensa.tipo == "consumo",
                MovimientoDespensa.fecha >= desde,
            )
            .group_by(MovimientoDespensa.nombre)
            .order_by(func.count().desc())
            .limit(limite)
        )
        result = await self.session.execute(stmt)
        return [
            ConsumoItem(
                nombre=row.nombre,
                veces=int(row.veces),
                cantidad_total=(
                    round(float(row.cantidad_total), 2)
                    if row.cantidad_total is not None
                    else None
                ),
                ultimo=row.ultimo,
            )
            for row in result.all()
        ]

    async def purge_old_movements(self, retention_months: int = 12) -> int:
        """Borrado FÍSICO de los movimientos de despensa con antigüedad superior a
        retention_months meses (RGPD art. 5.1.e).

        Operación de mantenimiento cross-tenant. No hace commit."""
        cutoff = datetime.now(UTC) - timedelta(days=retention_months * 30)
        stmt = delete(MovimientoDespensa).where(MovimientoDespensa.fecha < cutoff)
        result = await self.session.execute(stmt)
        return cast("CursorResult[Any]", result).rowcount or 0
