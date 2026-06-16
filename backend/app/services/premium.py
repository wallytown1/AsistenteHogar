"""Verificación de suscripción premium contra RevenueCat (server-side).

El freemium NO puede depender solo del gate de la UI: cualquier cliente con un
JWT válido podría llamar a los endpoints de IA directamente. Aquí validamos el
entitlement `premium` consultando la API REST de RevenueCat con la clave SECRETA
del servidor, y cacheamos el resultado en Redis (TTL corto) para no pegarle a
RevenueCat en cada request.

Comportamiento:
- Sin `REVENUECAT_SECRET_KEY` (desarrollo/tests): se considera a todos premium
  (el gate queda desactivado y la batería de smoke tests sigue verde).
- Ante un fallo de RevenueCat (caída/latencia): fail-open (se permite el acceso)
  para no bloquear a usuarios de pago durante una incidencia del proveedor. El
  abuso sigue acotado por los rate-limiters de los endpoints de IA.
"""

from __future__ import annotations

import datetime
import logging

from app.core.config import REVENUECAT_ENTITLEMENT, REVENUECAT_SECRET_KEY
from app.core.redis_client import get_redis
from app.services.llm import _get_http_client

logger = logging.getLogger("app.premium")

_RC_SUBSCRIBERS_URL = "https://api.revenuecat.com/v1/subscribers"
_PREMIUM_CACHE_TTL = 300  # 5 minutos


async def is_premium(app_user_id: str) -> bool:
    """Devuelve True si el usuario tiene el entitlement premium activo.

    `app_user_id` es el identificador con el que el cliente hace `logIn` en
    RevenueCat (el id de usuario derivado del JWT).
    """
    # Gate desactivado si no hay clave de servidor configurada.
    if not REVENUECAT_SECRET_KEY:
        return True

    cache_key = f"premium:{app_user_id}"
    redis = get_redis()
    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached is not None:
                return bool(cached == "1")
        except Exception as e:
            logger.warning(f"Error leyendo estado premium de Redis ({e}).")

    premium = await _query_revenuecat(app_user_id)

    if redis is not None:
        try:
            await redis.setex(cache_key, _PREMIUM_CACHE_TTL, "1" if premium else "0")
        except Exception as e:
            logger.warning(f"Error cacheando estado premium en Redis ({e}).")

    return premium


async def _query_revenuecat(app_user_id: str) -> bool:
    """Consulta la API REST de RevenueCat y evalúa el entitlement premium."""
    client = _get_http_client()
    try:
        resp = await client.get(
            f"{_RC_SUBSCRIBERS_URL}/{app_user_id}",
            headers={"Authorization": f"Bearer {REVENUECAT_SECRET_KEY}"},
        )
        resp.raise_for_status()
        data = resp.json()
        entitlements = data.get("subscriber", {}).get("entitlements", {})
        ent = entitlements.get(REVENUECAT_ENTITLEMENT)
        if not ent:
            return False

        expires = ent.get("expires_date")
        # expires_date nulo = suscripción vitalicia/no caduca.
        if expires is None:
            return True
        exp = datetime.datetime.fromisoformat(expires.replace("Z", "+00:00"))
        return exp > datetime.datetime.now(datetime.UTC)
    except Exception as e:
        # Fail-open: no bloquear a usuarios de pago si RevenueCat falla.
        logger.error(
            f"No se pudo verificar la suscripción en RevenueCat ({e}); "
            "se permite el acceso (fail-open)."
        )
        return True
