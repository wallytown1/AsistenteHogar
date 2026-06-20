"""Blocklist de JTI para invalidación de tokens JWT en servidor (logout real).

Estrategia dual Redis / en-memoria:
- Redis disponible: SET con TTL = tiempo restante del token (limpieza automática).
- Sin Redis: set en memoria (válido para proceso único; no persiste entre reinicios).
"""

import time
from typing import Any

from app.core.redis_client import get_redis

_PREFIX = "jti:"
_memory_blocklist: set[str] = set()


async def revoke_token(jti: str, exp: int) -> None:
    """Añade el JTI al blocklist con TTL = segundos restantes hasta la expiración."""
    redis: Any = get_redis()
    if redis is not None:
        try:
            remaining = max(exp - int(time.time()), 1)
            await redis.setex(f"{_PREFIX}{jti}", remaining, "1")
            return
        except Exception:
            pass
    _memory_blocklist.add(jti)


async def is_token_revoked(jti: str) -> bool:
    """Devuelve True si el JTI ha sido revocado (logout explícito)."""
    redis: Any = get_redis()
    if redis is not None:
        try:
            return bool(await redis.exists(f"{_PREFIX}{jti}"))
        except Exception:
            pass
    return jti in _memory_blocklist
