"""Conexión asíncrona a Redis (pool compartido).

Gestiona un pool de conexiones que se inicializa en el lifespan de FastAPI
y se cierra en el shutdown. La conexión es opcional: si REDIS_URL no está
configurada (o Redis no es alcanzable), la app sigue funcionando con los
fallbacks en memoria del rate limiter y la caché LLM.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import REDIS_URL

logger = logging.getLogger("app.core.redis")

_pool: Any = None


async def init_redis() -> Any:
    """Crea el pool de conexiones a Redis. Devuelve None si no está configurado
    o si la conexión inicial falla (la app arranca en modo degradado)."""
    import redis.asyncio as aioredis

    global _pool
    if not REDIS_URL:
        logger.warning(
            "REDIS_URL no configurada. Caché y rate-limit operarán en memoria "
            "(no apto para múltiples workers)."
        )
        return None

    try:
        _pool = aioredis.from_url(
            REDIS_URL,
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        # Verificar conectividad
        await _pool.ping()
        logger.info("Conexión a Redis establecida correctamente.")
        return _pool
    except Exception as e:
        logger.error(
            f"No se pudo conectar a Redis ({e}). "
            "La app operará en modo degradado (caché/rate-limit en memoria)."
        )
        _pool = None
        return None


async def close_redis() -> None:
    """Cierra el pool de conexiones a Redis."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
        logger.info("Conexión a Redis cerrada.")


def get_redis() -> Any:
    """Devuelve la conexión activa a Redis (o None si no está disponible)."""
    return _pool
