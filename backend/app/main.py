import logging
import os
import sys
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint

# Cargar variables de entorno antes de importar módulos que las consumen
load_dotenv()

# Importar routers
from app.api.routers import auth, calendar, dashboard, pantry, tasks
from app.core.config import IS_PRODUCTION
from app.core.logging_config import setup_logging
from app.database import engine

# Importar excepciones de negocio
from app.repositories.exceptions import (
    DatabaseIntegrityError,
    EventoNotFoundError,
    ItemNotFoundError,
    ReglaNegocioError,
    RepositoryError,
)

setup_logging()
logger = logging.getLogger("app.main")
access_logger = logging.getLogger("app.acceso")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    import asyncio

    from sqlalchemy import select

    from app.core.redis_client import close_redis, init_redis
    from app.jobs.purge import purge_scheduler
    from app.services.llm import aclose_http_client

    # Validar la conexión con la base de datos antes de aceptar tráfico
    try:
        async with engine.connect() as conn:
            await conn.execute(select(1))
    except Exception as e:
        logger.critical(
            f"Error crítico de conexión a la base de datos: {e}. Abortando arranque..."
        )
        sys.exit(1)

    logger.info("Conexión a la base de datos verificada.")

    # Migraciones automáticas al arranque (opt-in vía RUN_MIGRATIONS_ON_STARTUP=true).
    # Necesario en plataformas como Railway, donde el start command no ejecuta el
    # Procfile (alembic upgrade head). Se corre en un SUBPROCESO porque alembic/env.py
    # usa asyncio.run() y no puede anidarse en el event loop de FastAPI. Desactivado
    # por defecto: los tests y el desarrollo local gestionan su propio esquema.
    if os.getenv("RUN_MIGRATIONS_ON_STARTUP", "").lower() == "true":
        logger.info("Aplicando migraciones (alembic upgrade head)...")
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "alembic",
            "upgrade",
            "head",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        salida, _ = await proc.communicate()
        if proc.returncode != 0:
            logger.critical(
                "Las migraciones fallaron. Abortando arranque.\n"
                f"{salida.decode(errors='replace')}"
            )
            sys.exit(1)
        logger.info("Migraciones aplicadas correctamente.")

    logger.info("API lista para aceptar tráfico.")

    # Inicializar Redis (caché distribuida + rate-limit compartido).
    # Si falla, la app arranca en modo degradado (caché/rate-limit en memoria).
    await init_redis()

    # Purga física programada (RGPD): una pasada al arrancar y luego cada 24 h
    purge_task = asyncio.create_task(purge_scheduler())
    try:
        yield
    finally:
        purge_task.cancel()
        try:
            await purge_task
        except asyncio.CancelledError:
            pass
        # Cerrar el cliente HTTP compartido de Gemini (libera conexiones keep-alive)
        await aclose_http_client()
        # Cerrar pool de Redis
        await close_redis()


app = FastAPI(
    title="Asistente del Hogar IA - Backend API",
    description="API REST asíncrona para la gestión inteligente del hogar",
    version="1.0.0",
    lifespan=lifespan,
    # En producción los docs interactivos quedan deshabilitados (reducción de superficie)
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# --- CONFIGURACIÓN DE CORS RESTRINGIDO ---
# ALLOWED_ORIGINS (separados por coma) manda siempre. Sin ella:
# - desarrollo: orígenes locales de Expo Web.
# - producción: ningún origen (los clientes nativos iOS/Android no envían Origin
#   y no se ven afectados por CORS; solo un futuro cliente web lo necesitaría).
origins_str = os.getenv("ALLOWED_ORIGINS", "")
if origins_str:
    origins = [org.strip() for org in origins_str.split(",") if org.strip()]
elif IS_PRODUCTION:
    origins = []
else:
    origins = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19000",
        "http://localhost:19006",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- LOG DE ACCESO ESTRUCTURADO ---
@app.middleware("http")
async def log_requests(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    inicio = time.perf_counter()
    response = await call_next(request)
    duracion_ms = (time.perf_counter() - inicio) * 1000
    access_logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({duracion_ms:.1f} ms)"
    )
    return response


# --- MANEJADORES GLOBALES DE EXCEPCIONES ---


@app.exception_handler(ItemNotFoundError)
async def item_not_found_exception_handler(
    request: Request, exc: ItemNotFoundError
) -> JSONResponse:
    """Mapea ItemNotFoundError a HTTP 404 Not Found."""
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(EventoNotFoundError)
async def evento_not_found_exception_handler(
    request: Request, exc: EventoNotFoundError
) -> JSONResponse:
    """Mapea EventoNotFoundError a HTTP 404 Not Found."""
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(DatabaseIntegrityError)
async def database_integrity_exception_handler(
    request: Request, exc: DatabaseIntegrityError
) -> JSONResponse:
    """Mapea DatabaseIntegrityError a HTTP 400 Bad Request."""
    return JSONResponse(status_code=400, content={"detail": exc.message})


@app.exception_handler(ReglaNegocioError)
async def regla_negocio_exception_handler(
    request: Request, exc: ReglaNegocioError
) -> JSONResponse:
    """Mapea ReglaNegocioError a HTTP 422 Unprocessable Entity, alineado con el contrato
    de validación de los schemas (p. ej. PATCH de eventos con fechas inconsistentes)."""
    return JSONResponse(status_code=422, content={"detail": exc.message})


@app.exception_handler(RepositoryError)
async def generic_repository_exception_handler(
    request: Request, exc: RepositoryError
) -> JSONResponse:
    """Mapea cualquier otro error de repositorio a HTTP 400 Bad Request."""
    return JSONResponse(status_code=400, content={"detail": exc.message})


# --- REGISTRO DE ROUTERS ---
app.include_router(auth.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(pantry.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Endpoint de verificación de estado de la API."""
    return {
        "status": "ok",
        "message": "API del Asistente del Hogar funcionando correctamente",
    }


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    return {"message": "Bienvenido a la API del Asistente del Hogar IA"}
