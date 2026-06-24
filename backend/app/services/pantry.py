import logging
import uuid
from datetime import UTC, date, datetime, timedelta

from app.repositories.movimientos import MovimientoDespensaRepository
from app.repositories.pantry import PantryRepository
from app.schemas.schemas import (
    InventarioAlimentoCreate,
    InventarioAlimentoResponse,
    InventarioAlimentoUpdate,
    PantryStockMetrics,
)

logger = logging.getLogger("app.pantry")


class PantryService:
    def __init__(
        self,
        pantry_repo: PantryRepository,
        movimientos_repo: MovimientoDespensaRepository | None = None,
    ):
        self.pantry_repo = pantry_repo
        self.movimientos_repo = movimientos_repo

    async def _registrar_movimiento(
        self,
        hogar_id: uuid.UUID,
        nombre: str,
        tipo: str,
        cantidad: float | None,
        unidad: str | None,
        origen: str,
        precio_unitario: float | None = None,
        fecha_compra: date | None = None,
    ) -> None:
        """Registra el movimiento en el ledger. Best-effort: un fallo aquí NUNCA debe
        romper la operación de despensa (el ledger es para aprender hábitos, no crítico)."""
        if self.movimientos_repo is None:
            return
        try:
            await self.movimientos_repo.registrar(
                hogar_id,
                nombre,
                tipo,
                cantidad,
                unidad,
                origen,
                precio_unitario=precio_unitario,
                fecha_compra=fecha_compra,
            )
        except Exception as e:  # — best-effort
            logger.warning(f"No se pudo registrar el movimiento de despensa: {e}")

    async def add_item(
        self,
        hogar_id: uuid.UUID,
        schema: InventarioAlimentoCreate,
        origen: str = "manual",
    ) -> InventarioAlimentoResponse:
        """Crea un nuevo alimento en la despensa y lo registra como 'compra'.

        Si el alta viene de un ticket parseado (trae precio_unitario), el precio y la
        fecha de compra se persisten en el ledger para alimentar el Informe de Ahorro."""
        item = await self.pantry_repo.create(hogar_id, schema)
        await self._registrar_movimiento(
            hogar_id,
            item.nombre,
            "compra",
            float(item.cantidad),
            item.unidad,
            origen,
            precio_unitario=schema.precio_unitario,
            fecha_compra=schema.fecha_compra,
        )
        return InventarioAlimentoResponse.model_validate(item)

    async def update_item(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID, schema: InventarioAlimentoUpdate
    ) -> InventarioAlimentoResponse:
        """Actualiza un alimento. Si cambia la cantidad, registra el delta como
        'consumo' (bajada) o 'compra' (subida)."""
        previo = await self.pantry_repo.get_by_id(item_id, hogar_id)
        cantidad_previa = float(previo.cantidad)
        item = await self.pantry_repo.update(item_id, hogar_id, schema)
        delta = float(item.cantidad) - cantidad_previa
        if abs(delta) > 1e-9:
            tipo = "consumo" if delta < 0 else "compra"
            await self._registrar_movimiento(
                hogar_id, item.nombre, tipo, abs(delta), item.unidad, "edicion"
            )
        return InventarioAlimentoResponse.model_validate(item)

    async def remove_item(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> InventarioAlimentoResponse:
        """Elimina (soft delete) un alimento. Lo registra como 'caducado' si ya había
        caducado, o 'consumo' en caso contrario."""
        item = await self.pantry_repo.delete(item_id, hogar_id)
        hoy = datetime.now(UTC).date()
        caducado = item.fecha_caducidad is not None and item.fecha_caducidad < hoy
        await self._registrar_movimiento(
            hogar_id,
            item.nombre,
            "caducado" if caducado else "consumo",
            float(item.cantidad),
            item.unidad,
            "manual",
        )
        return InventarioAlimentoResponse.model_validate(item)

    async def agotar_item(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> InventarioAlimentoResponse:
        """ "Se acabó": borra el alimento y lo registra como consumo con origen 'agotado'."""
        item = await self.pantry_repo.delete(item_id, hogar_id)
        await self._registrar_movimiento(
            hogar_id,
            item.nombre,
            "consumo",
            float(item.cantidad),
            item.unidad,
            "agotado",
        )
        return InventarioAlimentoResponse.model_validate(item)

    async def confirmar_item(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> InventarioAlimentoResponse:
        """ "Sigo teniéndolo": renueva la confianza (resetea ultima_confirmacion)."""
        item = await self.pantry_repo.confirmar(item_id, hogar_id)
        return InventarioAlimentoResponse.model_validate(item)

    async def restaurar_item(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> InventarioAlimentoResponse:
        """Undo de un agotado o descuento del chef: reactiva el alimento y compensa el ledger."""
        item = await self.pantry_repo.restaurar(item_id, hogar_id)
        await self._registrar_movimiento(
            hogar_id, item.nombre, "compra", float(item.cantidad), item.unidad, "undo"
        )
        return InventarioAlimentoResponse.model_validate(item)

    async def get_stock_metrics(self, hogar_id: uuid.UUID) -> PantryStockMetrics:
        """Calcula el porcentaje de stock de la despensa, las alertas de caducidad (6 días)
        y marca como 'incierto' lo que probablemente se ha consumido según la cadencia de
        compra del hogar (ledger). Consistencia de zona horaria en UTC."""
        items = await self.pantry_repo.get_all(hogar_id)

        hoy_utc = datetime.now(UTC).date()
        ahora = datetime.now(UTC)
        limite_alerta = hoy_utc + timedelta(days=6)

        # Cadencias de compra por alimento (días entre compras) para calcular incierto.
        intervalos: dict[str, float] = {}
        if self.movimientos_repo is not None:
            for h in await self.movimientos_repo.habitos_compra(hogar_id):
                if h.intervalo_medio_dias is not None:
                    intervalos[h.nombre] = h.intervalo_medio_dias

        def _a_respuesta(item: object) -> InventarioAlimentoResponse:
            resp = InventarioAlimentoResponse.model_validate(item)
            intervalo = intervalos.get(resp.nombre.strip().lower())
            if intervalo is not None and resp.ultima_confirmacion is not None:
                dias = (ahora - resp.ultima_confirmacion).total_seconds() / 86400.0
                resp.incierto = dias >= intervalo
            return resp

        items_disponibles = len(items)
        alertas_caducidad = []
        items_suficientes = 0
        items_resp: list[InventarioAlimentoResponse] = []

        for item in items:
            resp = _a_respuesta(item)
            items_resp.append(resp)

            if (
                item.fecha_caducidad is not None
                and item.fecha_caducidad <= limite_alerta
            ):
                alertas_caducidad.append(resp)

            threshold = 2.0 if item.categoria in ["Lácteos", "Carnes"] else 1.0
            if item.cantidad >= threshold:
                items_suficientes += 1

        if items_disponibles == 0:
            porcentaje_stock = 100.0
        else:
            porcentaje_stock = round((items_suficientes / items_disponibles) * 100.0, 2)
            porcentaje_stock = max(0.0, min(100.0, porcentaje_stock))

        return PantryStockMetrics(
            porcentaje_stock=porcentaje_stock,
            items_disponibles=items_disponibles,
            alertas_caducidad=alertas_caducidad,
            items=items_resp,
        )
