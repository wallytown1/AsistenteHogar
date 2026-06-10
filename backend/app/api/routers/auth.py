from fastapi import APIRouter, Depends, status

from app.api.deps import get_auth_service, get_current_user
from app.core.rate_limit import login_rate_limiter, registro_rate_limiter
from app.models.models import Usuario
from app.services.auth import AuthService
from app.schemas.schemas import RegistroRequest, LoginRequest, TokenResponse, UsuarioResponse

router = APIRouter(tags=["Auth"])


@router.post(
    "/auth/registro",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(registro_rate_limiter)]
)
async def registro(
    schema: RegistroRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """Crea un nuevo Hogar con su primer usuario y devuelve la sesión iniciada (token JWT)."""
    return await auth_service.registrar(schema)


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    dependencies=[Depends(login_rate_limiter)]
)
async def login(
    schema: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """Inicia sesión con email y contraseña. Devuelve un token JWT de acceso."""
    return await auth_service.login(schema)


@router.get("/auth/me", response_model=UsuarioResponse)
async def me(current_user: Usuario = Depends(get_current_user)):
    """Devuelve el perfil del usuario autenticado según el token Bearer."""
    return current_user
