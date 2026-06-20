from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import bearer_scheme, get_auth_service, get_current_user
from app.core.rate_limit import (
    cuenta_eliminar_rate_limiter,
    login_rate_limiter,
    registro_rate_limiter,
)
from app.core.security import decode_access_token
from app.core.token_blocklist import revoke_token
from app.models.models import Usuario
from app.schemas.schemas import (
    CuentaEliminadaResponse,
    CuentaEliminarRequest,
    LoginRequest,
    LogoutResponse,
    RegistroRequest,
    TokenResponse,
    UsuarioResponse,
)
from app.services.auth import AuthService

router = APIRouter(tags=["Auth"])


@router.post(
    "/auth/registro",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(registro_rate_limiter)],
)
async def registro(
    schema: RegistroRequest, auth_service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """Crea un nuevo Hogar con su primer usuario y devuelve la sesión iniciada (token JWT)."""
    return await auth_service.registrar(schema)


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    dependencies=[Depends(login_rate_limiter)],
)
async def login(
    schema: LoginRequest, auth_service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """Inicia sesión con email y contraseña. Devuelve un token JWT de acceso."""
    return await auth_service.login(schema)


@router.post("/auth/logout", response_model=LogoutResponse)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    _: Usuario = Depends(get_current_user),
) -> LogoutResponse:
    """Invalida el token actual en el servidor (JTI blocklist). El cliente debe
    descartar el token localmente. Un token revocado devuelve 401 en cualquier
    endpoint protegido aunque aún no haya expirado."""
    payload = decode_access_token(credentials.credentials)
    await revoke_token(payload["jti"], int(payload["exp"]))
    return LogoutResponse(success=True, message="Sesión cerrada correctamente.")


@router.get("/auth/me", response_model=UsuarioResponse)
async def me(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    """Devuelve el perfil del usuario autenticado según el token Bearer."""
    return current_user


@router.delete(
    "/auth/cuenta",
    response_model=CuentaEliminadaResponse,
    dependencies=[Depends(cuenta_eliminar_rate_limiter)],
)
async def eliminar_cuenta(
    schema: CuentaEliminarRequest,
    current_user: Usuario = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> CuentaEliminadaResponse:
    """Destrucción física y definitiva de la cuenta: elimina el hogar derivado del
    JWT y todos sus datos vinculados (RGPD art. 17, App Store 5.1.1(v), Google Play).
    Requiere confirmar la contraseña actual. Operación irreversible."""
    return await auth_service.eliminar_cuenta(current_user, schema)
