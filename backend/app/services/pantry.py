import logging
import uuid
from datetime import UTC, datetime, timedelta

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
    ) -> None:
        """Registra el movimiento en el ledger. Best-effort: un fallo aquí NUNCA debe
        romper la operación de despensa (el ledger es para aprender hábitos, no crítico)."""
        if self.movimientos_repo is None:
            return
        try:
            await self.movimientos_repo.registrar(
                hogar_id, nombre, tipo, cantidad, unidad, origen
            )
        except Exception as e:  # — best-effort
            logger.warning(f"No se pudo registrar el movimiento de despensa: {e}")

    async def add_item(
        self,
        hogar_id: uuid.UUID,
        schema: InventarioAlimentoCreate,
        origen: str = "manual",
    ) -> InventarioAlimentoResponse:
        """Crea un nuevo alimento en la despensa y lo registra como 'compra'."""
        item = await self.pantry_repo.create(hogar_id, schema)
        await self._registrar_movimiento(
            hogar_id, item.nombre, "compra", float(item.cantidad), item.unidad, origen
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

    async def get_stock_metrics(self, hogar_id: uuid.UUID) -> PantryStockMetrics:
        """Calcula el porcentaje de stock de la despensa y recolecta alertas de caducidad
        próximas en los siguientes 6 días utilizando consistencia de zona horaria UTC."""
        items = await self.pantry_repo.get_all(hogar_id)

        # Consistencia de zona horaria: fecha actual en UTC
        hoy_utc = datetime.now(UTC).date()
        limite_alerta = hoy_utc + timedelta(days=6)

        items_disponibles = len(items)
        alertas_caducidad = []
        items_suficientes = 0

        for item in items:
            # 1. Alertas de caducidad (fecha_caducidad <= hoy + 6 días)
            if item.fecha_caducidad is not None:
                # Comparamos objetos date puros
                if item.fecha_caducidad <= limite_alerta:
                    alertas_caducidad.append(
                        InventarioAlimentoResponse.model_validate(item)
                    )

            # 2. Lógica para determinar stock suficiente
            # Umbral de stock: Categorías perecederas (Lácteos/Carnes) = 2.0, otros = 1.0
            threshold = 2.0 if item.categoria in ["Lácteos", "Carnes"] else 1.0
            if item.cantidad >= threshold:
                items_suficientes += 1

        # Calcular porcentaje de stock (rango [0.0, 100.0] estricto)
        if items_disponibles == 0:
            porcentaje_stock = 100.0
        else:
            porcentaje_stock = round((items_suficientes / items_disponibles) * 100.0, 2)
            # Asegurar límites por si acaso
            porcentaje_stock = max(0.0, min(100.0, porcentaje_stock))

        return PantryStockMetrics(
            porcentaje_stock=porcentaje_stock,
            items_disponibles=items_disponibles,
            alertas_caducidad=alertas_caducidad,
            items=[InventarioAlimentoResponse.model_validate(item) for item in items],
        )
