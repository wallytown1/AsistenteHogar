"""Smoke test -- Gate premium (402) y cupos diarios de IA (429).

En los smoke tests REVENUECAT_SECRET_KEY="" desactiva el gate premium (is_premium
devuelve siempre True por diseño). Para EJERCITAR de verdad la rama 402 y los cupos
gratuitos, parcheamos `app.services.premium.is_premium` con unittest.mock.

`requiere_premium` y `daily_ai_quota` importan is_premium DENTRO de la función
(`from app.services.premium import is_premium`), así que parchear el símbolo en el
módulo de origen (`app.services.premium.is_premium`) afecta a ambos.

Verifica:
  - is_premium=False  => /ahorro/resumen y /pantry/recetas devuelven 402.
  - is_premium=True   => esos mismos endpoints NO devuelven 402.
  - Cupo diario (free): superar el tope diario de una función de IA => 429,
    con el mensaje del cupo (no el del rate-limit por IP).

Ejecutar: python smoke_test_premium.py
"""
import os
import sys
import uuid
from unittest.mock import AsyncMock, patch

_DBFILE = f"./smoke_premium_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DBFILE}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-premium-secret-key")
# Hermético: sin red. REVENUECAT vacío => gate OFF por defecto (lo forzamos con mocks).
os.environ["GEMINI_API_KEY"] = ""
os.environ["REVENUECAT_SECRET_KEY"] = ""
# Bajamos el cupo diario de ticket/pdf ANTES de importar la app para poder
# superarlo con pocas llamadas y ejercitar la rama 429 del cupo.
_CUPO = 3
os.environ["AI_FREE_DAILY_LIMIT_TICKET_PDF"] = str(_CUPO)

from alembic import command as alembic_command
from alembic.config import Config

alembic_command.upgrade(Config("alembic.ini"), "head")

from fastapi.testclient import TestClient
from app.main import app

fallos: list[str] = []


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    estado = "OK  " if condicion else "FALLO"
    print(f"[{estado}] {nombre}" + (f" ({detalle})" if detalle else ""))
    if not condicion:
        fallos.append(nombre)


def _registrar_hogar(client: TestClient, suffix: str) -> dict:
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": f"Hogar {suffix}", "nombre": f"User {suffix}",
        "email": f"premium_{suffix}@test.com", "password": "SecurePass123",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# Cuerpo mínimo válido para /pantry/ticket/pdf (el cupo se evalúa como dependencia
# ANTES del handler, así que el contenido del PDF no se llega a usar en los 429).
_TICKET_BODY = {
    "pdf_base64": "JVBERi0xLjQK",  # "%PDF-1.4" en base64 (mínimo)
    "fecha_referencia": "2026-06-24",
}


with TestClient(app) as client:
    headers = _registrar_hogar(client, "A")

    print("\n[Bloque 1] is_premium=False => 402 en endpoints premium")
    with patch("app.services.premium.is_premium", new=AsyncMock(return_value=False)):
        r = client.get("/api/v1/ahorro/resumen", headers=headers)
        check("1.1 /ahorro/resumen -> 402", r.status_code == 402, f"status={r.status_code}")
        r = client.get("/api/v1/pantry/recetas", headers=headers)
        check("1.2 /pantry/recetas -> 402", r.status_code == 402, f"status={r.status_code}")

    print("\n[Bloque 2] is_premium=True => los mismos endpoints NO dan 402")
    with patch("app.services.premium.is_premium", new=AsyncMock(return_value=True)):
        r = client.get("/api/v1/ahorro/resumen", headers=headers)
        check("2.1 /ahorro/resumen NO da 402", r.status_code != 402, f"status={r.status_code}")
        r = client.get("/api/v1/pantry/recetas", headers=headers)
        check("2.2 /pantry/recetas NO da 402", r.status_code != 402, f"status={r.status_code}")

    print(f"\n[Bloque 3] Cupo diario de IA (free, límite={_CUPO}) => 429")
    with patch("app.services.premium.is_premium", new=AsyncMock(return_value=False)):
        statuses: list[int] = []
        ultimo_detalle = ""
        # Con is_premium=False, el cupo se consume. Llamamos límite+2 veces:
        # las primeras `_CUPO` pasan el cupo; la siguiente debe dar 429.
        for _ in range(_CUPO + 2):
            r = client.post("/api/v1/pantry/ticket/pdf", json=_TICKET_BODY, headers=headers)
            statuses.append(r.status_code)
            if r.status_code == 429:
                try:
                    ultimo_detalle = r.json().get("detail", "")
                except Exception:
                    ultimo_detalle = ""
        check("3.1 superar el cupo diario devuelve 429", 429 in statuses,
              f"statuses={statuses}")
        # Distinguir el 429 del cupo del 429 del rate-limit por IP (mensaje distinto).
        check("3.2 el 429 es del cupo diario, no del rate-limit por IP",
              "límite diario" in ultimo_detalle.lower() or "cupo" in ultimo_detalle.lower()
              or "suscríbete" in ultimo_detalle.lower(),
              f"detalle={ultimo_detalle!r}")

    print("\n[Bloque 4] is_premium=True exime del cupo diario")
    with patch("app.services.premium.is_premium", new=AsyncMock(return_value=True)):
        # Aunque el cupo ya esté agotado para este hogar, premium queda exento del 429.
        r = client.post("/api/v1/pantry/ticket/pdf", json=_TICKET_BODY, headers=headers)
        check("4.1 premium no recibe 429 de cupo", r.status_code != 429, f"status={r.status_code}")


# Limpieza de la BD temporal.
# En Windows hay que liberar el engine (cierra el pool de conexiones aiosqlite)
# antes de borrar el fichero, o el SO impide el unlink por handle abierto.
try:
    import asyncio

    from app.database import engine
    asyncio.run(engine.dispose())
except Exception:
    pass
try:
    if os.path.exists(_DBFILE):
        os.remove(_DBFILE)
except OSError:
    pass

print("\n" + "=" * 50)
if fallos:
    print(f"smoke_test_premium: {len(fallos)} FALLO(S): {fallos}")
    sys.exit(1)
print("smoke_test_premium: todos los checks pasaron")
