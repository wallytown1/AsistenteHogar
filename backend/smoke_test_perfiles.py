"""Smoke test -- Fase 3: Perfiles individuales de miembros del hogar.
Verifica CRUD completo, limite de 10 perfiles, aislamiento multi-tenant y validacion.

Ejecutar: python smoke_test_perfiles.py
"""
import os
import sys
import uuid

_DB = f"./smoke_perfiles_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-perfiles-secret-key-fase3")
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
        "email": f"perfiles_{suffix}@test.com",
        "password": "SecurePass123",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": f"perfiles_{suffix}@test.com",
        "password": "SecurePass123",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


with TestClient(app) as client:

    # Bloque 1: CRUD basico
    print("\n[Bloque 1] CRUD basico")
    hA = _register_login(client, "A")

    r = client.get("/api/v1/perfiles", headers=hA)
    check("1.1 Lista vacia", r.status_code == 200 and r.json() == [], f"status={r.status_code}")

    payload = {"nombre": "Mama", "preferencias_dieta": ["vegetariana"], "excluir_ingredientes": ["cilantro"]}
    r = client.post("/api/v1/perfiles", json=payload, headers=hA)
    check("1.2 POST crea perfil (201)", r.status_code == 201, f"status={r.status_code}, body={r.text[:200]}")
    pid = r.json().get("id", "")
    check("1.3 Nombre correcto", r.json().get("nombre") == "Mama")
    check("1.4 preferencias_dieta", r.json().get("preferencias_dieta") == ["vegetariana"])
    check("1.5 excluir_ingredientes", r.json().get("excluir_ingredientes") == ["cilantro"])

    r = client.get(f"/api/v1/perfiles/{pid}", headers=hA)
    check("1.6 GET by id (200)", r.status_code == 200 and r.json()["id"] == pid)

    r = client.patch(f"/api/v1/perfiles/{pid}", json={"nombre": "Mama v2"}, headers=hA)
    check("1.7 PATCH nombre (200)", r.status_code == 200 and r.json()["nombre"] == "Mama v2")

    r = client.patch(f"/api/v1/perfiles/{pid}", json={"excluir_ingredientes": ["cilantro", "picante"]}, headers=hA)
    check("1.8 PATCH excluir_ingredientes", r.status_code == 200 and len(r.json()["excluir_ingredientes"]) == 2)

    r = client.get("/api/v1/perfiles", headers=hA)
    check("1.9 Lista con 1 elemento", r.status_code == 200 and len(r.json()) == 1)

    r = client.delete(f"/api/v1/perfiles/{pid}", headers=hA)
    check("1.10 DELETE (204)", r.status_code == 204, f"status={r.status_code}")

    r = client.get("/api/v1/perfiles", headers=hA)
    check("1.11 Lista vacia tras DELETE", r.json() == [])

    r = client.get(f"/api/v1/perfiles/{pid}", headers=hA)
    check("1.12 GET by id 404 tras DELETE", r.status_code == 404)

    # Bloque 2: Limite de 10 perfiles
    print("\n[Bloque 2] Limite 10 perfiles")
    hB = _register_login(client, "B")
    ids = []
    for i in range(10):
        r = client.post("/api/v1/perfiles", json={
            "nombre": f"Miembro {i+1}",
            "preferencias_dieta": [],
            "excluir_ingredientes": [],
        }, headers=hB)
        ids.append(r.json().get("id"))
    check("2.1 Crear 10 perfiles OK", len(ids) == 10 and all(ids))

    r = client.post("/api/v1/perfiles", json={
        "nombre": "El undecimo",
        "preferencias_dieta": [],
        "excluir_ingredientes": [],
    }, headers=hB)
    check("2.2 Undecimo perfil rechazado (400/422)", r.status_code in (400, 422), f"status={r.status_code}")

    # Bloque 3: Aislamiento multi-tenant
    print("\n[Bloque 3] Aislamiento multi-tenant")
    hC = _register_login(client, "C")
    r = client.post("/api/v1/perfiles", json={
        "nombre": "Intruso",
        "preferencias_dieta": [],
        "excluir_ingredientes": [],
    }, headers=hC)
    id_c = r.json().get("id", "")

    r = client.get(f"/api/v1/perfiles/{id_c}", headers=hB)
    check("3.1 GET perfil ajeno (404)", r.status_code == 404)
    r = client.patch(f"/api/v1/perfiles/{id_c}", json={"nombre": "Hackeado"}, headers=hB)
    check("3.2 PATCH perfil ajeno (404)", r.status_code == 404)
    r = client.delete(f"/api/v1/perfiles/{id_c}", headers=hB)
    check("3.3 DELETE perfil ajeno (404)", r.status_code == 404)

    # Bloque 4: Validacion de esquema
    print("\n[Bloque 4] Validacion de esquema")
    hD = _register_login(client, "D")

    r = client.post("/api/v1/perfiles", json={"nombre": "", "preferencias_dieta": [], "excluir_ingredientes": []}, headers=hD)
    check("4.1 Nombre vacio (422)", r.status_code == 422)

    r = client.post("/api/v1/perfiles", json={"nombre": "X", "preferencias_dieta": ["a" * 101], "excluir_ingredientes": []}, headers=hD)
    check("4.2 Preferencia >100 chars (422)", r.status_code == 422)

    r = client.post("/api/v1/perfiles", json={"nombre": "Y", "campo_extra": "malo"}, headers=hD)
    check("4.3 Campo extra rechazado (422)", r.status_code == 422)

    # Bloque 5: Sin autenticacion
    print("\n[Bloque 5] Sin autenticacion")
    r = client.get("/api/v1/perfiles")
    check("5.1 GET sin token (401)", r.status_code == 401)
    r = client.post("/api/v1/perfiles", json={"nombre": "X", "preferencias_dieta": [], "excluir_ingredientes": []})
    check("5.2 POST sin token (401)", r.status_code == 401)

# Limpieza (best-effort: en Windows SQLite puede seguir bloqueado)
import pathlib
try:
    pathlib.Path(_DB).unlink(missing_ok=True)
except PermissionError:
    pass

# Resumen
total = 20
passed = total - len(fallos)
print(f"\n{'='*50}")
print(f"Resultado: {passed}/{total} checks pasados")
if fallos:
    for f in fallos:
        print(f"  - FALLO: {f}")
    sys.exit(1)
else:
    print("Todos los checks OK!")
