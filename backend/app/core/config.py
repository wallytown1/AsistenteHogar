import os
import sys
import logging
from dotenv import load_dotenv

# Cargar archivo .env
load_dotenv()

logger = logging.getLogger("app.core.config")

# Clave secreta para firmar los tokens JWT. Obligatoria: sin ella no hay aislamiento multi-tenant.
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY:
    logger.critical("Error crítico: La variable de entorno JWT_SECRET_KEY no está definida. Se requiere para firmar los tokens de autenticación. Abortando arranque...")
    sys.exit(1)

JWT_ALGORITHM = "HS256"

# Duración del token de acceso. Por defecto 30 días (app móvil sin refresh token por ahora).
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))

# Entorno de ejecución: 'development' (por defecto) o 'production'.
# En producción se ocultan los docs interactivos y el CORS no admite orígenes por defecto.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"
