"""Prueba de humo de robustez de endpoints: contrato de errores HTTP.

Verifica que las peticiones mal formadas devuelvan códigos 4xx claros en lugar
de 500, cubriendo los bordes que no toca el camino feliz:

- PATCH sin cuerpo -> 400 (regresión: antes provocaba un 500 por NoneType en
  pantry; ver el fix en routers/pantry.py).
- ID de ruta con formato no-UUID -> 422.
- ID válido pero inexistente -> 404.
- Tipos inválidos en el cuerpo -> 422.
- Falta de token en endpoints protegidos -> 401.
"""
import os
import sys

TEST_DB = "smoke_test_validation.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///./{TEST_DB}"
os.environ["GEMINI_API_KEY"] = ""

if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

from alembic.config import Config
from alembic import command
command.upgrade(Config("alembic.ini"), "head")

from fastapi.testclient import TestClient
from app.main import app

fallos = []
UUID_INEXISTENTE = "00000000-0000-0000-0000-000000000000"


def check(nombre, condicion, detalle=""):
    estado = "OK " if condicion else "FALLO"
    print(f"[{estado}] {nombre} {detalle}")
    if not condicion:
        fallos.append(nombre)


with TestClient(app) as client:
    tok = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": "Hogar", "nombre": "Ana", "email": "ana@val.com",
        "password": "contrasena_segura_123"
    }).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}

    # Recurso real para los PATCH sin cuerpo
    item_id = client.post("/api/v1/pantry", headers=h, json={
        "nombre": "Leche", "cantidad": 1.0, "unidad": "litros", "categoria": "Lácteos"
    }).json()["id"]

    # ============ PATCH sin cuerpo -> 400 (regresión de bug 500) ============
    print("\n--- PATCH sin cuerpo (regresión) ---")
    r = client.patch(f"/api/v1/pantry/{item_id}", headers=h)
    check("PATCH /pantry sin cuerpo devuelve 400 (no 500)", r.status_code == 400, f"(status={r.status_code})")

    # Un PATCH con cuerpo vacío {} es válido (no-op) y devuelve 200
    r = client.patch(f"/api/v1/pantry/{item_id}", headers=h, json={})
    check("PATCH /pantry con cuerpo vacío {} es no-op (200)", r.status_code == 200, f"(status={r.status_code})")

    # ============ ID de ruta no-UUID -> 422 ============
    print("\n--- ID de ruta malformado ---")
    r = client.patch("/api/v1/pantry/no-es-uuid", headers=h, json={"cantidad": 2.0})
    check("PATCH /pantry con ID no-UUID devuelve 422", r.status_code == 422, f"(status={r.status_code})")

    r = client.delete("/api/v1/pantry/no-es-uuid", headers=h)
    check("DELETE /pantry con ID no-UUID devuelve 422", r.status_code == 422, f"(status={r.status_code})")

    # ============ ID válido pero inexistente -> 404 ============
    print("\n--- ID válido inexistente ---")
    r = client.delete(f"/api/v1/pantry/{UUID_INEXISTENTE}", headers=h)
    check("DELETE /pantry inexistente devuelve 404", r.status_code == 404, f"(status={r.status_code})")

    r = client.patch(f"/api/v1/pantry/{UUID_INEXISTENTE}", headers=h, json={"cantidad": 3.0})
    check("PATCH /pantry inexistente devuelve 404", r.status_code == 404, f"(status={r.status_code})")

    # ============ Tipos inválidos en el cuerpo -> 422 ============
    print("\n--- Tipos inválidos en el cuerpo ---")
    r = client.post("/api/v1/pantry", headers=h, json={
        "nombre": "X", "cantidad": "no-numero", "unidad": "u", "categoria": "Despensa"
    })
    check("POST /pantry con cantidad no numérica devuelve 422", r.status_code == 422, f"(status={r.status_code})")

    r = client.post("/api/v1/pantry", headers=h, json={
        "nombre": "X", "cantidad": 1.0, "unidad": "u", "categoria": "Despensa",
        "fecha_caducidad": "2020-01-01"
    })
    check("POST /pantry con caducidad en el pasado devuelve 422", r.status_code == 422, f"(status={r.status_code})")

    # ============ Endpoints protegidos sin token -> 401 ============
    print("\n--- Autenticación requerida ---")
    for ruta in ["/api/v1/pantry", "/api/v1/dashboard"]:
        r = client.get(ruta)
        check(f"GET {ruta} sin token devuelve 401", r.status_code == 401, f"(status={r.status_code})")

    # ============ Límite de contraseña de bcrypt (72 bytes) -> 422 (no 500) ============
    print("\n--- Límite de contraseña (bcrypt) ---")
    # 72 caracteres acentuados = 144 bytes en UTF-8: bcrypt los rechaza.
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": "Hogar", "nombre": "Multi", "email": "multibyte@val.com",
        "password": "á" * 72
    })
    check("Registro con contraseña > 72 bytes devuelve 422 (no 500)", r.status_code == 422, f"(status={r.status_code})")

    # Caso límite válido: 72 bytes ASCII exactos deben registrar correctamente
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": "Hogar", "nombre": "Limite", "email": "limite72@val.com",
        "password": "a" * 72
    })
    check("Registro con contraseña de 72 bytes ASCII exactos devuelve 201", r.status_code == 201, f"(status={r.status_code})")

    # ============ Integridad de texto: las comillas no se corrompen ============
    print("\n--- Integridad de texto (sanitización) ---")
    # sanitize_text antes escapaba comillas/backslash, corrompiendo el texto visible.
    nombre_con_comillas = 'Comprar "leche" y pan'
    r = client.post("/api/v1/pantry", headers=h, json={
        "nombre": nombre_con_comillas, "cantidad": 1.0, "unidad": "u", "categoria": "Despensa"
    })
    check("Alimento con comillas se guarda sin corromper", r.json().get("nombre") == nombre_con_comillas,
          f"(guardado={r.json().get('nombre')!r})")

    # ============ Rate limiting de IA: /pantry/interpretar (20 / 5 min) ============
    # Sin GEMINI_API_KEY el endpoint responde 200 (fallback) al instante, así que
    # podemos verificar que el limitador corta a partir de la 21ª llamada.
    print("\n--- Rate limit de IA (/pantry/interpretar) ---")
    body_ia = {"texto": "compré 6 huevos y leche", "fecha_referencia": "2026-06-19"}
    codigos = [client.post("/api/v1/pantry/interpretar", headers=h, json=body_ia).status_code for _ in range(20)]
    check("Las primeras 20 llamadas a /interpretar pasan (200)", all(c == 200 for c in codigos), f"(códigos={sorted(set(codigos))})")
    r = client.post("/api/v1/pantry/interpretar", headers=h, json=body_ia)
    check("La llamada 21 a /interpretar devuelve 429 (rate limit IA)", r.status_code == 429, f"(status={r.status_code})")

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} fallos -> {fallos}")
    sys.exit(1)
print("RESULTADO: todas las pruebas pasaron")
