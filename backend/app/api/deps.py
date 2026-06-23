import uuid

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import config as core_config
from app.core.security import decode_access_token
from app.database import get_async_session
from app.models.models import AdminUser, Usuario
from app.repositories.admin_user import AdminUserRepository
from app.repositories.historial import RecetaHistorialRepository
from app.repositories.lista_compra import ListaCompraRepository
from app.repositories.memoria import MemoriaGustosRepository
from app.repositories.movimientos import MovimientoDespensaRepository
from app.repositories.pantry import PantryRepository
from app.repositories.perfil import PerfilHogarRepository
from app.repositories.perfiles_individual import PerfilIndividualRepository
from app.repositories.prompt_template import PromptTemplateRepository
from app.repositories.receta_maestra import RecetaMaestraRepository
from app.repositories.user import UserRepository
from app.services.admin_auth import AdminAuthService
from app.services.ahorro import AhorroService
from app.services.auth import AuthService
from app.services.dashboard import DashboardService
from app.services.historial import RecetaHistorialService
from app.services.lista_compra import ListaCompraService
from app.services.memoria import MemoriaService
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
        jti: str = payload.get("jti", "")
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

    if jti:
        from app.core.token_blocklist import is_token_revoked

        if await is_token_revoked(jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="La sesión ha sido cerrada. Vuelve a iniciar sesión.",
                headers=unauthorized_headers,
            )

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
    """Exige tier Premium o Familia para acceder al endpoint.

    El gate de la UI no es suficiente: esta dependencia valida el entitlement
    contra RevenueCat (server-side) para que las funciones de IA de pago no se
    puedan consumir llamando a la API directamente. Si RevenueCat no está
    configurado (desarrollo/tests), el gate queda desactivado y permite el paso.
    """
    from app.services.premium import is_premium

    if not await is_premium(str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Esta función requiere una suscripción Premium activa.",
        )


async def requiere_familia(
    current_user: Usuario = Depends(get_current_user),
) -> None:
    """Exige tier Familia para acceder al endpoint (plan anual).

    Familia ⊃ Premium: un usuario Familia también tiene acceso a todos los
    endpoints premium. Si RevenueCat no está configurado (desarrollo/tests),
    el gate queda desactivado y permite el paso.
    """
    from app.services.premium import is_familia

    if not await is_familia(str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Esta función requiere el plan Familia.",
        )


async def check_freemium_chat_quota(
    request: Request,
    current_user: Usuario = Depends(get_current_user),
) -> None:
    """Verifica si el usuario es premium o si no ha superado su límite diario gratuito.

    Límite por hogar (no por usuario) para evitar abusos creando cuentas gratis en
    el mismo hogar. Si es premium, paso libre. Si es free, tracking diario en Redis.
    """
    import logging
    from datetime import date

    from app.core import config as core_config
    from app.core.redis_client import get_redis
    from app.services.premium import is_premium

    if await is_premium(str(current_user.id)):
        return

    redis = get_redis()
    today = date.today().isoformat()
    hogar_id_str = str(current_user.hogar_id)
    key = f"chef_chat_usage:{hogar_id_str}:{today}"
    limit = core_config.CHEF_FREE_DAILY_LIMIT

    if redis is not None:
        try:
            count = await redis.get(key)
            if count is not None and int(count) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="Límite diario superado. Suscríbete para continuar.",
                )
            await redis.incr(key)
            if count is None:
                await redis.expire(key, 86400 * 2)  # Expira en 48h
            return
        except HTTPException:
            raise
        except Exception as e:
            logging.getLogger("app.api.deps").warning(
                f"Error Redis en freemium quota: {e}"
            )
            # Fallback en memoria si Redis falla

    # Fallback a memoria (estado de FastAPI)
    if not hasattr(request.app.state, "chat_quota"):
        request.app.state.chat_quota = {}
    quota = request.app.state.chat_quota

    current_count = quota.get(key, 0)
    if current_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Límite diario superado. Suscríbete para continuar.",
        )
    quota[key] = current_count + 1


async def get_auth_service(
    session: AsyncSession = Depends(get_async_session),
) -> AuthService:
    """Provee una instancia de AuthService inyectando su repositorio asíncrono."""
    return AuthService(UserRepository(session))


# Inyección de dependencias para servicios de negocio
async def get_pantry_service(
    session: AsyncSession = Depends(get_async_session),
) -> PantryService:
    """Provee PantryService con su repo de despensa y el ledger de movimientos
    (para registrar compra/consumo y aprender los hábitos del hogar)."""
    pantry_repo = PantryRepository(session)
    return PantryService(pantry_repo, MovimientoDespensaRepository(session))


async def get_onboarding_service(
    session: AsyncSession = Depends(get_async_session),
) -> OnboardingService:
    """Provee una instancia de OnboardingService inyectando su repositorio asíncrono."""
    return OnboardingService(PerfilHogarRepository(session))


def _build_memoria_service(session: AsyncSession) -> MemoriaService:
    """Construye MemoriaService con sus repositorios sobre la misma sesión (incluye el
    ledger de movimientos para incorporar los hábitos de compra/consumo a la memoria)."""
    return MemoriaService(
        MemoriaGustosRepository(session),
        PerfilHogarRepository(session),
        PerfilIndividualRepository(session),
        RecetaHistorialRepository(session),
        MovimientoDespensaRepository(session),
    )


async def get_memoria_service(
    session: AsyncSession = Depends(get_async_session),
) -> MemoriaService:
    """Provee MemoriaService (lectura de memoria + recálculo cuando está obsoleta)."""
    return _build_memoria_service(session)


async def get_dashboard_service(
    pantry_service: PantryService = Depends(get_pantry_service),
    memoria_service: MemoriaService = Depends(get_memoria_service),
) -> DashboardService:
    """Provee una instancia de DashboardService (resumen de despensa e inyección de memoria)."""
    return DashboardService(pantry_service, memoria_service)


async def get_historial_service(
    session: AsyncSession = Depends(get_async_session),
) -> RecetaHistorialService:
    """Provee RecetaHistorialService. Inyecta MemoriaService para que el feedback del
    hogar dispare el refresco de la memoria de gustos."""
    return RecetaHistorialService(
        RecetaHistorialRepository(session),
        _build_memoria_service(session),
    )


async def get_perfiles_repo(
    session: AsyncSession = Depends(get_async_session),
) -> PerfilIndividualRepository:
    """Provee el repositorio de perfiles individuales."""
    return PerfilIndividualRepository(session)


# --- ADMIN ---

admin_bearer_scheme = HTTPBearer(auto_error=False)


def _extract_admin_token(
    request: Request, credentials: HTTPAuthorizationCredentials | None
) -> str | None:
    """Resuelve el token de admin: primero la cookie HttpOnly (navegador/panel),
    con fallback a la cabecera Authorization: Bearer (clientes API y tests)."""
    cookie_token: str | None = request.cookies.get(core_config.ADMIN_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if credentials is not None:
        token: str = credentials.credentials
        return token
    return None


async def get_current_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(admin_bearer_scheme),
    session: AsyncSession = Depends(get_async_session),
) -> AdminUser:
    """Valida un JWT de admin (firmado con ADMIN_JWT_SECRET_KEY, role=='admin').
    Completamente separado de los tokens familiares — ningún token familiar puede
    acceder a rutas de admin y viceversa. El token se lee de una cookie HttpOnly
    (preferente) o de la cabecera Bearer (fallback). Soporta revocación vía
    blocklist de JTI (logout real)."""
    unauthorized_headers = {"WWW-Authenticate": "Bearer"}

    if not core_config.ADMIN_JWT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El panel de administración no está configurado en este servidor.",
        )

    token = _extract_admin_token(request, credentials)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación de administrador.",
            headers=unauthorized_headers,
        )

    try:
        payload = jwt.decode(
            token,
            core_config.ADMIN_JWT_SECRET_KEY,
            algorithms=[core_config.JWT_ALGORITHM],
        )
        if payload.get("role") != "admin":
            raise ValueError("role != admin")
        admin_id = uuid.UUID(payload["sub"])
        jti: str = payload.get("jti", "")
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

    if jti:
        from app.core.token_blocklist import is_token_revoked

        if await is_token_revoked(jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="La sesión de administrador ha sido cerrada.",
                headers=unauthorized_headers,
            )

    repo = AdminUserRepository(session)
    admin = await repo.get_by_id(admin_id)
    if admin is None or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta de administrador no encontrada o desactivada.",
            headers=unauthorized_headers,
        )
    return admin


async def require_admin_csrf(request: Request) -> None:
    """Defensa CSRF para mutaciones del panel admin cuando la sesión viaja en
    cookie. Exige una cabecera personalizada que un sitio atacante no puede
    enviar cross-origin sin un preflight CORS que el backend rechaza (la
    allow-list de orígenes no lo incluye). Las peticiones por Bearer puro
    (tests/clientes API) también la envían."""
    if request.headers.get("X-Admin-Request") != "1":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Falta la cabecera de protección CSRF (X-Admin-Request).",
        )


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


async def get_lista_compra_repo(
    session: AsyncSession = Depends(get_async_session),
) -> ListaCompraRepository:
    """Provee el repositorio de la lista de la compra del hogar."""
    return ListaCompraRepository(session)


async def get_lista_compra_service(
    session: AsyncSession = Depends(get_async_session),
) -> ListaCompraService:
    """Provee ListaCompraService (sugerencias inteligentes a partir del ledger)."""
    return ListaCompraService(
        MovimientoDespensaRepository(session),
        PantryRepository(session),
        ListaCompraRepository(session),
    )


async def get_ahorro_service(
    session: AsyncSession = Depends(get_async_session),
) -> AhorroService:
    """Provee AhorroService para el cálculo del Informe de Ahorro mensual."""
    return AhorroService(session)
