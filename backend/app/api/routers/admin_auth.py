import hmac

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    _extract_admin_token,
    admin_bearer_scheme,
    get_admin_auth_service,
    get_current_admin,
)
from app.core import config as core_config
from app.core.token_blocklist import revoke_token
from app.database import get_async_session
from app.models.models import AdminUser
from app.repositories.admin_user import AdminUserRepository
from app.schemas.schemas import (
    AdminBootstrapRequest,
    AdminLoginRequest,
    AdminTokenResponse,
    LogoutResponse,
    _AdminInfo,
)
from app.services.admin_auth import AdminAuthService

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


def _set_admin_cookie(response: Response, token: str) -> None:
    """Coloca el JWT de admin en una cookie HttpOnly. En producción es cross-site
    (SameSite=None + Secure); en desarrollo, Lax sobre http localhost."""
    response.set_cookie(
        key=core_config.ADMIN_COOKIE_NAME,
        value=token,
        max_age=core_config.ADMIN_JWT_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=core_config.ADMIN_COOKIE_SECURE,
        samesite=core_config.ADMIN_COOKIE_SAMESITE,
        path="/",
    )


@router.post("/login", response_model=AdminTokenResponse)
async def admin_login(
    body: AdminLoginRequest,
    response: Response,
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
    _set_admin_cookie(response, token)
    return AdminTokenResponse(
        access_token=token,
        admin=_AdminInfo(id=admin.id, email=admin.email, nombre=admin.nombre),
    )


@router.post(
    "/bootstrap", response_model=AdminTokenResponse, status_code=status.HTTP_200_OK
)
async def admin_bootstrap(
    body: AdminBootstrapRequest,
    response: Response,
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
    # Comparación en tiempo constante para no filtrar el token por timing.
    # Se codifica a bytes: hmac.compare_digest sobre str solo admite ASCII y
    # lanzaría TypeError con caracteres no-ASCII (input arbitrario del cliente).
    if not hmac.compare_digest(
        body.bootstrap_token.encode("utf-8"),
        core_config.ADMIN_BOOTSTRAP_TOKEN.encode("utf-8"),
    ):
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
    _set_admin_cookie(response, token)
    return AdminTokenResponse(
        access_token=token,
        admin=_AdminInfo(id=admin.id, email=admin.email, nombre=admin.nombre),
    )


@router.post("/logout", response_model=LogoutResponse)
async def admin_logout(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials | None = Depends(admin_bearer_scheme),
    _admin: AdminUser = Depends(get_current_admin),
) -> LogoutResponse:
    """Cierra la sesión de admin: revoca el JTI en el blocklist (un token revocado
    da 401 aunque no haya expirado) y borra la cookie HttpOnly del navegador."""
    token = _extract_admin_token(request, credentials)
    if token and core_config.ADMIN_JWT_SECRET_KEY:
        try:
            payload = jwt.decode(
                token,
                core_config.ADMIN_JWT_SECRET_KEY,
                algorithms=[core_config.JWT_ALGORITHM],
            )
            jti = payload.get("jti")
            if jti:
                await revoke_token(jti, int(payload["exp"]))
        except jwt.PyJWTError:
            pass
    response.delete_cookie(
        key=core_config.ADMIN_COOKIE_NAME,
        path="/",
        secure=core_config.ADMIN_COOKIE_SECURE,
        samesite=core_config.ADMIN_COOKIE_SAMESITE,
    )
    return LogoutResponse(success=True, message="Sesión de administrador cerrada.")
