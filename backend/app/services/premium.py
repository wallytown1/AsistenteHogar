"""Verificación de suscripción por tiers contra RevenueCat (server-side).

Tiers (de menor a mayor):
- free    : sin suscripción activa
- premium : entitlement "premium" activo  → IA features (OCR, audio, foto nevera, recetas IA)
- familia : entitlement "familia" activo  → todo Premium + perfiles individuales + plan semanal

Familia ⊃ Premium: un usuario Familia tiene acceso a todos los endpoints premium
Y a los exclusivos de Familia. Un usuario Premium NO tiene acceso a los de Familia.

Sin REVENUECAT_SECRET_KEY (desarrollo/tests): todos se consideran "familia" para
no bloquear ninguna feature durante el desarrollo.

Ante un fallo de RevenueCat (caída/latencia): fail-open (se considera "familia")
para no bloquear usuarios de pago durante una incidencia del proveedor.
"""

from __future__ import annotations

import datetime
import logging

from app.core.config import (
    REVENUECAT_ENTITLEMENT,
    REVENUECAT_FAMILIA_ENTITLEMENT,
    REVENUECAT_SECRET_KEY,
)
from app.core.redis_client import get_redis
from app.services.llm import _get_http_client

logger = logging.getLogger("app.premium")

_RC_SUBSCRIBERS_URL = "https://api.revenuecat.com/v1/subscribers"
_TIER_CACHE_TTL = 300  # 5 minutos

TIER_FREE = "free"
TIER_PREMIUM = "premium"
TIER_FAMILIA = "familia"


async def _get_tier(app_user_id: str) -> str:
    """Devuelve el tier activo: 'free', 'premium' o 'familia'."""
    if not REVENUECAT_SECRET_KEY:
        return TIER_FAMILIA

    cache_key = f"tier:{app_user_id}"
    redis = get_redis()
    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached is not None:
                value = cached.decode() if isinstance(cached, bytes) else str(cached)
                if value in (TIER_FREE, TIER_PREMIUM, TIER_FAMILIA):
                    return value
        except Exception as e:
            logger.warning(f"Error leyendo tier de Redis ({e}).")

    tier = await _query_tier(app_user_id)

    if redis is not None:
        try:
            await redis.setex(cache_key, _TIER_CACHE_TTL, tier)
        except Exception as e:
            logger.warning(f"Error cacheando tier en Redis ({e}).")

    return tier


async def invalidate_tier_cache(app_user_id: str) -> None:
    """Elimina el tier cacheado para que la siguiente petición lo re-consulte a RC.
    Llamado por el webhook de RC al recibir eventos de suscripción."""
    redis = get_redis()
    if redis is not None:
        try:
            await redis.delete(f"tier:{app_user_id}")
        except Exception as e:
            logger.warning(f"Error invalidando cache de tier en Redis ({e}).")


async def is_premium(app_user_id: str) -> bool:
    """True si el usuario tiene acceso premium o superior (tier premium o familia)."""
    return await _get_tier(app_user_id) in (TIER_PREMIUM, TIER_FAMILIA)


async def is_familia(app_user_id: str) -> bool:
    """True si el usuario tiene el tier Familia (plan anual con perfiles + plan semanal)."""
    return await _get_tier(app_user_id) == TIER_FAMILIA


async def _query_tier(app_user_id: str) -> str:
    """Consulta la API REST de RevenueCat y determina el tier activo."""
    client = _get_http_client()
    try:
        resp = await client.get(
            f"{_RC_SUBSCRIBERS_URL}/{app_user_id}",
            headers={"Authorization": f"Bearer {REVENUECAT_SECRET_KEY}"},
        )
        resp.raise_for_status()
        data = resp.json()
        entitlements = data.get("subscriber", {}).get("entitlements", {})

        now = datetime.datetime.now(datetime.UTC)

        def _is_active(ent: dict) -> bool:  # type: ignore[type-arg]
            expires = ent.get("expires_date")
            if expires is None:
                return True  # vitalicio
            exp = datetime.datetime.fromisoformat(expires.replace("Z", "+00:00"))
            return exp > now

        # Familia tiene prioridad (es el tier superior)
        familia_ent = entitlements.get(REVENUECAT_FAMILIA_ENTITLEMENT)
        if familia_ent and _is_active(familia_ent):
            return TIER_FAMILIA

        premium_ent = entitlements.get(REVENUECAT_ENTITLEMENT)
        if premium_ent and _is_active(premium_ent):
            return TIER_PREMIUM

        return TIER_FREE
    except Exception as e:
        logger.error(
            f"No se pudo verificar la suscripción en RevenueCat ({e}); "
            "se permite el acceso (fail-open)."
        )
        return TIER_FAMILIA  # fail-open
