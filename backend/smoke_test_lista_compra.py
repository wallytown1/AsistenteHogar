"""Smoke test -- Lista de la compra.
Verifica CRUD completo, borrado masivo de marcados, aislamiento multi-tenant y validacion.

Ejecutar: python smoke_test_lista_compra.py
"""
import os
import sys
import uuid

_DB = f"./smoke_lista_compra_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-lista-compra-secret-key")
os.environ["GEMINI_API_KEY"] = ""
os.environ["REVENUECAT_SECRET_KEY"] = ""  # gate desactivado en tests

from alembic import command as alembic_command
from alembic.config import Config

alembic_cfg = Config("alembic.ini")
alembic_command.upgrade(alembic_cfg, "head")

from fastapi.testclient import TestClient
from app.main import app

fallos: list[str] = []


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    estado = "OK  " if condicion else "FALLO"
    print(f"[{estado}] {nombre}" + (f" ({detalle})" if detalle else ""))
    if not condicion:
        fallos.append(nombre)


def _register_login(client: TestClient, suffix: str) -> dict:
    client.post("/api/v1/auth/registro", json={
        "nombre_hogar": f"Hogar {suffix}",
        "nombre": f"Usuario {suffix}",
        "email": f"lista_{suffix}@test.com",
        "password": "SecurePass123",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": f"lista_{suffix}@test.com",
        "password": "SecurePass123",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


with TestClient(app) as client:

    # ------------------------------------------------------------------
    # Bloque 1: CRUD basico
    # ------------------------------------------------------------------
    print("\n[Bloque 1] CRUD basico")
    hA = _register_login(client, "A")

    r = client.get("/api/v1/lista-compra", headers=hA)
    check("1.1 GET lista vacia (200)", r.status_code == 200 and r.json() == [], f"status={r.status_code}")

    r = client.post("/api/v1/lista-compra", json={"nombre": "Leche"}, headers=hA)
    check("1.2 POST item simple (201)", r.status_code == 201, f"status={r.status_code}, body={r.text[:200]}")
    item1_id = r.json().get("id", "")
    check("1.3 Nombre correcto", r.json().get("nombre") == "Leche")
    check("1.4 is_checked=False por defecto", r.json().get("is_checked") is False)
    check("1.5 cantidad y unidad None por defecto",
          r.json().get("cantidad") is None and r.json().get("unidad") is None)

    r = client.post("/api/v1/lista-compra",
                    json={"nombre": "Huevos", "cantidad": 6, "unidad": "unidades"}, headers=hA)
    check("1.6 POST con cantidad+unidad (201)", r.status_code == 201, f"status={r.status_code}")
    item2_id = r.json().get("id", "")
    check("1.7 cantidad y unidad guardadas",
          r.json().get("cantidad") == 6.0 and r.json().get("unidad") == "unidades")

    r = client.get("/api/v1/lista-compra", headers=hA)
    check("1.8 GET lista con 2 items", r.status_code == 200 and len(r.json()) == 2)

    r = client.patch(f"/api/v1/lista-compra/{item1_id}", json={"is_checked": True}, headers=hA)
    check("1.9 PATCH marcar como comprado", r.status_code == 200 and r.json().get("is_checked") is True)

    r = client.patch(f"/api/v1/lista-compra/{item2_id}", json={"nombre": "Huevos camperos"}, headers=hA)
    check("1.10 PATCH cambiar nombre", r.status_code == 200 and r.json().get("nombre") == "Huevos camperos")

    r = client.get("/api/v1/lista-compra", headers=hA)
    items = r.json()
    pendiente_first = len(items) == 2 and items[0]["is_checked"] is False
    check("1.11 Orden: pendientes primero", pendiente_first, f"orden={[i['is_checked'] for i in items]}")

    r = client.delete(f"/api/v1/lista-compra/{item2_id}", headers=hA)
    check("1.12 DELETE item individual (204)", r.status_code == 204, f"status={r.status_code}")

    r = client.get("/api/v1/lista-compra", headers=hA)
    check("1.13 Queda 1 item tras DELETE", len(r.json()) == 1)

    r = client.delete(f"/api/v1/lista-compra/{item2_id}", headers=hA)
    check("1.14 DELETE item ya borrado (404)", r.status_code == 404, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # Bloque 2: Borrado masivo de comprados (DELETE sin item_id)
    # ------------------------------------------------------------------
    print("\n[Bloque 2] Borrado masivo de comprados")
    hB = _register_login(client, "B")

    ids_b: list[str] = []
    for nombre in ["Pan", "Aceite", "Tomates"]:
        r = client.post("/api/v1/lista-compra", json={"nombre": nombre}, headers=hB)
        ids_b.append(r.json().get("id", ""))
    check("2.1 Crear 3 items OK", len(ids_b) == 3 and all(ids_b))

    for iid in ids_b[:2]:
        client.patch(f"/api/v1/lista-compra/{iid}", json={"is_checked": True}, headers=hB)

    r = client.delete("/api/v1/lista-compra", headers=hB)
    check("2.2 DELETE masivo checked (204)", r.status_code == 204, f"status={r.status_code}")

    r = client.get("/api/v1/lista-compra", headers=hB)
    remaining = r.json()
    check("2.3 Solo queda 1 item pendiente", len(remaining) == 1 and remaining[0]["is_checked"] is False,
          f"items={[(i['nombre'], i['is_checked']) for i in remaining]}")

    r = client.delete("/api/v1/lista-compra", headers=hB)
    check("2.4 DELETE masivo sin checked es no-op (204)", r.status_code == 204)

    r = client.get("/api/v1/lista-compra", headers=hB)
    check("2.5 Pendiente sigue ahi tras no-op", len(r.json()) == 1)

    # ------------------------------------------------------------------
    # Bloque 3: Aislamiento multi-tenant
    # ------------------------------------------------------------------
    print("\n[Bloque 3] Aislamiento multi-tenant")
    hC = _register_login(client, "C")
    r = client.post("/api/v1/lista-compra", json={"nombre": "Item secreto de C"}, headers=hC)
    item_c_id = r.json().get("id", "")

    r = client.get("/api/v1/lista-compra", headers=hB)
    ids_visibles = [i["id"] for i in r.json()]
    check("3.1 Hogar B no ve items de C", item_c_id not in ids_visibles)

    r = client.patch(f"/api/v1/lista-compra/{item_c_id}", json={"is_checked": True}, headers=hB)
    check("3.2 PATCH item ajeno (404)", r.status_code == 404, f"status={r.status_code}")

    r = client.delete(f"/api/v1/lista-compra/{item_c_id}", headers=hB)
    check("3.3 DELETE item ajeno (404)", r.status_code == 404, f"status={r.status_code}")

    r = client.get("/api/v1/lista-compra", headers=hC)
    check("3.4 Item de C intacto tras intentos de B", len(r.json()) == 1)

    # ------------------------------------------------------------------
    # Bloque 4: Validacion de schema
    # ------------------------------------------------------------------
    print("\n[Bloque 4] Validacion de schema")
    hD = _register_login(client, "D")

    r = client.post("/api/v1/lista-compra", json={"nombre": ""}, headers=hD)
    check("4.1 Nombre vacio (422)", r.status_code == 422, f"status={r.status_code}")

    r = client.post("/api/v1/lista-compra", json={"nombre": "X" * 201}, headers=hD)
    check("4.2 Nombre >200 chars (422)", r.status_code == 422, f"status={r.status_code}")

    r = client.post("/api/v1/lista-compra", json={"nombre": "Sal", "cantidad": 0}, headers=hD)
    check("4.3 Cantidad=0 (422, debe ser >0)", r.status_code == 422, f"status={r.status_code}")

    r = client.post("/api/v1/lista-compra", json={"nombre": "Sal", "cantidad": -1}, headers=hD)
    check("4.4 Cantidad negativa (422)", r.status_code == 422, f"status={r.status_code}")

    r = client.post("/api/v1/lista-compra", json={"nombre": "Sal", "campo_extra": "malo"}, headers=hD)
    check("4.5 Campo extra rechazado (422)", r.status_code == 422, f"status={r.status_code}")

    r = client.post("/api/v1/lista-compra", json={"nombre": "  Sal  "}, headers=hD)
    check("4.6 Nombre se normaliza (strip)", r.status_code == 201 and r.json().get("nombre") == "Sal")

    r = client.post("/api/v1/lista-compra", json={"nombre": "Queso", "unidad": "g" * 51}, headers=hD)
    check("4.7 Unidad >50 chars (422)", r.status_code == 422, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # Bloque 5: Sin autenticacion
    # ------------------------------------------------------------------
    print("\n[Bloque 5] Sin autenticacion")
    r = client.get("/api/v1/lista-compra")
    check("5.1 GET sin token (401)", r.status_code == 401)

    r = client.post("/api/v1/lista-compra", json={"nombre": "Intruso"})
    check("5.2 POST sin token (401)", r.status_code == 401)

    r = client.patch(f"/api/v1/lista-compra/{item_c_id}", json={"is_checked": True})
    check("5.3 PATCH sin token (401)", r.status_code == 401)

    r = client.delete(f"/api/v1/lista-compra/{item_c_id}")
    check("5.4 DELETE item sin token (401)", r.status_code == 401)

    r = client.delete("/api/v1/lista-compra")
    check("5.5 DELETE masivo sin token (401)", r.status_code == 401)

# Limpieza (best-effort)
import pathlib
try:
    pathlib.Path(_DB).unlink(missing_ok=True)
except PermissionError:
    pass

# Resumen
total = 27
passed = total - len(fallos)
print(f"\n{'='*50}")
print(f"Resultado: {passed}/{total} checks pasados")
if fallos:
    for f in fallos:
        print(f"  - FALLO: {f}")
    sys.exit(1)
else:
    print("Todos los checks OK!")
