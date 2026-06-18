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

# Redis. Opcional: sin ella la caché y el rate-limit operan en memoria (instancia
# única). En producción con múltiples workers debe apuntar a un Redis compartido.
REDIS_URL = os.getenv("REDIS_URL")

# RevenueCat (freemium). Clave SECRETA del servidor (NO la SDK key pública del
# cliente): se usa para validar suscripciones contra la API REST de RevenueCat.
# Si NO está configurada, el gate premium se desactiva y todos los endpoints de
# IA quedan accesibles (modo desarrollo/test). En producción debe estar definida
# para que el freemium se aplique en el servidor y no solo en la UI.
REVENUECAT_SECRET_KEY = os.getenv("REVENUECAT_SECRET_KEY")
# Identificador del entitlement premium configurado en RevenueCat.
REVENUECAT_ENTITLEMENT = os.getenv("REVENUECAT_ENTITLEMENT", "premium")

# Panel de administración. JWT firmado con una clave SEPARADA del JWT familiar
# para que los tokens de admin y los de usuarios del hogar no sean intercambiables.
# Si ADMIN_JWT_SECRET_KEY no está definida, los endpoints /admin/* devuelven 503.
ADMIN_JWT_SECRET_KEY: str | None = os.getenv("ADMIN_JWT_SECRET_KEY")
ADMIN_JWT_EXPIRE_MINUTES: int = int(os.getenv("ADMIN_JWT_EXPIRE_MINUTES", "480"))
# Token de un solo uso para crear el primer admin (bootstrap). Desactivado si no
# está definido (501). Después del primer admin se recomienda borrar esta variable.
ADMIN_BOOTSTRAP_TOKEN: str | None = os.getenv("ADMIN_BOOTSTRAP_TOKEN")
