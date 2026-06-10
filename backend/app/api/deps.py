import uuid
import jwt
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.database import get_async_session
from app.models.models import Usuario
from app.repositories.pantry import PantryRepository
from app.repositories.calendar import CalendarRepository
from app.repositories.task import TaskRepository
from app.repositories.user import UserRepository
from app.services.pantry import PantryService
from app.services.calendar import CalendarService
from app.services.dashboard import DashboardService
from app.services.auth import AuthService

# Esquema Bearer: auto_error=False para emitir nuestros propios mensajes 401 en español
bearer_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_async_session)
) -> Usuario:
    """Valida el token JWT Bearer y devuelve el usuario autenticado.
    Esta dependencia es la base del aislamiento multi-tenant: el hogar
    se deriva siempre del token firmado, nunca de datos del cliente."""
    unauthorized_headers = {"WWW-Authenticate": "Bearer"}

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación. Incluye la cabecera Authorization: Bearer <token>.",
            headers=unauthorized_headers
        )

    try:
        payload = decode_access_token(credentials.credentials)
        usuario_id = uuid.UUID(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión ha expirado. Vuelve a iniciar sesión.",
            headers=unauthorized_headers
        )
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de autenticación no es válido.",
            headers=unauthorized_headers
        )

    user_repo = UserRepository(session)
    usuario = await user_repo.get_by_id(usuario_id)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La cuenta asociada al token no existe o está desactivada.",
            headers=unauthorized_headers
        )
    return usuario

async def get_hogar_id(current_user: Usuario = Depends(get_current_user)) -> uuid.UUID:
    """Devuelve el hogar del usuario autenticado.
    Garantiza el aislamiento multi-tenant: el hogar_id proviene de la base de
    datos del usuario validado por JWT, no de cabeceras manipulables."""
    return current_user.hogar_id

async def get_auth_service(session: AsyncSession = Depends(get_async_session)) -> AuthService:
    """Provee una instancia de AuthService inyectando su repositorio asíncrono."""
    return AuthService(UserRepository(session))

# Inyección de dependencias para servicios de negocio
async def get_pantry_service(session: AsyncSession = Depends(get_async_session)) -> PantryService:
    """Provee una instancia de PantryService inyectando su repositorio asíncrono."""
    pantry_repo = PantryRepository(session)
    return PantryService(pantry_repo)

async def get_calendar_service(session: AsyncSession = Depends(get_async_session)) -> CalendarService:
    """Provee una instancia de CalendarService inyectando su repositorio asíncrono."""
    calendar_repo = CalendarRepository(session)
    return CalendarService(calendar_repo)

async def get_dashboard_service(
    session: AsyncSession = Depends(get_async_session),
    pantry_service: PantryService = Depends(get_pantry_service),
    calendar_service: CalendarService = Depends(get_calendar_service)
) -> DashboardService:
    """Provee una instancia de DashboardService inyectando sus dependencias secundarias."""
    task_repo = TaskRepository(session)
    return DashboardService(task_repo, pantry_service, calendar_service)


async def get_task_repository(session: AsyncSession = Depends(get_async_session)) -> TaskRepository:
    """Provee una instancia de TaskRepository inyectando su sesión de base de datos."""
    return TaskRepository(session)

