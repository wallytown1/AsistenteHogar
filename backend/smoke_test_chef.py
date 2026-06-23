"""Smoke test -- Chef conversacional + memoria de gustos + valoracion en historial.

Sin GEMINI_API_KEY el chat devuelve fallback (generado_por_ia=False) y la destilacion
de memoria es no-op: se valida contrato, gating, validacion y aislamiento, no la calidad LLM.

Ejecutar: python smoke_test_chef.py
"""
import asyncio
import os
import sys
import uuid

_DB = f"./smoke_chef_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-chef-secret-key")
os.environ["GEMINI_API_KEY"] = ""
os.environ["REVENUECAT_SECRET_KEY"] = ""  # gate premium desactivado en tests

from alembic import command as alembic_command
from alembic.config import Config

alembic_cfg = Config("alembic.ini")
alembic_command.upgrade(alembic_cfg, "head")

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.models.models import MovimientoDespensa

fallos: list[str] = []
hogarA_id: str | None = None


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    estado = "OK  " if condicion else "FALLO"
    print(f"[{estado}] {nombre}" + (f" ({detalle})" if detalle else ""))
    if not condicion:
        fallos.append(nombre)


def _register_login(client: TestClient, suffix: str) -> dict:
    client.post("/api/v1/auth/registro", json={
        "nombre_hogar": f"Hogar {suffix}",
        "nombre": f"Usuario {suffix}",
        "email": f"chef_{suffix}@test.com",
        "password": "SecurePass123",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": f"chef_{suffix}@test.com",
        "password": "SecurePass123",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


with TestClient(app) as client:
    hA = _register_login(client, "A")
    hB = _register_login(client, "B")

    # --- Bloque 1: Chef chat ---
    print("\n[Bloque 1] Chef conversacional")

    r = client.post("/api/v1/chef/chat", json={"mensajes": [{"rol": "usuario", "texto": "hola"}]})
    check("1.1 Chat sin token -> 401", r.status_code == 401, f"status={r.status_code}")

    r = client.post("/api/v1/chef/chat", json={"mensajes": []}, headers=hA)
    check("1.2 mensajes vacios -> 422", r.status_code == 422, f"status={r.status_code}")

    r = client.post("/api/v1/chef/chat", json={
        "mensajes": [{"rol": "chef", "texto": "hola"}]
    }, headers=hA)
    check("1.3 ultimo mensaje no-usuario -> 422", r.status_code == 422, f"status={r.status_code}")

    r = client.post("/api/v1/chef/chat", json={
        "mensajes": [{"rol": "usuario", "texto": "rol_invalido?"}]
    }, headers=hA)
    # rol valido pero probamos rol invalido:
    r2 = client.post("/api/v1/chef/chat", json={
        "mensajes": [{"rol": "robot", "texto": "hola"}]
    }, headers=hA)
    check("1.4 rol invalido -> 422", r2.status_code == 422, f"status={r2.status_code}")

    r = client.post("/api/v1/chef/chat", json={
        "mensajes": [{"rol": "usuario", "texto": "Que puedo cocinar hoy?"}]
    }, headers=hA)
    check("1.5 Chat valido -> 200", r.status_code == 200, f"status={r.status_code}, body={r.text[:200]}")
    body = r.json() if r.status_code == 200 else {}
    check("1.6 Sin GEMINI key -> generado_por_ia False", body.get("generado_por_ia") is False)
    check("1.7 Devuelve mensaje de fallback", bool(body.get("mensaje")))

    r = client.post("/api/v1/chef/chat", json={
        "mensajes": [
            {"rol": "usuario", "texto": "tengo huevos"},
            {"rol": "chef", "texto": "podrias hacer una tortilla"},
            {"rol": "usuario", "texto": "y algo mas?"},
        ]
    }, headers=hA)
    check("1.8 Multi-turno valido -> 200", r.status_code == 200, f"status={r.status_code}")

    texto_largo = "a" * 1001
    r = client.post("/api/v1/chef/chat", json={
        "mensajes": [{"rol": "usuario", "texto": texto_largo}]
    }, headers=hA)
    check("1.9 Texto > 1000 chars -> 422", r.status_code == 422, f"status={r.status_code}")

    # --- Bloque 2: Valoracion en historial ---
    print("\n[Bloque 2] Valoracion en historial")

    r = client.post("/api/v1/pantry/recetas/historial", json={
        "nombre_receta": "Fabada asturiana", "accion": "cocinada",
        "valoracion": "me_encanto", "categoria": "guiso",
    }, headers=hA)
    check("2.1 POST con valoracion -> 201", r.status_code == 201, f"status={r.status_code}, body={r.text[:200]}")
    body = r.json() if r.status_code == 201 else {}
    check("2.2 Devuelve valoracion", body.get("valoracion") == "me_encanto")
    check("2.3 Devuelve categoria", body.get("categoria") == "guiso")

    r = client.post("/api/v1/pantry/recetas/historial", json={
        "nombre_receta": "X", "accion": "cocinada", "valoracion": "invalida",
    }, headers=hA)
    check("2.4 Valoracion invalida -> 422", r.status_code == 422, f"status={r.status_code}")

    r = client.post("/api/v1/pantry/recetas/historial", json={
        "nombre_receta": "Sin valoracion", "accion": "rechazada",
    }, headers=hA)
    check("2.5 Valoracion opcional (omitida) -> 201", r.status_code == 201, f"status={r.status_code}")
    check("2.6 valoracion None por defecto", r.json().get("valoracion") is None)

    # --- Bloque 3: Aislamiento multi-tenant ---
    print("\n[Bloque 3] Aislamiento")

    r = client.get("/api/v1/pantry/recetas/historial", headers=hB)
    check("3.1 hogar B no ve historial de A", r.status_code == 200 and r.json() == [], f"body={r.text[:100]}")

    r = client.get("/api/v1/pantry/recetas/historial", headers=hA)
    check("3.2 hogar A ve sus 2 entradas", r.status_code == 200 and len(r.json()) == 2, f"n={len(r.json())}")

    # --- Bloque 4: Restaurar (undo chef) ---
    print("\n[Bloque 4] Restaurar endpoint (undo chef)")

    r_loginA = client.post("/api/v1/auth/login", json={"email": "chef_A@test.com", "password": "SecurePass123"})
    hogarA_id = r_loginA.json().get("hogar", {}).get("id")

    r = client.post("/api/v1/pantry", json={
        "nombre": "Aceite de oliva", "cantidad": 1.0, "unidad": "litro", "categoria": "Aceites",
    }, headers=hA)
    check("4.1 Crear item para test restaurar -> 201", r.status_code == 201, f"status={r.status_code}")
    item_id = r.json().get("id") if r.status_code == 201 else None

    if item_id:
        r = client.post(f"/api/v1/pantry/{item_id}/agotar", headers=hA)
        check("4.2 Agotar item -> 200", r.status_code == 200, f"status={r.status_code}")

        r = client.get("/api/v1/pantry", headers=hA)
        ids_activos = [i["id"] for i in r.json().get("items", [])]
        check("4.3 Item agotado no aparece en GET /pantry", item_id not in ids_activos)

        r = client.post(f"/api/v1/pantry/{item_id}/restaurar", headers=hA)
        check("4.4 POST /restaurar -> 200", r.status_code == 200, f"status={r.status_code}")
        body = r.json() if r.status_code == 200 else {}
        check("4.5 Respuesta tiene is_deleted=False", body.get("is_deleted") is False)
        check("4.6 Respuesta conserva el mismo id", body.get("id") == item_id)

        r = client.get("/api/v1/pantry", headers=hA)
        ids_activos = [i["id"] for i in r.json().get("items", [])]
        check("4.7 Item restaurado reaparece en GET /pantry", item_id in ids_activos)

        r = client.post(f"/api/v1/pantry/{item_id}/restaurar", headers=hA)
        check("4.8 Restaurar item activo (no soft-deleted) -> 404", r.status_code == 404, f"status={r.status_code}")

        client.post(f"/api/v1/pantry/{item_id}/agotar", headers=hA)
        r = client.post(f"/api/v1/pantry/{item_id}/restaurar", headers=hB)
        check("4.9 Restaurar item ajeno (otro hogar) -> 404", r.status_code == 404, f"status={r.status_code}")


async def _verificar_ledger_restaurar() -> None:
    from app.database import async_session_maker

    async with async_session_maker() as session:
        stmt = select(MovimientoDespensa).where(
            MovimientoDespensa.hogar_id == uuid.UUID(hogarA_id),
            MovimientoDespensa.origen == "undo",
            MovimientoDespensa.tipo == "compra",
        )
        resultado = list((await session.execute(stmt)).scalars().all())
        check(
            "4.10 Ledger: compensación tipo=compra origen=undo registrada",
            len(resultado) >= 1,
            f"n={len(resultado)}",
        )


if hogarA_id:
    asyncio.run(_verificar_ledger_restaurar())

print("\n" + "=" * 50)
if fallos:
    print(f"smoke_test_chef: {len(fallos)} FALLO(S): {fallos}")
    sys.exit(1)
print("smoke_test_chef: todos los checks pasaron")
