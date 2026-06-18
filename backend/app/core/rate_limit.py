"""Limitador de peticiones por IP con ventana deslizante.

Estrategia dual:
- Si Redis está disponible: sorted set por IP con timestamps como scores
  (compartido entre workers, persistente ante reinicios).
- Sin Redis: fallback en memoria con deque (comportamiento original, solo
  válido para instancia única).

La interfaz pública (RateLimiter como dependencia FastAPI) es idéntica en
ambos modos: el router no necesita saber qué backend usa.
"""

import logging
import time
import uuid
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.redis_client import get_redis

logger = logging.getLogger("app.core.rate_limit")

_RATE_LIMIT_ERROR = (
    "Demasiados intentos desde esta dirección. "
    "Espera unos minutos y vuelve a intentarlo."
)


class RateLimiter:
    """Limitador de peticiones por IP con ventana deslizante.

    Usa Redis (sorted sets) cuando está disponible; si no, opera en memoria
    con deques (compatible con instancia única).
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Fallback en memoria (solo se usa si Redis no está disponible)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def __call__(self, request: Request) -> None:
        ip = request.client.host if request.client else "desconocida"
        redis = get_redis()

        if redis is not None:
            await self._check_redis(redis, ip)
        else:
            self._check_memory(ip)

    async def _check_redis(self, redis: "object", ip: str) -> None:
        """Ventana deslizante con sorted set de Redis.

        Clave: rl:{clase}:{ip}
        Score: timestamp Unix (float).
        Miembro: timestamp como string (único por petición).
        """
        from typing import Any as _Any

        r: _Any = redis
        key = f"rl:{self.max_requests}_{self.window_seconds}:{ip}"
        now = time.time()
        window_start = now - self.window_seconds
        # Miembro único por petición: dos requests con el mismo timestamp float
        # no deben colapsar en el sorted set (zadd dedupe) y subcontar.
        member = f"{now}:{uuid.uuid4().hex}"

        pipe = r.pipeline()
        # 1. Limpiar entradas fuera de la ventana
        pipe.zremrangebyscore(key, "-inf", window_start)
        # 2. Contar entradas dentro de la ventana
        pipe.zcard(key)
        # 3. Añadir la petición actual (score = timestamp)
        pipe.zadd(key, {member: now})
        # 4. Renovar TTL del set
        pipe.expire(key, self.window_seconds + 1)

        try:
            results = await pipe.execute()
            count = results[1]  # zcard
        except Exception as e:
            logger.warning(f"Error de Redis en rate-limit ({e}); fallback a memoria.")
            self._check_memory(ip)
            return

        if count >= self.max_requests:
            # Deshacer la adición (ya se añadió antes de comprobar)
            try:
                await r.zrem(key, member)
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=_RATE_LIMIT_ERROR,
            )

    def _check_memory(self, ip: str) -> None:
        """Fallback en memoria: comportamiento original con deque."""
        now = time.monotonic()
        hits = self._hits[ip]

        # Descartar peticiones fuera de la ventana
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()

        if len(hits) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=_RATE_LIMIT_ERROR,
            )
        hits.append(now)

        # Purga periódica: evitar crecimiento indefinido del diccionario de IPs
        if len(self._hits) > 10_000:
            inactivas = [
                k
                for k, v in self._hits.items()
                if not v or now - v[-1] > self.window_seconds
            ]
            for k in inactivas:
                del self._hits[k]


# --- Instancias preconfiguradas -------------------------------------------------

# Autenticación (protección contra fuerza bruta)
login_rate_limiter = RateLimiter(
    max_requests=10, window_seconds=300
)  # 10 intentos / 5 min
registro_rate_limiter = RateLimiter(
    max_requests=10, window_seconds=3600
)  # 10 registros / hora
# Eliminación de cuenta: re-autentica con contraseña
cuenta_eliminar_rate_limiter = RateLimiter(
    max_requests=5, window_seconds=3600
)  # 5 intentos / hora

# Endpoints de IA (control de coste/abuso de la API de Gemini)
interpretar_rate_limiter = RateLimiter(
    max_requests=20, window_seconds=300
)  # 20 / 5 min
audio_rate_limiter = RateLimiter(
    max_requests=30, window_seconds=300
)  # 30 / 5 min (dictado más frecuente que texto)
recetas_rate_limiter = RateLimiter(max_requests=20, window_seconds=3600)  # 20 / hora
metadata_rate_limiter = RateLimiter(max_requests=40, window_seconds=300)  # 40 / 5 min
plan_comidas_rate_limiter = RateLimiter(
    max_requests=10, window_seconds=3600
)  # 10 / hora
foto_nevera_rate_limiter = RateLimiter(
    max_requests=10, window_seconds=3600
)  # 10 / hora (Vision es más costosa)
