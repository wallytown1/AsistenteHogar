from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_auth_service
from app.core import config as core_config
from app.database import get_async_session
from app.repositories.admin_user import AdminUserRepository
from app.schemas.schemas import (
    AdminBootstrapRequest,
    AdminLoginRequest,
    AdminTokenResponse,
    _AdminInfo,
)
from app.services.admin_auth import AdminAuthService

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


@router.post("/login", response_model=AdminTokenResponse)
async def admin_login(
    body: AdminLoginRequest,
    svc: AdminAuthService = Depends(get_admin_auth_service),
) -> AdminTokenResponse:
    if not core_config.ADMIN_JWT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El panel de administración no está configurado en este servidor.",
        )
    admin = await svc.authenticate(body.email, body.password)
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de administrador incorrectas.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = svc.create_admin_token(admin)
    return AdminTokenResponse(
        access_token=token,
        admin=_AdminInfo(id=admin.id, email=admin.email, nombre=admin.nombre),
    )


@router.post(
    "/bootstrap", response_model=AdminTokenResponse, status_code=status.HTTP_200_OK
)
async def admin_bootstrap(
    body: AdminBootstrapRequest,
    session: AsyncSession = Depends(get_async_session),
    svc: AdminAuthService = Depends(get_admin_auth_service),
) -> AdminTokenResponse:
    """Crea el primer usuario administrador. Requiere ADMIN_BOOTSTRAP_TOKEN en el servidor.
    Devuelve 501 si el token no está configurado; 409 si ya existe algún admin."""
    if not core_config.ADMIN_BOOTSTRAP_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="El bootstrap de administrador no está habilitado en este servidor.",
        )
    if body.bootstrap_token != core_config.ADMIN_BOOTSTRAP_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bootstrap token inválido.",
        )

    repo = AdminUserRepository(session)
    if await repo.count() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un administrador. Usa /admin/auth/login.",
        )

    admin = await svc.create_admin(body.email, body.password, body.nombre)
    await session.commit()
    token = svc.create_admin_token(admin)
    return AdminTokenResponse(
        access_token=token,
        admin=_AdminInfo(id=admin.id, email=admin.email, nombre=admin.nombre),
    )
