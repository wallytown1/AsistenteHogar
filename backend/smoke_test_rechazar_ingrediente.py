"""Smoke test -- Fase 4b: POST /pantry/recetas/rechazar-ingrediente.

Sin GEMINI_API_KEY, identify_rejected_ingredients devuelve [] inmediatamente
(fallback documentado en llm.py:1073). El endpoint responde 200 con
ingredientes_anadidos=[] y generado_por_ia=False.

Ejecutar: python smoke_test_rechazar_ingrediente.py
"""
import os
import sys
import uuid

_DB = f"./smoke_rechazar_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-rechazar-ingrediente-secret-key")
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
    client.post(
        "/api/v1/auth/registro",
        json={
            "nombre_hogar": f"Hogar {suffix}",
            "nombre": f"Usuario {suffix}",
            "email": f"rechazar_{suffix}@test.com",
            "password": "SecurePass123",
        },
    )
    r = client.post(
        "/api/v1/auth/login",
        json={"email": f"rechazar_{suffix}@test.com", "password": "SecurePass123"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _crear_perfil(client: TestClient, headers: dict, nombre: str = "Miembro") -> str:
    r = client.post(
        "/api/v1/perfiles",
        json={"nombre": nombre, "preferencias_dieta": [], "excluir_ingredientes": []},
        headers=headers,
    )
    return r.json().get("id", "")


with TestClient(app) as client:

    # ------------------------------------------------------------------ #
    # Bloque 1: Happy path (fallback sin GEMINI_API_KEY)
    # ------------------------------------------------------------------ #
    print("\n[Bloque 1] Happy path — fallback sin GEMINI_API_KEY")
    hA = _register_login(client, "A")
    pid_a = _crear_perfil(client, hA, "Papa")

    payload = {
        "nombre_receta": "Pasta con salsa de tomate",
        "ingredientes_receta": ["pasta", "tomate", "ajo", "aceite de oliva"],
        "perfil_id": pid_a,
    }
    r = client.post("/api/v1/pantry/recetas/rechazar-ingrediente", json=payload, headers=hA)
    check("1.1 POST devuelve 200", r.status_code == 200, f"status={r.status_code}, body={r.text[:200]}")

    body = r.json()
    check("1.2 perfil_id correcto", body.get("perfil_id") == pid_a)
    check("1.3 nombre_perfil correcto", body.get("nombre_perfil") == "Papa")
    check("1.4 ingredientes_anadidos vacío (sin GEMINI)", body.get("ingredientes_anadidos") == [])
    check("1.5 generado_por_ia False (sin GEMINI)", body.get("generado_por_ia") is False)
    check("1.6 excluir_ingredientes_actualizado es lista", isinstance(body.get("excluir_ingredientes_actualizado"), list))
    check("1.7 mensaje presente cuando no hay ingredientes", body.get("mensaje") is not None)

    # ------------------------------------------------------------------ #
    # Bloque 2: Aislamiento multi-tenant
    # ------------------------------------------------------------------ #
    print("\n[Bloque 2] Aislamiento multi-tenant")
    hB = _register_login(client, "B")
    pid_b = _crear_perfil(client, hB, "Mama B")

    # Hogar B intenta usar perfil_id de Hogar A
    r = client.post(
        "/api/v1/pantry/recetas/rechazar-ingrediente",
        json={**payload, "perfil_id": pid_a},
        headers=hB,
    )
    check("2.1 perfil_id ajeno devuelve 404", r.status_code == 404, f"status={r.status_code}")

    # Hogar A intenta usar perfil_id de Hogar B
    r = client.post(
        "/api/v1/pantry/recetas/rechazar-ingrediente",
        json={**payload, "perfil_id": pid_b},
        headers=hA,
    )
    check("2.2 perfil_id ajeno inverso devuelve 404", r.status_code == 404, f"status={r.status_code}")

    # UUID inexistente
    r = client.post(
        "/api/v1/pantry/recetas/rechazar-ingrediente",
        json={**payload, "perfil_id": str(uuid.uuid4())},
        headers=hA,
    )
    check("2.3 perfil_id inexistente devuelve 404", r.status_code == 404, f"status={r.status_code}")

    # ------------------------------------------------------------------ #
    # Bloque 3: Validación de esquema (422)
    # ------------------------------------------------------------------ #
    print("\n[Bloque 3] Validación de esquema")

    r = client.post(
        "/api/v1/pantry/recetas/rechazar-ingrediente",
        json={"nombre_receta": "", "ingredientes_receta": ["pasta"], "perfil_id": pid_a},
        headers=hA,
    )
    check("3.1 nombre_receta vacio -> 422", r.status_code == 422, f"status={r.status_code}")

    r = client.post(
        "/api/v1/pantry/recetas/rechazar-ingrediente",
        json={"nombre_receta": "Gazpacho", "ingredientes_receta": [], "perfil_id": pid_a},
        headers=hA,
    )
    check("3.2 ingredientes_receta vacio -> 422", r.status_code == 422, f"status={r.status_code}")

    r = client.post(
        "/api/v1/pantry/recetas/rechazar-ingrediente",
        json={"nombre_receta": "Gazpacho", "ingredientes_receta": ["  ", "  "], "perfil_id": pid_a},
        headers=hA,
    )
    check("3.3 ingredientes solo espacios -> 422", r.status_code == 422, f"status={r.status_code}")

    r = client.post(
        "/api/v1/pantry/recetas/rechazar-ingrediente",
        json={**payload, "perfil_id": pid_a, "campo_extra": "malo"},
        headers=hA,
    )
    check("3.4 campo extra rechazado -> 422", r.status_code == 422, f"status={r.status_code}")

    r = client.post(
        "/api/v1/pantry/recetas/rechazar-ingrediente",
        json={"nombre_receta": "Algo", "ingredientes_receta": ["pasta"]},
        headers=hA,
    )
    check("3.5 sin perfil_id -> 422", r.status_code == 422, f"status={r.status_code}")

    # ------------------------------------------------------------------ #
    # Bloque 4: Sin autenticación
    # ------------------------------------------------------------------ #
    print("\n[Bloque 4] Sin autenticación")
    r = client.post("/api/v1/pantry/recetas/rechazar-ingrediente", json=payload)
    check("4.1 sin token -> 401", r.status_code == 401, f"status={r.status_code}")

# Limpieza
import pathlib

try:
    pathlib.Path(_DB).unlink(missing_ok=True)
except PermissionError:
    pass

# Resumen
total = 16
passed = total - len(fallos)
print(f"\n{'='*50}")
print(f"Resultado: {passed}/{total} checks pasados")
if fallos:
    for f in fallos:
        print(f"  - FALLO: {f}")
    sys.exit(1)
else:
    print("Todos los checks OK!")
