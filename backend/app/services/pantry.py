import uuid
from datetime import UTC, datetime, timedelta

from app.repositories.pantry import PantryRepository
from app.schemas.schemas import (
    InventarioAlimentoCreate,
    InventarioAlimentoResponse,
    InventarioAlimentoUpdate,
    PantryStockMetrics,
)


class PantryService:
    def __init__(self, pantry_repo: PantryRepository):
        self.pantry_repo = pantry_repo

    async def add_item(
        self, hogar_id: uuid.UUID, schema: InventarioAlimentoCreate
    ) -> InventarioAlimentoResponse:
        """Crea un nuevo alimento en la despensa."""
        item = await self.pantry_repo.create(hogar_id, schema)
        return InventarioAlimentoResponse.model_validate(item)

    async def update_item(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID, schema: InventarioAlimentoUpdate
    ) -> InventarioAlimentoResponse:
        """Actualiza un alimento de la despensa."""
        item = await self.pantry_repo.update(item_id, hogar_id, schema)
        return InventarioAlimentoResponse.model_validate(item)

    async def remove_item(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> InventarioAlimentoResponse:
        """Elimina de forma lógica un alimento de la despensa."""
        item = await self.pantry_repo.delete(item_id, hogar_id)
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
