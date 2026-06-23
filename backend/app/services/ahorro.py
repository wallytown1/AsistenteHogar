"""AhorroService — calcula el Informe de Ahorro mensual.

North Star Metric de AsistenteHogar: € ahorrados/mes por hogar activo,
cruzando movimientos de consumo con precios de tickets importados.

Referencias:
  - Media española de desperdicio: 31 kg/persona/año (MAPA 2024)
  - Coste medio comida casera: 3.50 €/comida (Ministerio de Consumo 2024)
  - Kg estimados por receta cocinada: 0.35 kg (ingredientes aprovechados)
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import MovimientoDespensa, PerfilHogar, RecetaHistorial
from app.schemas.schemas import (
    AhorroPreviewResponse,
    AhorroResumenResponse,
    DesgloseMensualItem,
)

_PRECIO_MEDIO_COMIDA = Decimal("3.50")
_KG_PERSONA_MES_MEDIA = 2.58  # MAPA 2024
_KG_POR_RECETA = 0.35


def _rango_mes(mes: date) -> tuple[datetime, datetime]:
    inicio = date(mes.year, mes.month, 1)
    if mes.month == 12:
        fin = date(mes.year + 1, 1, 1)
    else:
        fin = date(mes.year, mes.month + 1, 1)
    tz = UTC
    return datetime(inicio.year, inicio.month, 1, tzinfo=tz), datetime(
        fin.year, fin.month, 1, tzinfo=tz
    )


class AhorroService:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def _num_comensales(self, hogar_id: uuid.UUID) -> int:
        row = await self._s.scalar(
            select(PerfilHogar.num_comensales).where(PerfilHogar.hogar_id == hogar_id)
        )
        return int(row) if row else 2

    async def _contar_recetas(
        self, hogar_id: uuid.UUID, inicio: datetime, fin: datetime
    ) -> int:
        row = await self._s.scalar(
            select(func.count()).where(
                RecetaHistorial.hogar_id == hogar_id,
                RecetaHistorial.accion == "cocinada",
                RecetaHistorial.cocinada_en >= inicio,
                RecetaHistorial.cocinada_en < fin,
            )
        )
        return int(row or 0)

    async def calcular_preview(
        self, hogar_id: uuid.UUID, mes: date
    ) -> AhorroPreviewResponse:
        inicio, fin = _rango_mes(mes)
        recetas = await self._contar_recetas(hogar_id, inicio, fin)
        ahorro_est = round(float(Decimal(str(recetas)) * _PRECIO_MEDIO_COMIDA), 2)

        tiene_datos = await self._s.scalar(
            select(func.count()).where(
                MovimientoDespensa.hogar_id == hogar_id,
                MovimientoDespensa.tipo == "compra",
                MovimientoDespensa.precio_unitario.is_not(None),
                MovimientoDespensa.fecha >= inicio,
                MovimientoDespensa.fecha < fin,
            )
        )

        return AhorroPreviewResponse(
            mes=date(mes.year, mes.month, 1).strftime("%Y-%m"),
            recetas_cocinadas=recetas,
            ahorro_estimado_eur=ahorro_est,
            tiene_datos_reales=int(tiene_datos or 0) > 0,
        )

    async def calcular_resumen(
        self, hogar_id: uuid.UUID, mes: date
    ) -> AhorroResumenResponse:
        inicio, fin = _rango_mes(mes)
        recetas = await self._contar_recetas(hogar_id, inicio, fin)
        num_comensales = await self._num_comensales(hogar_id)

        # Consumos del mes agrupados por nombre + unidad
        consumos_result = await self._s.execute(
            select(
                MovimientoDespensa.nombre,
                func.sum(MovimientoDespensa.cantidad).label("cantidad_total"),
                MovimientoDespensa.unidad,
            )
            .where(
                MovimientoDespensa.hogar_id == hogar_id,
                MovimientoDespensa.tipo == "consumo",
                MovimientoDespensa.fecha >= inicio,
                MovimientoDespensa.fecha < fin,
                MovimientoDespensa.cantidad.is_not(None),
            )
            .group_by(MovimientoDespensa.nombre, MovimientoDespensa.unidad)
        )
        consumos: dict[tuple[str, str | None], float] = {
            (r.nombre, r.unidad): float(r.cantidad_total) for r in consumos_result
        }

        # Precio medio por ingrediente: últimos 180 días (incluye el mes actual)
        hace_180 = inicio - timedelta(days=180)
        precios_result = await self._s.execute(
            select(
                MovimientoDespensa.nombre,
                func.avg(MovimientoDespensa.precio_unitario).label("precio_medio"),
            )
            .where(
                MovimientoDespensa.hogar_id == hogar_id,
                MovimientoDespensa.tipo == "compra",
                MovimientoDespensa.precio_unitario.is_not(None),
                MovimientoDespensa.fecha >= hace_180,
            )
            .group_by(MovimientoDespensa.nombre)
        )
        precios: dict[str, float] = {
            r.nombre: float(r.precio_medio) for r in precios_result
        }

        # Entradas de compra con precio en el mes (de tickets importados)
        tickets_count = int(
            (
                await self._s.scalar(
                    select(func.count()).where(
                        MovimientoDespensa.hogar_id == hogar_id,
                        MovimientoDespensa.tipo == "compra",
                        MovimientoDespensa.precio_unitario.is_not(None),
                        MovimientoDespensa.fecha >= inicio,
                        MovimientoDespensa.fecha < fin,
                    )
                )
            )
            or 0
        )

        # Construir desglose: ingredientes consumidos con precio conocido
        desglose: list[DesgloseMensualItem] = []
        for (nombre, unidad), cantidad in consumos.items():
            precio_m = precios.get(nombre)
            if precio_m and cantidad:
                desglose.append(
                    DesgloseMensualItem(
                        nombre=nombre,
                        cantidad_total=round(cantidad, 3),
                        unidad=unidad or "ud",
                        precio_unitario_medio=round(precio_m, 4),
                        valor_total=round(cantidad * precio_m, 2),
                    )
                )
        desglose.sort(key=lambda x: -x.valor_total)

        ahorro_real: float | None = (
            round(sum(d.valor_total for d in desglose), 2) if desglose else None
        )
        ahorro_est = round(float(Decimal(str(recetas)) * _PRECIO_MEDIO_COMIDA), 2)

        kg_saved = round(recetas * _KG_POR_RECETA, 2)
        media_hogar = _KG_PERSONA_MES_MEDIA * max(num_comensales, 1)
        pct = (
            min(100, int(round(kg_saved / media_hogar * 100))) if media_hogar > 0 else 0
        )

        return AhorroResumenResponse(
            mes=date(mes.year, mes.month, 1).strftime("%Y-%m"),
            recetas_cocinadas=recetas,
            ahorro_real_eur=ahorro_real,
            ahorro_estimado_eur=ahorro_est,
            tiene_datos_reales=bool(desglose),
            kg_no_desperdiciados=kg_saved,
            porcentaje_media_espana=pct,
            num_comensales=num_comensales,
            tickets_analizados=tickets_count,
            desglose=desglose[:20],
        )
