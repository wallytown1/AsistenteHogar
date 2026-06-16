import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import verify_admin_key
from app.database import get_async_session
from app.models.models import Hogar, Usuario
from app.repositories.user import UserRepository

router = APIRouter(
    prefix="/admin",
    tags=["Admin (God Mode)"],
    dependencies=[Depends(verify_admin_key)],
)


@router.get("/users")
async def get_all_users(session: AsyncSession = Depends(get_async_session)) -> Any:
    """Devuelve absolutamente todos los usuarios de la base de datos sin filtrar por hogar."""
    stmt = select(Usuario).options(selectinload(Usuario.hogar))
    result = await session.execute(stmt)
    usuarios = result.scalars().all()

    return [
        {
            "id": str(u.id),
            "email": u.email,
            "nombre": u.nombre,
            "is_active": u.is_active,
            "hogar_id": str(u.hogar_id),
            "hogar_nombre": u.hogar.nombre if u.hogar else None,
            "created_at": u.created_at,
        }
        for u in usuarios
    ]


@router.get("/hogares")
async def get_all_hogares(session: AsyncSession = Depends(get_async_session)) -> Any:
    """Devuelve absolutamente todos los hogares de la base de datos."""
    stmt = select(Hogar).options(selectinload(Hogar.usuarios))
    result = await session.execute(stmt)
    hogares = result.scalars().all()

    return [
        {
            "id": str(h.id),
            "nombre": h.nombre,
            "usuarios_count": len(h.usuarios),
            "created_at": h.created_at,
        }
        for h in hogares
    ]


@router.delete("/hogar/{hogar_id}")
async def delete_hogar_god_mode(
    hogar_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)
) -> Any:
    """Elimina físicamente un hogar completo y todos sus datos."""
    user_repo = UserRepository(session)
    afectados = await user_repo.delete_hogar_fisico(hogar_id)
    if afectados == 0:
        raise HTTPException(status_code=404, detail="Hogar no encontrado")
    return {"message": "Hogar destruido exitosamente", "registros_borrados": afectados}
