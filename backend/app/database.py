import logging
import os
import sys
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Cargar archivo .env
load_dotenv()

# Configurar logger
logger = logging.getLogger("app.database")

# Obtener URL de base de datos desde entorno
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.critical(
        "Error crítico: La variable de entorno DATABASE_URL no está definida. Se requiere una cadena de conexión PostgreSQL asíncrona para iniciar. Abortando arranque..."
    )
    sys.exit(1)

# Railway/Heroku inyectan DATABASE_URL con el esquema síncrono (postgres:// o
# postgresql://). El engine asíncrono exige el driver asyncpg: reescribimos el
# prefijo para aceptar la variable inyectada sin tocar la configuración del panel.
if DATABASE_URL.startswith("postgresql+"):
    pass  # ya trae driver explícito (p. ej. postgresql+asyncpg://)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):  # alias legacy de Railway/Heroku
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

# Crear motor asíncrono de base de datos
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
)

# Fábrica de sesiones asíncronas
async_session_maker = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


# Clase base declarativa para modelos (estilo tipado SQLAlchemy 2.0)
class Base(DeclarativeBase):
    pass


# Helper para inyección de dependencia en FastAPI
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
