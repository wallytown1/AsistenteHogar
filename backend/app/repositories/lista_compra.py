import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ListaCompraItem
from app.repositories.exceptions import ItemNotFoundError
from app.schemas.schemas import ListaCompraItemCreate, ListaCompraItemUpdate


class ListaCompraRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_hogar(self, hogar_id: uuid.UUID) -> list[ListaCompraItem]:
        result = await self._session.execute(
            select(ListaCompraItem)
            .where(
                ListaCompraItem.hogar_id == hogar_id,
                ListaCompraItem.is_deleted.is_(False),
            )
            .order_by(ListaCompraItem.is_checked, ListaCompraItem.created_at)
        )
        return list(result.scalars().all())

    async def create(
        self, hogar_id: uuid.UUID, data: ListaCompraItemCreate
    ) -> ListaCompraItem:
        item = ListaCompraItem(
            hogar_id=hogar_id,
            nombre=data.nombre,
            cantidad=data.cantidad,
            unidad=data.unidad,
        )
        self._session.add(item)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def get_by_id(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> ListaCompraItem:
        result = await self._session.execute(
            select(ListaCompraItem).where(
                ListaCompraItem.id == item_id,
                ListaCompraItem.hogar_id == hogar_id,
                ListaCompraItem.is_deleted.is_(False),
            )
        )
        item = result.scalar_one_or_none()
        if item is None:
            raise ItemNotFoundError(str(item_id), str(hogar_id))
        return item

    async def update(
        self, item_id: uuid.UUID, hogar_id: uuid.UUID, data: ListaCompraItemUpdate
    ) -> ListaCompraItem:
        item = await self.get_by_id(item_id, hogar_id)
        cambios = data.model_dump(exclude_unset=True)
        for campo, valor in cambios.items():
            setattr(item, campo, valor)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def delete(self, item_id: uuid.UUID, hogar_id: uuid.UUID) -> None:
        item = await self.get_by_id(item_id, hogar_id)
        item.is_deleted = True
        await self._session.commit()

    async def delete_checked(self, hogar_id: uuid.UUID) -> None:
        await self._session.execute(
            update(ListaCompraItem)
            .where(
                ListaCompraItem.hogar_id == hogar_id,
                ListaCompraItem.is_checked.is_(True),
                ListaCompraItem.is_deleted.is_(False),
            )
            .values(is_deleted=True)
        )
        await self._session.commit()
