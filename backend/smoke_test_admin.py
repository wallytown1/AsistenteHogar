"""smoke_test_admin.py — Fase 2: panel de administración

Verifica el ciclo completo de admin: bootstrap, login, CRUD de prompts con
la guardia de filosofía mediterránea, CRUD de recetario maestro y aislamiento
entre tokens familiares y tokens de admin.

Usa una DB SQLite temporal aislada. No requiere GEMINI_API_KEY.
"""
import os
import sys

TEST_DB = "smoke_test_admin.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///./{TEST_DB}"
os.environ["GEMINI_API_KEY"] = ""
os.environ["REVENUECAT_SECRET_KEY"] = ""  # gate desactivado en tests
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-for-smoke-admin")
os.environ["ADMIN_JWT_SECRET_KEY"] = "test-admin-jwt-secret-for-smoke"
os.environ["ADMIN_BOOTSTRAP_TOKEN"] = "test-bootstrap-token-smoke"

if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

from alembic.config import Config
from alembic import command

alembic_cfg = Config("alembic.ini")
command.upgrade(alembic_cfg, "head")

from fastapi.testclient import TestClient
from app.main import app

fallos: list[str] = []


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    estado = "OK  " if condicion else "FALLO"
    print(f"[{estado}] {nombre} {detalle}")
    if not condicion:
        fallos.append(nombre)


BOOTSTRAP_TOKEN = "test-bootstrap-token-smoke"

with TestClient(app) as client:

    # ── Registro de un usuario familiar (para pruebas de aislamiento) ────────
    r = client.post(
        "/api/v1/auth/registro",
        json={
            "nombre_hogar": "Hogar Test Admin",
            "nombre": "Usuario Test",
            "email": "test_admin_smoke@ejemplo.com",
            "password": "password123",
        },
    )
    check("Registro usuario familiar", r.status_code == 201, f"(status={r.status_code})")
    familia_token = r.json().get("access_token", "")

    # ── 1. Bootstrap con token incorrecto ->401 ──────────────────────────────
    r = client.post(
        "/api/v1/admin/auth/bootstrap",
        json={
            "email": "admin@ejemplo.com",
            "password": "admin1234",
            "nombre": "Admin Test",
            "bootstrap_token": "token-incorrecto",
        },
    )
    check("1. Bootstrap token incorrecto ->401", r.status_code == 401, f"(status={r.status_code})")

    # ── 2. Bootstrap primer admin ->200 ──────────────────────────────────────
    r = client.post(
        "/api/v1/admin/auth/bootstrap",
        json={
            "email": "admin@ejemplo.com",
            "password": "admin1234",
            "nombre": "Admin Test",
            "bootstrap_token": BOOTSTRAP_TOKEN,
        },
    )
    check("2. Bootstrap primer admin ->200", r.status_code == 200, f"(status={r.status_code})")
    admin_token = r.json().get("access_token", "")
    admin_info = r.json().get("admin", {})
    check("2b. Bootstrap devuelve info admin", "email" in admin_info and "nombre" in admin_info)

    # ── 3. Segundo bootstrap ->409 ───────────────────────────────────────────
    r = client.post(
        "/api/v1/admin/auth/bootstrap",
        json={
            "email": "admin2@ejemplo.com",
            "password": "admin1234",
            "nombre": "Admin 2",
            "bootstrap_token": BOOTSTRAP_TOKEN,
        },
    )
    check("3. Segundo bootstrap ->409", r.status_code == 409, f"(status={r.status_code})")

    # ── 4. Login admin ->200 ─────────────────────────────────────────────────
    r = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "admin@ejemplo.com", "password": "admin1234"},
    )
    check("4. Login admin ->200", r.status_code == 200, f"(status={r.status_code})")
    admin_token = r.json().get("access_token", admin_token)

    # ── 5. Login admin contraseña incorrecta ->401 ───────────────────────────
    r = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "admin@ejemplo.com", "password": "incorrecta"},
    )
    check("5. Login admin contraseña incorrecta ->401", r.status_code == 401, f"(status={r.status_code})")

    admin_h = {"Authorization": f"Bearer {admin_token}"}
    familia_h = {"Authorization": f"Bearer {familia_token}"}

    # ── 6. GET /admin/prompts sin auth ->401 ─────────────────────────────────
    r = client.get("/api/v1/admin/prompts")
    check("6. GET prompts sin auth ->401", r.status_code in (401, 403), f"(status={r.status_code})")

    # ── 7. Token familiar en /admin/* ->401 ─────────────────────────────────
    r = client.get("/api/v1/admin/prompts", headers=familia_h)
    check("7. Token familiar en /admin/prompts ->401", r.status_code == 401, f"(status={r.status_code})")

    # ── 8. GET /admin/prompts con admin ->lista vacía ────────────────────────
    r = client.get("/api/v1/admin/prompts", headers=admin_h)
    check("8. GET prompts vacío ->200", r.status_code == 200, f"(status={r.status_code})")
    check("8b. Prompts devuelve lista", isinstance(r.json(), list))

    # ── 9. PATCH prompt 'recetas' ->versión 1 ────────────────────────────────
    r = client.patch(
        "/api/v1/admin/prompts/recetas",
        json={"system_instruction": "Eres un chef experto en cocina española tradicional."},
        headers=admin_h,
    )
    check("9. PATCH prompt 'recetas' ->200", r.status_code == 200, f"(status={r.status_code})")
    data = r.json()
    check("9b. Versión inicial = 1", data.get("version") == 1, str(data.get("version")))
    check("9c. Clave correcta", data.get("clave") == "recetas")

    # ── 10. GET prompt 'recetas' ->coincide ──────────────────────────────────
    r = client.get("/api/v1/admin/prompts/recetas", headers=admin_h)
    check("10. GET prompt 'recetas' ->200", r.status_code == 200, f"(status={r.status_code})")
    check("10b. Contenido guardado", "chef experto" in r.json().get("system_instruction", ""))

    # ── 11. PATCH de nuevo ->versión 2 ───────────────────────────────────────
    r = client.patch(
        "/api/v1/admin/prompts/recetas",
        json={"system_instruction": "Chef actualizado de cocina mediterránea española."},
        headers=admin_h,
    )
    check("11. Segundo PATCH ->versión 2", r.json().get("version") == 2, str(r.json().get("version")))

    # ── 12. GET prompt inexistente ->404 ─────────────────────────────────────
    r = client.get("/api/v1/admin/prompts/noexiste", headers=admin_h)
    check("12. GET prompt inexistente ->404", r.status_code == 404, f"(status={r.status_code})")

    # ── 13. _FILOSOFIA_MEDITERRANEA presente en system_instruction resultante ─
    from app.services.llm import _FILOSOFIA_MEDITERRANEA

    r = client.get("/api/v1/admin/prompts/recetas", headers=admin_h)
    raw_instruction = r.json().get("system_instruction", "")
    # El guard se aplica cuando PromptConfigService construye el prompt;
    # lo verificamos llamando directamente al servicio.
    import asyncio
    from app.repositories.prompt_template import PromptTemplateRepository
    from app.services.prompt_config import PromptConfigService
    from app.database import async_session_maker

    async def _get_instruction() -> str:
        async with async_session_maker() as session:
            repo = PromptTemplateRepository(session)
            svc = PromptConfigService(repo)
            return await svc.get_system_instruction("recetas", "fallback")

    built_instruction = asyncio.run(_get_instruction())
    check(
        "13. _FILOSOFIA_MEDITERRANEA siempre presente",
        _FILOSOFIA_MEDITERRANEA[:40] in built_instruction,
        "philosophy not found",
    )

    # ── 14. POST receta ->201 ────────────────────────────────────────────────
    receta_payload = {
        "nombre": "Tortilla de patatas clásica",
        "ingredientes": ["patatas", "huevos", "aceite de oliva", "sal"],
        "pasos": [
            "Pelar y laminar las patatas.",
            "Freír en aceite hasta que estén tiernas.",
            "Mezclar con huevos batidos.",
            "Cuajar por ambos lados en sartén.",
        ],
        "categoria": "Huevos",
        "temporada": None,
        "aprovechamiento": False,
    }
    r = client.post("/api/v1/admin/recetario", json=receta_payload, headers=admin_h)
    check("14. POST receta ->201", r.status_code == 201, f"(status={r.status_code})")
    receta_id = r.json().get("id", "")
    check("14b. Receta tiene ID", bool(receta_id))

    # ── 15. GET receta ->coincide ─────────────────────────────────────────────
    r = client.get(f"/api/v1/admin/recetario/{receta_id}", headers=admin_h)
    check("15. GET receta ->200", r.status_code == 200, f"(status={r.status_code})")
    check("15b. Nombre correcto", r.json().get("nombre") == "Tortilla de patatas clásica")

    # ── 16. GET recetario activa_only ->aparece ───────────────────────────────
    r = client.get("/api/v1/admin/recetario?activa_only=true", headers=admin_h)
    check("16. GET recetario activa_only ->200", r.status_code == 200, f"(status={r.status_code})")
    nombres = [rec["nombre"] for rec in r.json()]
    check("16b. Receta activa en lista", "Tortilla de patatas clásica" in nombres)

    # ── 17. PATCH receta activa=False ─────────────────────────────────────────
    r = client.patch(
        f"/api/v1/admin/recetario/{receta_id}",
        json={"activa": False},
        headers=admin_h,
    )
    check("17. PATCH activa=False ->200", r.status_code == 200, f"(status={r.status_code})")
    check("17b. activa es False", r.json().get("activa") is False)

    # ── 18. activa_only ya no la incluye ─────────────────────────────────────
    r = client.get("/api/v1/admin/recetario?activa_only=true", headers=admin_h)
    nombres_activas = [rec["nombre"] for rec in r.json()]
    check(
        "18. Receta inactiva no aparece en activa_only",
        "Tortilla de patatas clásica" not in nombres_activas,
    )

    # ── 19. DELETE receta ->200 ───────────────────────────────────────────────
    r = client.delete(f"/api/v1/admin/recetario/{receta_id}", headers=admin_h)
    check("19. DELETE receta ->200", r.status_code == 200, f"(status={r.status_code})")

    # ── 20. GET receta borrada ->404 ──────────────────────────────────────────
    r = client.get(f"/api/v1/admin/recetario/{receta_id}", headers=admin_h)
    check("20. GET receta borrada ->404", r.status_code == 404, f"(status={r.status_code})")

    # ── 21. Token admin en /pantry ->401 ──────────────────────────────────────
    r = client.get("/api/v1/pantry", headers=admin_h)
    check("21. Token admin en /pantry ->401", r.status_code == 401, f"(status={r.status_code})")


# ── Resultado ─────────────────────────────────────────────────────────────────
total = 26  # incluyendo sub-checks (b/c labels)
passed = total - len(fallos)
print(f"\n{'='*50}")
print(f"smoke_test_admin: {passed}/{total} checks pasaron")

if fallos:
    print("\nFallos:")
    for f in fallos:
        print(f"  - {f}")
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    sys.exit(1)

try:
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
except OSError:
    pass
print("Todos los checks de administración pasaron correctamente.")
