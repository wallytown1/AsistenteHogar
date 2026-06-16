"""Conexión asíncrona a Redis (pool compartido).

Gestiona un pool de conexiones que se inicializa en el lifespan de FastAPI
y se cierra en el shutdown. La conexión es opcional: si REDIS_URL no está
configurada (o Redis no es alcanzable), la app sigue funcionando con los
fallbacks en memoria del rate limiter y la caché LLM.

Reconexión perezosa: si Redis no estaba disponible al arrancar (escenario
habitual en Railway, donde el backend puede bootear antes que el contenedor
Redis), `get_redis()` reintenta la conexión en segundo plano con un cooldown,
en lugar de quedar degradado para toda la vida del proceso.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from app.core.config import REDIS_URL

logger = logging.getLogger("app.core.redis")

_pool: Any = None
# Marca de tiempo del último intento de conexión (para el cooldown de reconexión).
_last_attempt: float = 0.0
# Tiempo mínimo entre reintentos de reconexión perezosa (segundos).
_RECONNECT_COOLDOWN = 30.0


def _build_pool() -> Any:
    """Crea el cliente Redis con timeouts ajustados. No verifica conectividad.

    Solo se llama cuando REDIS_URL está definida (los llamantes lo garantizan).
    """
    import redis.asyncio as aioredis

    assert REDIS_URL is not None
    return aioredis.from_url(
        REDIS_URL,
        decode_responses=True,
        max_connections=20,
        # Timeouts cortos: si Redis está lento/caído, fallamos rápido a memoria
        # en vez de bloquear cada request hasta 5 s.
        socket_connect_timeout=2,
        socket_timeout=2,
    )


async def init_redis() -> Any:
    """Crea el pool de conexiones a Redis. Devuelve None si no está configurado
    o si la conexión inicial falla (la app arranca en modo degradado, pero
    `get_redis()` reintentará la conexión más tarde)."""
    global _pool, _last_attempt
    if not REDIS_URL:
        logger.warning(
            "REDIS_URL no configurada. Caché y rate-limit operarán en memoria "
            "(no apto para múltiples workers)."
        )
        return None

    _last_attempt = time.monotonic()
    try:
        pool = _build_pool()
        # Verificar conectividad
        await pool.ping()
        _pool = pool
        logger.info("Conexión a Redis establecida correctamente.")
        return _pool
    except Exception as e:
        logger.error(
            f"No se pudo conectar a Redis ({e}). "
            "La app operará en modo degradado (caché/rate-limit en memoria) "
            "y reintentará la conexión más adelante."
        )
        _pool = None
        return None


def _schedule_reconnect() -> None:
    """Lanza un intento de reconexión en segundo plano respetando el cooldown.

    No bloquea la request actual: esta sigue su camino con el fallback en memoria
    mientras Redis vuelve a estar disponible para las siguientes.
    """
    global _last_attempt
    if not REDIS_URL:
        return
    now = time.monotonic()
    if now - _last_attempt < _RECONNECT_COOLDOWN:
        return
    _last_attempt = now

    async def _attempt() -> None:
        global _pool
        try:
            pool = _build_pool()
            await pool.ping()
            _pool = pool
            logger.info("Reconexión a Redis establecida correctamente.")
        except Exception as e:
            logger.warning(f"Reintento de conexión a Redis fallido ({e}).")

    try:
        asyncio.get_running_loop().create_task(_attempt())
    except RuntimeError:
        # Sin loop en ejecución (no debería ocurrir bajo FastAPI): se omite.
        pass


async def close_redis() -> None:
    """Cierra el pool de conexiones a Redis."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
        logger.info("Conexión a Redis cerrada.")


def get_redis() -> Any:
    """Devuelve la conexión activa a Redis (o None si no está disponible).

    Si Redis está configurado pero el pool no existe (fallo de arranque o caída
    posterior), agenda un intento de reconexión no bloqueante y devuelve None
    para que el llamante use su fallback en memoria en esta request.
    """
    if _pool is None:
        _schedule_reconnect()
    return _pool
