import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, require_admin_csrf
from app.database import get_async_session
from app.models.models import AdminUser
from app.repositories.exceptions import ItemNotFoundError
from app.repositories.receta_maestra import RecetaMaestraRepository
from app.schemas.schemas import (
    RecetaMaestraCreate,
    RecetaMaestraResponse,
    RecetaMaestraUpdate,
)

router = APIRouter(prefix="/admin/recetario", tags=["admin-recetario"])


def _repo(
    session: AsyncSession = Depends(get_async_session),
) -> RecetaMaestraRepository:
    return RecetaMaestraRepository(session)


@router.get("", response_model=list[RecetaMaestraResponse])
async def list_recetas(
    activa_only: bool = Query(False),
    repo: RecetaMaestraRepository = Depends(_repo),
    _admin: AdminUser = Depends(get_current_admin),
) -> list[RecetaMaestraResponse]:
    recetas = await repo.list_all(activa_only=activa_only)
    return [RecetaMaestraResponse.model_validate(r) for r in recetas]


@router.post(
    "", response_model=RecetaMaestraResponse, status_code=status.HTTP_201_CREATED
)
async def create_receta(
    body: RecetaMaestraCreate,
    session: AsyncSession = Depends(get_async_session),
    repo: RecetaMaestraRepository = Depends(_repo),
    _admin: AdminUser = Depends(get_current_admin),
    _csrf: None = Depends(require_admin_csrf),
) -> RecetaMaestraResponse:
    receta = await repo.create(
        nombre=body.nombre,
        ingredientes=body.ingredientes,
        pasos=body.pasos,
        categoria=body.categoria,
        temporada=body.temporada,
        aprovechamiento=body.aprovechamiento,
    )
    await session.commit()
    await session.refresh(receta)
    return RecetaMaestraResponse.model_validate(receta)


@router.get("/{receta_id}", response_model=RecetaMaestraResponse)
async def get_receta(
    receta_id: uuid.UUID,
    repo: RecetaMaestraRepository = Depends(_repo),
    _admin: AdminUser = Depends(get_current_admin),
) -> RecetaMaestraResponse:
    try:
        receta = await repo.get_by_id(receta_id)
    except ItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada."
        ) from None
    return RecetaMaestraResponse.model_validate(receta)


@router.patch("/{receta_id}", response_model=RecetaMaestraResponse)
async def update_receta(
    receta_id: uuid.UUID,
    body: RecetaMaestraUpdate,
    session: AsyncSession = Depends(get_async_session),
    repo: RecetaMaestraRepository = Depends(_repo),
    _admin: AdminUser = Depends(get_current_admin),
    _csrf: None = Depends(require_admin_csrf),
) -> RecetaMaestraResponse:
    campos = body.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes proporcionar al menos un campo a actualizar.",
        )
    try:
        receta = await repo.update(receta_id, **campos)
    except ItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada."
        ) from None
    await session.commit()
    await session.refresh(receta)
    return RecetaMaestraResponse.model_validate(receta)


@router.delete("/{receta_id}", status_code=status.HTTP_200_OK)
async def delete_receta(
    receta_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    repo: RecetaMaestraRepository = Depends(_repo),
    _admin: AdminUser = Depends(get_current_admin),
    _csrf: None = Depends(require_admin_csrf),
) -> dict[str, bool]:
    try:
        await repo.delete(receta_id)
    except ItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada."
        ) from None
    await session.commit()
    return {"success": True}
