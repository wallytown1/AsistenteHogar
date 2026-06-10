import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Limitador de peticiones por IP con ventana deslizante, en memoria.

    Suficiente para un despliegue de instancia única. Si el backend escala a
    varias réplicas, este estado deberá moverse a un almacén compartido
    (p. ej. Redis) — anotado como deuda técnica en el CHANGELOG.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    async def __call__(self, request: Request) -> None:
        ip = request.client.host if request.client else "desconocida"
        now = time.monotonic()
        hits = self._hits[ip]

        # Descartar peticiones fuera de la ventana
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()

        if len(hits) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos desde esta dirección. Espera unos minutos y vuelve a intentarlo."
            )
        hits.append(now)

        # Purga periódica: evitar crecimiento indefinido del diccionario de IPs
        if len(self._hits) > 10_000:
            inactivas = [k for k, v in self._hits.items() if not v or now - v[-1] > self.window_seconds]
            for k in inactivas:
                del self._hits[k]


# Límites para endpoints de autenticación (protección contra fuerza bruta)
login_rate_limiter = RateLimiter(max_requests=10, window_seconds=300)      # 10 intentos / 5 min
registro_rate_limiter = RateLimiter(max_requests=10, window_seconds=3600)  # 10 registros / hora
