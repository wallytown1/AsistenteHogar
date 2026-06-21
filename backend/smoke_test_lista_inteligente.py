"""Smoke test -- Lista de la compra inteligente (Fase 2A).

Verifica GET /lista-compra/sugerencias: sugiere por cadencia del ledger, excluye lo que ya está
en la despensa o en la lista, y respeta el aislamiento multi-tenant. Inserta movimientos con fechas
concretas (vía repo async) para simular la cadencia, porque la API solo registra "ahora".

Ejecutar: python smoke_test_lista_inteligente.py
"""
import asyncio
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta

_DBFILE = f"./smoke_li_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DBFILE}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-lista-inteligente-key")
os.environ["GEMINI_API_KEY"] = ""
os.environ["REVENUECAT_SECRET_KEY"] = ""

from alembic import command as alembic_command
from alembic.config import Config

alembic_command.upgrade(Config("alembic.ini"), "head")

from fastapi.testclient import TestClient
from app.main import app
from app.models.models import MovimientoDespensa

fallos: list[str] = []


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    print(f"[{'OK  ' if condicion else 'FALLO'}] {nombre}" + (f" ({detalle})" if detalle else ""))
    if not condicion:
        fallos.append(nombre)


def _login(client: TestClient, suffix: str) -> dict:
    client.post("/api/v1/auth/registro", json={
        "nombre_hogar": f"Hogar {suffix}", "nombre": f"User {suffix}",
        "email": f"li_{suffix}@test.com", "password": "SecurePass123",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": f"li_{suffix}@test.com", "password": "SecurePass123",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _sembrar_compras(hogar_id: str, nombre: str, dias_atras: list[int]) -> None:
    from app.database import async_session_maker

    async with async_session_maker() as session:
        for d in dias_atras:
            session.add(MovimientoDespensa(
                hogar_id=uuid.UUID(hogar_id), nombre=nombre, tipo="compra",
                cantidad=1, unidad="ud", origen="ticket",
                fecha=datetime.now(UTC) - timedelta(days=d),
            ))
        await session.commit()


with TestClient(app) as client:
    hA = _login(client, "A")
    hB = _login(client, "B")

    # Capturar hogar_id de A creando un alimento (queda en stock).
    item = client.post("/api/v1/pantry", json={
        "nombre": "Cafe", "cantidad": 1, "unidad": "paquete", "categoria": "Despensa",
    }, headers=hA).json()
    hogarA = item["hogar_id"]

    # Sembrar histórico: leche (cadencia ~5d, última hace 7 → toca); huevos (cadencia ~2d,
    # última hace 1 → NO toca aún); pan (toca por cadencia, pero lo metemos en stock → excluido).
    asyncio.run(_sembrar_compras(hogarA, "leche", [17, 12, 7]))
    asyncio.run(_sembrar_compras(hogarA, "huevos", [3, 1]))
    asyncio.run(_sembrar_compras(hogarA, "pan", [20, 10]))
    client.post("/api/v1/pantry", json={
        "nombre": "Pan", "cantidad": 1, "unidad": "barra", "categoria": "Panadería",
    }, headers=hA)

    print("\n[Bloque 1] Sugerencias por cadencia")
    r = client.get("/api/v1/lista-compra/sugerencias", headers=hA)
    check("1.1 GET sugerencias -> 200", r.status_code == 200, f"status={r.status_code}, body={r.text[:200]}")
    nombres = {s["nombre"] for s in r.json()} if r.status_code == 200 else set()
    check("1.2 'leche' sugerida (toca por cadencia)", "leche" in nombres, f"sugeridas={nombres}")
    check("1.3 'huevos' NO sugerida (no toca aún)", "huevos" not in nombres)
    check("1.4 'pan' NO sugerida (ya en despensa)", "pan" not in nombres)
    check("1.5 'cafe' NO sugerida (solo 1 compra / en stock)", "cafe" not in nombres)
    leche = next((s for s in r.json() if s["nombre"] == "leche"), None) if r.status_code == 200 else None
    check("1.6 leche trae motivo", bool(leche and leche.get("motivo")))

    print("\n[Bloque 2] Exclusión por estar ya en la lista")
    client.post("/api/v1/lista-compra", json={"nombre": "leche"}, headers=hA)
    r = client.get("/api/v1/lista-compra/sugerencias", headers=hA)
    nombres2 = {s["nombre"] for s in r.json()}
    check("2.1 'leche' deja de sugerirse al estar en la lista", "leche" not in nombres2, f"sugeridas={nombres2}")

    print("\n[Bloque 3] Aislamiento y sin histórico")
    r = client.get("/api/v1/lista-compra/sugerencias", headers=hB)
    check("3.1 hogar B sin histórico -> []", r.status_code == 200 and r.json() == [], f"body={r.text[:120]}")
    r = client.get("/api/v1/lista-compra/sugerencias")
    check("3.2 sin token -> 401", r.status_code == 401, f"status={r.status_code}")


print("\n" + "=" * 50)
if fallos:
    print(f"smoke_test_lista_inteligente: {len(fallos)} FALLO(S): {fallos}")
    sys.exit(1)
print("smoke_test_lista_inteligente: todos los checks pasaron")
