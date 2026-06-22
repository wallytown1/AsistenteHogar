"""Smoke test -- Confianza de stock que decae + "se acabó"/"sigo teniéndolo" (Fase 2B).

Verifica que un alimento se marca `incierto` cuando, según su cadencia de compra (ledger), ha pasado su
intervalo desde la última confirmación; que confirmar lo renueva; que agotar lo borra y registra
'agotado'; y el aislamiento multi-tenant.

Ejecutar: python smoke_test_confianza.py
"""
import asyncio
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta

_DBFILE = f"./smoke_cf_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DBFILE}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-confianza-key")
os.environ["GEMINI_API_KEY"] = ""
os.environ["REVENUECAT_SECRET_KEY"] = ""

from alembic import command as alembic_command
from alembic.config import Config

alembic_command.upgrade(Config("alembic.ini"), "head")

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.models.models import InventarioAlimento, MovimientoDespensa

fallos: list[str] = []


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    print(f"[{'OK  ' if condicion else 'FALLO'}] {nombre}" + (f" ({detalle})" if detalle else ""))
    if not condicion:
        fallos.append(nombre)


def _login(client: TestClient, suffix: str) -> dict:
    client.post("/api/v1/auth/registro", json={
        "nombre_hogar": f"Hogar {suffix}", "nombre": f"User {suffix}",
        "email": f"cf_{suffix}@test.com", "password": "SecurePass123",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": f"cf_{suffix}@test.com", "password": "SecurePass123",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _preparar(hogar_id: str, item_id: str) -> None:
    """Siembra cadencia de compra de leche (~5d) y envejece la última confirmación a -10d."""
    from app.database import async_session_maker

    async with async_session_maker() as session:
        for d in (17, 12, 7):
            session.add(MovimientoDespensa(
                hogar_id=uuid.UUID(hogar_id), nombre="leche", tipo="compra",
                cantidad=1, unidad="litro", origen="ticket",
                fecha=datetime.now(UTC) - timedelta(days=d),
            ))
        item = (await session.execute(
            select(InventarioAlimento).where(InventarioAlimento.id == uuid.UUID(item_id))
        )).scalar_one()
        item.ultima_confirmacion = datetime.now(UTC) - timedelta(days=10)
        await session.commit()


async def _mov_agotado(hogar_id: str) -> int:
    from app.database import async_session_maker

    async with async_session_maker() as session:
        rows = (await session.execute(
            select(MovimientoDespensa).where(
                MovimientoDespensa.hogar_id == uuid.UUID(hogar_id),
                MovimientoDespensa.origen == "agotado",
            )
        )).scalars().all()
        return len(rows)


with TestClient(app) as client:
    hA = _login(client, "A")
    hB = _login(client, "B")

    item = client.post("/api/v1/pantry", json={
        "nombre": "Leche", "cantidad": 2, "unidad": "litro", "categoria": "Lácteos",
    }, headers=hA).json()
    hogarA = item["hogar_id"]
    item_id = item["id"]

    asyncio.run(_preparar(hogarA, item_id))

    print("\n[Bloque 1] Incierto por cadencia")
    r = client.get("/api/v1/pantry", headers=hA)
    leche = next((i for i in r.json()["items"] if i["id"] == item_id), None)
    check("1.1 GET /pantry -> 200", r.status_code == 200)
    check("1.2 leche marcada incierto (cadencia 5d, conf. hace 10d)", bool(leche and leche.get("incierto") is True),
          f"incierto={leche.get('incierto') if leche else None}")

    print("\n[Bloque 2] Confirmar renueva la confianza")
    r = client.post(f"/api/v1/pantry/{item_id}/confirmar", headers=hA)
    check("2.1 POST confirmar -> 200", r.status_code == 200, f"status={r.status_code}")
    r = client.get("/api/v1/pantry", headers=hA)
    leche = next((i for i in r.json()["items"] if i["id"] == item_id), None)
    check("2.2 leche ya NO es incierto tras confirmar", bool(leche and leche.get("incierto") is False))

    print("\n[Bloque 3] Aislamiento")
    r = client.post(f"/api/v1/pantry/{item_id}/confirmar", headers=hB)
    check("3.1 confirmar item ajeno -> 404", r.status_code == 404, f"status={r.status_code}")
    r = client.post(f"/api/v1/pantry/{item_id}/agotar", headers=hB)
    check("3.2 agotar item ajeno -> 404", r.status_code == 404, f"status={r.status_code}")

    print("\n[Bloque 4] Se acabó")
    r = client.post(f"/api/v1/pantry/{item_id}/agotar", headers=hA)
    check("4.1 POST agotar -> 200", r.status_code == 200, f"status={r.status_code}")
    r = client.get("/api/v1/pantry", headers=hA)
    presente = any(i["id"] == item_id for i in r.json()["items"])
    check("4.2 leche ya no está en la despensa", not presente)
    check("4.3 movimiento 'agotado' registrado", asyncio.run(_mov_agotado(hogarA)) == 1)

    print("\n[Bloque 5] Validación")
    r = client.post("/api/v1/pantry/no-uuid/agotar", headers=hA)
    check("5.1 id no-UUID -> 422", r.status_code == 422, f"status={r.status_code}")


print("\n" + "=" * 50)
if fallos:
    print(f"smoke_test_confianza: {len(fallos)} FALLO(S): {fallos}")
    sys.exit(1)
print("smoke_test_confianza: todos los checks pasaron")
