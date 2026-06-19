import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_hogar_id
from app.database import get_async_session
from app.models.models import Usuario
from app.repositories.lista_compra import ListaCompraRepository
from app.schemas.schemas import (
    ListaCompraItemCreate,
    ListaCompraItemResponse,
    ListaCompraItemUpdate,
)

router = APIRouter(prefix="/lista-compra", tags=["Lista de la Compra"])


def _get_repo(
    session: AsyncSession = Depends(get_async_session),
) -> ListaCompraRepository:
    return ListaCompraRepository(session)


@router.get("", response_model=list[ListaCompraItemResponse])
async def list_items(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: ListaCompraRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> list[ListaCompraItemResponse]:
    """Devuelve todos los ítems de la lista de la compra del hogar, pendientes primero."""
    items = await repo.list_by_hogar(hogar_id)
    return [ListaCompraItemResponse.model_validate(i) for i in items]


@router.post(
    "", response_model=ListaCompraItemResponse, status_code=status.HTTP_201_CREATED
)
async def create_item(
    data: ListaCompraItemCreate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: ListaCompraRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> ListaCompraItemResponse:
    """Añade un ítem a la lista de la compra del hogar."""
    item = await repo.create(hogar_id, data)
    return ListaCompraItemResponse.model_validate(item)


@router.patch("/{item_id}", response_model=ListaCompraItemResponse)
async def update_item(
    item_id: uuid.UUID,
    data: ListaCompraItemUpdate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: ListaCompraRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> ListaCompraItemResponse:
    """Actualiza un ítem: marcar/desmarcar como comprado, editar nombre o cantidad."""
    item = await repo.update(item_id, hogar_id, data)
    return ListaCompraItemResponse.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: ListaCompraRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> None:
    """Elimina un ítem de la lista (soft delete)."""
    await repo.delete(item_id, hogar_id)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_checked(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: ListaCompraRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> None:
    """Elimina todos los ítems marcados como comprados (soft delete masivo)."""
    await repo.delete_checked(hogar_id)
