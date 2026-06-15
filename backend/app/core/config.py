import logging
import os
import sys

from dotenv import load_dotenv

# Cargar archivo .env
load_dotenv()

logger = logging.getLogger("app.core.config")

# Clave secreta para firmar los tokens JWT. Obligatoria: sin ella no hay aislamiento multi-tenant.
_jwt_secret = os.getenv("JWT_SECRET_KEY")

if not _jwt_secret:
    logger.critical(
        "Error crítico: La variable de entorno JWT_SECRET_KEY no está definida. Se requiere para firmar los tokens de autenticación. Abortando arranque..."
    )
    sys.exit(1)

# Tras el chequeo, mypy estrecha el valor a str (sys.exit es NoReturn): así el
# símbolo exportado es str, no str | None (jwt.encode/decode exigen str).
JWT_SECRET_KEY: str = _jwt_secret

JWT_ALGORITHM = "HS256"

# Duración del token de acceso. Por defecto 30 días (app móvil sin refresh token por ahora).
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))

# Entorno de ejecución: 'development' (por defecto) o 'production'.
# En producción se ocultan los docs interactivos y el CORS no admite orígenes por defecto.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# Google Gemini. La clave es opcional: sin ella las funciones de IA operan en modo
# de contingencia (briefing estático, sin sugerencias de recetas).
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
