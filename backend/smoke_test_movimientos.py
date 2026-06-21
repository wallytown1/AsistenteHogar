"""Smoke test -- Ledger de movimientos de despensa (Fase 1: inteligencia de stock).

Verifica que las operaciones de despensa (POST/PATCH/DELETE /pantry) registran el movimiento
correcto en `movimientos_despensa`, que los agregados de hábitos funcionan y el aislamiento multi-tenant.
Las aserciones del ledger se hacen vía el repositorio async (misma engine que la app) porque una
conexión sqlite3 separada no ve los commits de aiosqlite durante el TestClient.

Ejecutar: python smoke_test_movimientos.py
"""
import asyncio
import os
import sys
import uuid

_DBFILE = f"./smoke_mov_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DBFILE}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-movimientos-secret-key")
os.environ["GEMINI_API_KEY"] = ""
os.environ["REVENUECAT_SECRET_KEY"] = ""

from alembic import command as alembic_command
from alembic.config import Config

alembic_command.upgrade(Config("alembic.ini"), "head")

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.models.models import MovimientoDespensa

fallos: list[str] = []


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    estado = "OK  " if condicion else "FALLO"
    print(f"[{estado}] {nombre}" + (f" ({detalle})" if detalle else ""))
    if not condicion:
        fallos.append(nombre)


def _login(client: TestClient, suffix: str) -> dict:
    client.post("/api/v1/auth/registro", json={
        "nombre_hogar": f"Hogar {suffix}", "nombre": f"User {suffix}",
        "email": f"mov_{suffix}@test.com", "password": "SecurePass123",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": f"mov_{suffix}@test.com", "password": "SecurePass123",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# --- Operaciones de despensa vía API (la DI cablea el ledger) ---
with TestClient(app) as client:
    hA = _login(client, "A")
    hB = _login(client, "B")

    r = client.post("/api/v1/pantry", json={"nombre": "Leche", "cantidad": 2, "unidad": "litro", "categoria": "Lácteos"}, headers=hA)
    check("0.1 POST item -> 201", r.status_code == 201, f"status={r.status_code}, body={r.text[:160]}")
    item1 = r.json()
    hogarA = item1["hogar_id"]
    item2 = client.post("/api/v1/pantry", json={"nombre": "Huevos", "cantidad": 12, "unidad": "unidad", "categoria": "Frescos"}, headers=hA).json()

    client.patch(f"/api/v1/pantry/{item1['id']}", json={"cantidad": 1}, headers=hA)   # 2 -> 1 (consumo 1)
    client.patch(f"/api/v1/pantry/{item1['id']}", json={"cantidad": 4}, headers=hA)   # 1 -> 4 (compra 3)
    client.delete(f"/api/v1/pantry/{item2['id']}", headers=hA)                         # consumo (no caducado)

    client.post("/api/v1/pantry", json={"nombre": "Pan", "cantidad": 1, "unidad": "unidad", "categoria": "Panadería"}, headers=hB)
    rB = client.get("/api/v1/pantry", headers=hB)
    hogarB = rB.json()["items"][0]["hogar_id"]


async def _verificar() -> None:
    from app.database import async_session_maker
    from app.repositories.movimientos import MovimientoDespensaRepository

    async with async_session_maker() as session:
        async def movs(hogar_id: str, tipo: str | None = None) -> list[MovimientoDespensa]:
            stmt = select(MovimientoDespensa).where(MovimientoDespensa.hogar_id == uuid.UUID(hogar_id))
            if tipo:
                stmt = stmt.where(MovimientoDespensa.tipo == tipo)
            return list((await session.execute(stmt)).scalars().all())

        print("\n[Bloque 1] Compra al añadir")
        compras = await movs(hogarA, "compra")
        # 2 altas + 1 subida de cantidad = 3 compras
        check("1.1 'compra' registradas (2 altas + 1 subida)", len(compras) == 3, f"n={len(compras)}")
        check("1.2 Nombre normalizado a minúsculas", any(m.nombre == "leche" for m in compras))
        altas = [m for m in compras if m.origen == "manual"]
        check("1.3 Dos altas con origen 'manual'", len(altas) == 2, f"n={len(altas)}")

        print("\n[Bloque 2] Consumo al bajar / compra al subir")
        consumos = await movs(hogarA, "consumo")
        # 1 bajada de cantidad + 1 borrado = 2 consumos
        check("2.1 'consumo' registrados (bajada + borrado)", len(consumos) == 2, f"n={len(consumos)}")
        baja = next((m for m in consumos if m.origen == "edicion"), None)
        check("2.2 Consumo por edición con delta 1.0", baja is not None and abs(float(baja.cantidad) - 1.0) < 1e-6,
              f"cant={getattr(baja, 'cantidad', None)}")
        subida = next((m for m in compras if m.origen == "edicion"), None)
        check("2.3 Subida genera 'compra' (edicion) delta 3.0", subida is not None and abs(float(subida.cantidad) - 3.0) < 1e-6,
              f"cant={getattr(subida, 'cantidad', None)}")

        print("\n[Bloque 3] Aislamiento multi-tenant")
        movsB = await movs(hogarB)
        check("3.1 hogar B tiene su propio movimiento", len(movsB) == 1, f"n={len(movsB)}")
        check("3.2 hogar B no ve movimientos de A", all(m.nombre != "leche" for m in movsB))

        print("\n[Bloque 4] Agregados de hábitos")
        repo = MovimientoDespensaRepository(session)
        habitos = await repo.habitos_compra(uuid.UUID(hogarA))
        consumo_agg = await repo.ritmo_consumo(uuid.UUID(hogarA))
        nombres = {h.nombre for h in habitos}
        check("4.1 habitos_compra agrega por alimento", "leche" in nombres and "huevos" in nombres, f"nombres={nombres}")
        leche = next((h for h in habitos if h.nombre == "leche"), None)
        check("4.2 leche cuenta 2 compras (alta + subida)", leche is not None and leche.veces == 2, f"veces={getattr(leche, 'veces', None)}")
        check("4.3 ritmo_consumo devuelve consumos", len(consumo_agg) >= 1, f"n={len(consumo_agg)}")


asyncio.run(_verificar())

print("\n" + "=" * 50)
if fallos:
    print(f"smoke_test_movimientos: {len(fallos)} FALLO(S): {fallos}")
    sys.exit(1)
print("smoke_test_movimientos: todos los checks pasaron")
