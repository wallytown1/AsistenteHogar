import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import config as core_config
from app.core.security import decode_access_token
from app.database import get_async_session
from app.models.models import AdminUser, Usuario
from app.repositories.admin_user import AdminUserRepository
from app.repositories.historial import RecetaHistorialRepository
from app.repositories.pantry import PantryRepository
from app.repositories.perfil import PerfilHogarRepository
from app.repositories.perfiles_individual import PerfilIndividualRepository
from app.repositories.prompt_template import PromptTemplateRepository
from app.repositories.receta_maestra import RecetaMaestraRepository
from app.repositories.user import UserRepository
from app.services.admin_auth import AdminAuthService
from app.services.auth import AuthService
from app.services.dashboard import DashboardService
from app.services.historial import RecetaHistorialService
from app.services.onboarding import OnboardingService
from app.services.pantry import PantryService
from app.services.prompt_config import PromptConfigService

# Esquema Bearer: auto_error=False para emitir nuestros propios mensajes 401 en español
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_async_session),
) -> Usuario:
    """Valida el token JWT Bearer y devuelve el usuario autenticado.
    Esta dependencia es la base del aislamiento multi-tenant: el hogar
    se deriva siempre del token firmado, nunca de datos del cliente."""
    unauthorized_headers = {"WWW-Authenticate": "Bearer"}

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación. Incluye la cabecera Authorization: Bearer <token>.",
            headers=unauthorized_headers,
        )

    try:
        payload = decode_access_token(credentials.credentials)
        usuario_id = uuid.UUID(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión ha expirado. Vuelve a iniciar sesión.",
            headers=unauthorized_headers,
        ) from None
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de autenticación no es válido.",
            headers=unauthorized_headers,
        ) from None

    user_repo = UserRepository(session)
    usuario = await user_repo.get_by_id(usuario_id)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La cuenta asociada al token no existe o está desactivada.",
            headers=unauthorized_headers,
        )
    return usuario


async def get_hogar_id(current_user: Usuario = Depends(get_current_user)) -> uuid.UUID:
    """Devuelve el hogar del usuario autenticado.
    Garantiza el aislamiento multi-tenant: el hogar_id proviene de la base de
    datos del usuario validado por JWT, no de cabeceras manipulables."""
    return current_user.hogar_id


async def requiere_premium(
    current_user: Usuario = Depends(get_current_user),
) -> None:
    """Exige una suscripción premium activa para acceder al endpoint.

    El gate de la UI no es suficiente: esta dependencia valida el entitlement
    contra RevenueCat (server-side) para que las funciones de IA de pago no se
    puedan consumir llamando a la API directamente. Si RevenueCat no está
    configurado (desarrollo/tests), el gate queda desactivado y permite el paso.
    """
    from app.services.premium import is_premium

    if not await is_premium(str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Esta función requiere una suscripción premium activa.",
        )


async def get_auth_service(
    session: AsyncSession = Depends(get_async_session),
) -> AuthService:
    """Provee una instancia de AuthService inyectando su repositorio asíncrono."""
    return AuthService(UserRepository(session))


# Inyección de dependencias para servicios de negocio
async def get_pantry_service(
    session: AsyncSession = Depends(get_async_session),
) -> PantryService:
    """Provee una instancia de PantryService inyectando su repositorio asíncrono."""
    pantry_repo = PantryRepository(session)
    return PantryService(pantry_repo)


async def get_dashboard_service(
    pantry_service: PantryService = Depends(get_pantry_service),
) -> DashboardService:
    """Provee una instancia de DashboardService (resumen de despensa)."""
    return DashboardService(pantry_service)


async def get_onboarding_service(
    session: AsyncSession = Depends(get_async_session),
) -> OnboardingService:
    """Provee una instancia de OnboardingService inyectando su repositorio asíncrono."""
    return OnboardingService(PerfilHogarRepository(session))


async def get_historial_service(
    session: AsyncSession = Depends(get_async_session),
) -> RecetaHistorialService:
    """Provee una instancia de RecetaHistorialService inyectando su repositorio asíncrono."""
    return RecetaHistorialService(RecetaHistorialRepository(session))


async def get_perfiles_repo(
    session: AsyncSession = Depends(get_async_session),
) -> PerfilIndividualRepository:
    """Provee el repositorio de perfiles individuales."""
    return PerfilIndividualRepository(session)


# --- ADMIN ---

admin_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(admin_bearer_scheme),
    session: AsyncSession = Depends(get_async_session),
) -> AdminUser:
    """Valida un JWT de admin (firmado con ADMIN_JWT_SECRET_KEY, role=='admin').
    Completamente separado de los tokens familiares — ningún token familiar puede
    acceder a rutas de admin y viceversa."""
    unauthorized_headers = {"WWW-Authenticate": "Bearer"}

    if not core_config.ADMIN_JWT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El panel de administración no está configurado en este servidor.",
        )

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación de administrador.",
            headers=unauthorized_headers,
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            core_config.ADMIN_JWT_SECRET_KEY,
            algorithms=[core_config.JWT_ALGORITHM],
        )
        if payload.get("role") != "admin":
            raise ValueError("role != admin")
        admin_id = uuid.UUID(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión de administrador ha expirado.",
            headers=unauthorized_headers,
        ) from None
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de administrador inválido.",
            headers=unauthorized_headers,
        ) from None

    repo = AdminUserRepository(session)
    admin = await repo.get_by_id(admin_id)
    if admin is None or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta de administrador no encontrada o desactivada.",
            headers=unauthorized_headers,
        )
    return admin


async def get_admin_auth_service(
    session: AsyncSession = Depends(get_async_session),
) -> AdminAuthService:
    return AdminAuthService(AdminUserRepository(session))


async def get_prompt_config_service(
    session: AsyncSession = Depends(get_async_session),
) -> PromptConfigService:
    return PromptConfigService(PromptTemplateRepository(session))


async def get_recetario_repo(
    session: AsyncSession = Depends(get_async_session),
) -> RecetaMaestraRepository:
    """Provee el repositorio del recetario maestro (catálogo global de referencia)."""
    return RecetaMaestraRepository(session)
