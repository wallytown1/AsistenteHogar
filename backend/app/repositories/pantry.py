import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import InventarioAlimento
from app.repositories.exceptions import DatabaseIntegrityError, ItemNotFoundError
from app.schemas.schemas import InventarioAlimentoCreate, InventarioAlimentoUpdate


class PantryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID, lock: bool = False
    ) -> InventarioAlimento:
        """Obtiene un producto de la despensa por su ID y Hogar ID.
        Permite aplicar row-level locking (FOR UPDATE) para prevenir condiciones de carrera."""
        stmt = select(InventarioAlimento).where(
            InventarioAlimento.id == item_id,
            InventarioAlimento.hogar_id == hogar_id,
            InventarioAlimento.is_deleted == False,
        )
        if lock:
            # SELECT ... FOR UPDATE en PostgreSQL
            stmt = stmt.with_for_update()

        result = await self.session.execute(stmt)
        item = result.scalar_one_or_none()
        if not item:
            raise ItemNotFoundError(str(item_id), str(hogar_id))
        return item

    async def get_all(self, hogar_id: uuid.UUID) -> list[InventarioAlimento]:
        """Obtiene todos los productos activos de la despensa para un hogar específico."""
        stmt = (
            select(InventarioAlimento)
            .where(
                InventarioAlimento.hogar_id == hogar_id,
                InventarioAlimento.is_deleted == False,
            )
            .order_by(InventarioAlimento.nombre.asc())
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self, hogar_id: uuid.UUID, schema: InventarioAlimentoCreate
    ) -> InventarioAlimento:
        """Crea un nuevo producto en la despensa vinculado al hogar especificado."""
        db_item = InventarioAlimento(
            hogar_id=hogar_id,
            nombre=schema.nombre,
            cantidad=schema.cantidad,
            unidad=schema.unidad,
            fecha_caducidad=schema.fecha_caducidad,
            categoria=schema.categoria,
            is_deleted=False,
        )
        self.session.add(db_item)
        try:
            await self.session.commit()
            await self.session.refresh(db_item)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig)) from e
        return db_item

    async def update(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID, schema: InventarioAlimentoUpdate
    ) -> InventarioAlimento:
        """Actualiza un producto existente en la despensa aplicando row-level locking."""
        # Se obtiene el producto bloqueando la fila con FOR UPDATE para prevenir race conditions
        db_item = await self.get_by_id(item_id, hogar_id, lock=True)

        # Mapear los campos del esquema si están presentes
        update_data = schema.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_item, key, value)

        try:
            await self.session.commit()
            await self.session.refresh(db_item)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig)) from e
        return db_item

    async def confirmar(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> InventarioAlimento:
        """Renueva la confianza: fija ultima_confirmacion = ahora ('sigo teniéndolo')."""
        db_item = await self.get_by_id(item_id, hogar_id, lock=True)
        db_item.ultima_confirmacion = datetime.now(UTC)
        try:
            await self.session.commit()
            await self.session.refresh(db_item)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig)) from e
        return db_item

    async def delete(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> InventarioAlimento:
        """Elimina de forma lógica (soft delete) un producto de la despensa."""
        db_item = await self.get_by_id(item_id, hogar_id, lock=True)
        db_item.is_deleted = True

        try:
            await self.session.commit()
            await self.session.refresh(db_item)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig)) from e
        return db_item

    async def purge_expired(self, retention_days: int = 30) -> int:
        """Borrado FÍSICO de los productos con is_deleted=true cuya última
        modificación supera el plazo de retención (RGPD art. 5.1.e).

        Operación de mantenimiento cross-tenant: es la única excepción
        autorizada a las reglas 'todo método lleva hogar_id' y 'sin hard
        deletes' (ver 01_CONTEXTO_Y_ARQUITECTURA_APP.md §3.3). No hace commit:
        el PurgeService agrupa las tres tablas en una sola transacción."""
        cutoff = datetime.now(UTC) - timedelta(days=retention_days)
        stmt = delete(InventarioAlimento).where(
            InventarioAlimento.is_deleted == True,
            InventarioAlimento.updated_at < cutoff,
        )
        result = await self.session.execute(stmt)
        return cast("CursorResult[Any]", result).rowcount or 0
