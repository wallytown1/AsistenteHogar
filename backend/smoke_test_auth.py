"""Prueba de humo de la Fase 1: autenticación JWT y aislamiento multi-tenant.
Usa una base de datos SQLite temporal independiente de la de desarrollo."""
import os
import sys
import uuid

TEST_DB = "smoke_test_auth.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///./{TEST_DB}"

if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

# Aplicar migraciones sobre la BD temporal antes de importar la app
from alembic.config import Config
from alembic import command
alembic_cfg = Config("alembic.ini")
command.upgrade(alembic_cfg, "head")

from fastapi.testclient import TestClient
from app.main import app

fallos = []

def check(nombre, condicion, detalle=""):
    estado = "OK " if condicion else "FALLO"
    print(f"[{estado}] {nombre} {detalle}")
    if not condicion:
        fallos.append(nombre)

with TestClient(app) as client:
    # 1. Registro de un hogar nuevo
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": "Familia Test",
        "nombre": "Ana",
        "email": "ana@test.com",
        "password": "contrasena_segura_123"
    })
    check("Registro devuelve 201", r.status_code == 201, f"(status={r.status_code})")
    body = r.json()
    token = body.get("access_token", "")
    check("Registro devuelve token y hogar", bool(token) and "hogar" in body)

    # 2. Email duplicado rechazado
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": "Otro Hogar",
        "nombre": "Ana2",
        "email": "ana@test.com",
        "password": "otra_contrasena_123"
    })
    check("Email duplicado devuelve 409", r.status_code == 409, f"(status={r.status_code})")

    # 3. Login correcto
    r = client.post("/api/v1/auth/login", json={
        "email": "ana@test.com",
        "password": "contrasena_segura_123"
    })
    check("Login correcto devuelve 200", r.status_code == 200, f"(status={r.status_code})")

    # 4. Login con contraseña errónea
    r = client.post("/api/v1/auth/login", json={
        "email": "ana@test.com",
        "password": "contrasena_incorrecta"
    })
    check("Login incorrecto devuelve 401", r.status_code == 401, f"(status={r.status_code})")

    # 5. Endpoint protegido con token válido
    auth_headers = {"Authorization": f"Bearer {token}"}
    r = client.get("/api/v1/pantry", headers=auth_headers)
    check("GET /pantry con token devuelve 200", r.status_code == 200, f"(status={r.status_code})")

    # 6. Endpoint protegido sin token
    r = client.get("/api/v1/pantry")
    check("GET /pantry sin token devuelve 401", r.status_code == 401, f"(status={r.status_code})")

    # 7. La antigua cabecera X-Hogar-ID ya no da acceso
    r = client.get("/api/v1/pantry", headers={"X-Hogar-ID": str(uuid.uuid4())})
    check("X-Hogar-ID sin token devuelve 401", r.status_code == 401, f"(status={r.status_code})")

    # 8. Token manipulado rechazado
    r = client.get("/api/v1/pantry", headers={"Authorization": f"Bearer {token[:-4]}XXXX"})
    check("Token manipulado devuelve 401", r.status_code == 401, f"(status={r.status_code})")

    # 9. /auth/me devuelve el perfil
    r = client.get("/api/v1/auth/me", headers=auth_headers)
    check("GET /auth/me devuelve perfil", r.status_code == 200 and r.json().get("email") == "ana@test.com")

    # 10. Aislamiento: segundo hogar no ve datos del primero
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": "Familia Dos",
        "nombre": "Berta",
        "email": "berta@test.com",
        "password": "contrasena_segura_456"
    })
    token2 = r.json().get("access_token", "")
    client.post("/api/v1/pantry", headers=auth_headers, json={
        "nombre": "Leche", "cantidad": 1.0, "unidad": "litros", "categoria": "Lácteos"
    })
    r = client.get("/api/v1/pantry", headers={"Authorization": f"Bearer {token2}"})
    items_hogar2 = r.json().get("items", [])
    check("Aislamiento multi-tenant: hogar 2 no ve items del hogar 1", len(items_hogar2) == 0, f"(items={len(items_hogar2)})")

    # 11. Rate limiting: intentos masivos de login devuelven 429
    statuses = []
    for _ in range(12):
        r = client.post("/api/v1/auth/login", json={
            "email": "ana@test.com",
            "password": "contrasena_incorrecta"
        })
        statuses.append(r.status_code)
    check("Rate limiting en login devuelve 429", 429 in statuses, f"(últimos status={statuses[-3:]})")

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} fallos -> {fallos}")
    sys.exit(1)
print("RESULTADO: todas las pruebas pasaron")
