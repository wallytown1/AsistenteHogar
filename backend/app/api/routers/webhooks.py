"""Webhook de RevenueCat para sincronización de suscripciones en tiempo real.

Cuando un usuario compra, renueva, cancela o su pago falla, RC llama a este
endpoint. La única acción es invalidar el tier cacheado en Redis para ese
app_user_id, de modo que la próxima petición del usuario re-consulte el tier
real a la API de RC.

Autenticación: RC envía el secreto configurado en el header Authorization:
Bearer <REVENUECAT_WEBHOOK_SECRET>. Sin secreto configurado el endpoint devuelve
501 (desactivado en desarrollo/tests).
"""

import hmac
import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import REVENUECAT_WEBHOOK_SECRET
from app.services.premium import invalidate_tier_cache

logger = logging.getLogger("app.webhooks.revenuecat")

router = APIRouter(tags=["Webhooks"])

# Eventos que implican un cambio de tier (compra, renovación, cancelación, etc.)
_TIER_CHANGE_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "CANCELLATION",
    "EXPIRATION",
    "BILLING_ISSUE",
    "SUBSCRIBER_ALIAS",
}


@router.post("/webhooks/revenuecat", status_code=status.HTTP_200_OK)
async def revenuecat_webhook(request: Request) -> dict[str, object]:
    """Recibe eventos de suscripción de RevenueCat e invalida el cache de tier."""
    if not REVENUECAT_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Webhook de RevenueCat no configurado en este servidor.",
        )

    auth_header = request.headers.get("Authorization", "")
    expected = f"Bearer {REVENUECAT_WEBHOOK_SECRET}"
    # Comparación en tiempo constante: un `!=` normal corta en el primer byte
    # distinto y filtra la longitud/contenido del secreto por canal lateral de timing.
    # Se codifica a bytes: compare_digest sobre str solo admite ASCII y lanzaría
    # TypeError con una cabecera Authorization que traiga caracteres no-ASCII.
    if not hmac.compare_digest(auth_header.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firma de webhook inválida.",
        )

    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Payload JSON inválido."
        ) from exc

    event = body.get("event", {})
    event_type: str = event.get("type", "")
    app_user_id: str = event.get("app_user_id", "")

    if not app_user_id:
        return {"ok": True, "action": "ignored", "reason": "no app_user_id"}

    if event_type not in _TIER_CHANGE_EVENTS:
        return {"ok": True, "action": "ignored", "event_type": event_type}

    await invalidate_tier_cache(app_user_id)
    logger.info(f"Tier cache invalidado para {app_user_id} (evento: {event_type})")
    return {"ok": True, "action": "cache_invalidated", "event_type": event_type}
