"""Prueba de humo de los módulos de negocio: despensa, calendario y tareas.

Cubre, sobre una base SQLite temporal e independiente:
- CRUD básico de cada módulo (crear, leer, actualizar, borrado lógico).
- Validaciones Pydantic v2 (cantidad > 0, fechas, prioridad/estado, extra='forbid').
- Detección de conflictos de solapamiento en el calendario.
- Aislamiento multi-tenant: un hogar nunca ve ni manipula datos de otro
  (restricción inamovible nº 1 del proyecto).

Complementa a smoke_test_auth.py, que cubre la capa de autenticación.
"""
import os
import sys
from datetime import UTC, date, datetime, timedelta
from datetime import time as dtime

TEST_DB = "smoke_test_modules.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///./{TEST_DB}"
# Hermético: forzar el modo de contingencia del LLM (sin red ni llamadas reales a Gemini),
# independientemente de lo que haya en .env.
os.environ["GEMINI_API_KEY"] = ""

if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

# Aplicar migraciones sobre la BD temporal antes de importar la app
from alembic import command
from alembic.config import Config

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


def iso(dia: date, hora: int) -> str:
    """Construye un datetime ISO-8601 con offset UTC para un día y hora dados."""
    return datetime.combine(dia, dtime(hora, 0), tzinfo=UTC).isoformat()


# Fechas dinámicas para no depender de la fecha del sistema
hoy = date.today()
manana = hoy + timedelta(days=1)
futuro = hoy + timedelta(days=5)
ayer = hoy - timedelta(days=1)


def registrar(client, nombre_hogar, nombre, email):
    r = client.post(
        "/api/v1/auth/registro",
        json={
            "nombre_hogar": nombre_hogar,
            "nombre": nombre,
            "email": email,
            "password": "contrasena_segura_123",
        },
    )
    return r.json().get("access_token", "")


with TestClient(app) as client:
    # Dos hogares independientes para validar el aislamiento multi-tenant
    token1 = registrar(client, "Hogar Uno", "Ana", "ana@modules.com")
    token2 = registrar(client, "Hogar Dos", "Berta", "berta@modules.com")
    h1 = {"Authorization": f"Bearer {token1}"}
    h2 = {"Authorization": f"Bearer {token2}"}
    check("Registro de dos hogares devuelve tokens", bool(token1) and bool(token2))

    # ================== DESPENSA ==================
    print("\n--- Despensa ---")

    r = client.post(
        "/api/v1/pantry",
        headers=h1,
        json={
            "nombre": "Leche",
            "cantidad": 2.0,
            "unidad": "litros",
            "categoria": "Lácteos",
            "fecha_caducidad": futuro.isoformat(),
        },
    )
    check(
        "POST /pantry crea item (201)",
        r.status_code == 201,
        f"(status={r.status_code})",
    )
    item_id = r.json().get("id")

    r = client.get("/api/v1/pantry", headers=h1)
    items = r.json().get("items", [])
    check("GET /pantry lista el item creado", any(i["id"] == item_id for i in items))

    r = client.patch(f"/api/v1/pantry/{item_id}", headers=h1, json={"cantidad": 5.0})
    check(
        "PATCH /pantry actualiza cantidad (200)",
        r.status_code == 200 and r.json().get("cantidad") == 5.0,
    )

    r = client.post(
        "/api/v1/pantry",
        headers=h1,
        json={
            "nombre": "Pan",
            "cantidad": 0,
            "unidad": "unidades",
            "categoria": "Panadería",
        },
    )
    check(
        "POST /pantry rechaza cantidad <= 0 (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    r = client.post(
        "/api/v1/pantry",
        headers=h1,
        json={
            "nombre": "Yogur",
            "cantidad": 1.0,
            "unidad": "unidades",
            "categoria": "Lácteos",
            "fecha_caducidad": ayer.isoformat(),
        },
    )
    check(
        "POST /pantry rechaza fecha de caducidad pasada (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    r = client.post(
        "/api/v1/pantry",
        headers=h1,
        json={
            "nombre": "Arroz",
            "cantidad": 1.0,
            "unidad": "kg",
            "categoria": "Despensa",
            "campo_inventado": "x",
        },
    )
    check(
        "POST /pantry rechaza campos extra (extra=forbid, 422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # Aislamiento: el hogar 2 no ve el item del hogar 1
    r = client.get("/api/v1/pantry", headers=h2)
    items_h2 = r.json().get("items", [])
    check(
        "Aislamiento despensa: hogar 2 no ve items del hogar 1",
        len(items_h2) == 0,
        f"(items={len(items_h2)})",
    )

    # Cross-tenant: el hogar 2 no puede borrar el item del hogar 1
    r = client.delete(f"/api/v1/pantry/{item_id}", headers=h2)
    check(
        "Cross-tenant: DELETE item ajeno devuelve 404",
        r.status_code == 404,
        f"(status={r.status_code})",
    )

    # Borrado lógico propio
    r = client.delete(f"/api/v1/pantry/{item_id}", headers=h1)
    check(
        "DELETE /pantry propio devuelve 200",
        r.status_code == 200,
        f"(status={r.status_code})",
    )
    r = client.get("/api/v1/pantry", headers=h1)
    items = r.json().get("items", [])
    check(
        "Soft delete: item borrado ya no aparece",
        not any(i["id"] == item_id for i in items),
    )

    # ================== CALENDARIO ==================
    print("\n--- Calendario ---")

    r = client.post(
        "/api/v1/calendar",
        headers=h1,
        json={
            "titulo": "Reunión Escolar",
            "descripcion": "Trimestre",
            "fecha_inicio": iso(futuro, 10),
            "fecha_fin": iso(futuro, 12),
            "participantes": ["Papá", "Mamá"],
        },
    )
    check(
        "POST /calendar crea evento (201)",
        r.status_code == 201,
        f"(status={r.status_code})",
    )
    evento_id = r.json().get("id")

    r = client.get("/api/v1/calendar", headers=h1)
    eventos = r.json().get("eventos", [])
    check(
        "GET /calendar lista el evento creado",
        any(e["id"] == evento_id for e in eventos),
    )

    r = client.post(
        "/api/v1/calendar",
        headers=h1,
        json={
            "titulo": "Fecha inválida",
            "fecha_inicio": iso(futuro, 12),
            "fecha_fin": iso(futuro, 10),
        },
    )
    check(
        "POST /calendar rechaza fin <= inicio (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # Segundo evento solapado para forzar la detección de conflicto (11:00-13:00 solapa 11-12)
    client.post(
        "/api/v1/calendar",
        headers=h1,
        json={
            "titulo": "Cita médica",
            "fecha_inicio": iso(futuro, 11),
            "fecha_fin": iso(futuro, 13),
            "participantes": ["Juan"],
        },
    )
    r = client.get("/api/v1/calendar", headers=h1)
    conflictos = r.json().get("conflictos", [])
    check(
        "Detección de conflicto de solapamiento",
        len(conflictos) >= 1,
        f"(conflictos={len(conflictos)})",
    )

    # PATCH: actualización parcial del evento (título)
    r = client.patch(
        f"/api/v1/calendar/{evento_id}",
        headers=h1,
        json={"titulo": "Reunión Reprogramada"},
    )
    check(
        "PATCH /calendar actualiza el título (200)",
        r.status_code == 200 and r.json().get("titulo") == "Reunión Reprogramada",
        f"(status={r.status_code})",
    )

    # PATCH con fin <= inicio (ambas fechas) debe rechazarse
    r = client.patch(
        f"/api/v1/calendar/{evento_id}",
        headers=h1,
        json={"fecha_inicio": iso(futuro, 15), "fecha_fin": iso(futuro, 14)},
    )
    check(
        "PATCH /calendar rechaza fin <= inicio (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # B1: PATCH parcial — solo fecha_fin anterior al inicio persistido (evento actual 10-12)
    # debe validarse contra el valor en BD, no omitirse por ausencia de fecha_inicio.
    r = client.patch(
        f"/api/v1/calendar/{evento_id}", headers=h1, json={"fecha_fin": iso(futuro, 8)}
    )
    check(
        "PATCH /calendar parcial rechaza fecha_fin < inicio persistido (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # B1: PATCH parcial — solo fecha_inicio posterior al fin persistido debe rechazarse igual.
    r = client.patch(
        f"/api/v1/calendar/{evento_id}",
        headers=h1,
        json={"fecha_inicio": iso(futuro, 14)},
    )
    check(
        "PATCH /calendar parcial rechaza fecha_inicio > fin persistido (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # B1 (control): PATCH parcial válido — solo fecha_fin posterior al inicio persistido se acepta.
    r = client.patch(
        f"/api/v1/calendar/{evento_id}", headers=h1, json={"fecha_fin": iso(futuro, 13)}
    )
    check(
        "PATCH /calendar parcial acepta fecha_fin > inicio persistido (200)",
        r.status_code == 200,
        f"(status={r.status_code})",
    )

    # PATCH sin cuerpo debe devolver 400 (no 500)
    r = client.patch(f"/api/v1/calendar/{evento_id}", headers=h1)
    check(
        "PATCH /calendar sin cuerpo devuelve 400",
        r.status_code == 400,
        f"(status={r.status_code})",
    )

    # Aislamiento: el hogar 2 no ve los eventos del hogar 1
    r = client.get("/api/v1/calendar", headers=h2)
    eventos_h2 = r.json().get("eventos", [])
    check(
        "Aislamiento calendario: hogar 2 no ve eventos del hogar 1",
        len(eventos_h2) == 0,
        f"(eventos={len(eventos_h2)})",
    )

    # Cross-tenant: el hogar 2 no puede modificar ni borrar el evento del hogar 1
    r = client.patch(
        f"/api/v1/calendar/{evento_id}", headers=h2, json={"titulo": "Hackeado"}
    )
    check(
        "Cross-tenant: PATCH evento ajeno devuelve 404",
        r.status_code == 404,
        f"(status={r.status_code})",
    )

    r = client.delete(f"/api/v1/calendar/{evento_id}", headers=h2)
    check(
        "Cross-tenant: DELETE evento ajeno devuelve 404",
        r.status_code == 404,
        f"(status={r.status_code})",
    )

    r = client.delete(f"/api/v1/calendar/{evento_id}", headers=h1)
    check(
        "DELETE /calendar propio devuelve 200",
        r.status_code == 200,
        f"(status={r.status_code})",
    )

    # ================== TAREAS ==================
    print("\n--- Tareas ---")

    r = client.post(
        "/api/v1/tasks",
        headers=h1,
        json={
            "nombre": "Sacar la basura",
            "asignado_a": "Ana",
            "frecuencia": "diaria",
            "prioridad": "alta",
            "estado": "pendiente",
        },
    )
    check(
        "POST /tasks crea tarea (201)",
        r.status_code == 201,
        f"(status={r.status_code})",
    )
    tarea_id = r.json().get("id")

    r = client.get("/api/v1/tasks", headers=h1)
    tareas = r.json()
    check("GET /tasks lista la tarea creada", any(t["id"] == tarea_id for t in tareas))

    r = client.patch(
        f"/api/v1/tasks/{tarea_id}", headers=h1, json={"estado": "completado"}
    )
    check(
        "PATCH /tasks marca como completada (200)",
        r.status_code == 200 and r.json().get("estado") == "completado",
    )

    r = client.post(
        "/api/v1/tasks",
        headers=h1,
        json={
            "nombre": "Tarea mala",
            "frecuencia": "semanal",
            "prioridad": "urgentísima",
        },
    )
    check(
        "POST /tasks rechaza prioridad inválida (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    r = client.post(
        "/api/v1/tasks",
        headers=h1,
        json={
            "nombre": "Tarea mala 2",
            "frecuencia": "semanal",
            "estado": "en_progreso",
        },
    )
    check(
        "POST /tasks rechaza estado inválido (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # Aislamiento: el hogar 2 no ve las tareas del hogar 1
    r = client.get("/api/v1/tasks", headers=h2)
    tareas_h2 = r.json()
    check(
        "Aislamiento tareas: hogar 2 no ve tareas del hogar 1",
        len(tareas_h2) == 0,
        f"(tareas={len(tareas_h2)})",
    )

    # Cross-tenant: el hogar 2 no puede modificar ni borrar la tarea del hogar 1
    r = client.patch(
        f"/api/v1/tasks/{tarea_id}", headers=h2, json={"estado": "pendiente"}
    )
    check(
        "Cross-tenant: PATCH tarea ajena devuelve 404",
        r.status_code == 404,
        f"(status={r.status_code})",
    )

    r = client.delete(f"/api/v1/tasks/{tarea_id}", headers=h2)
    check(
        "Cross-tenant: DELETE tarea ajena devuelve 404",
        r.status_code == 404,
        f"(status={r.status_code})",
    )

    r = client.delete(f"/api/v1/tasks/{tarea_id}", headers=h1)
    check(
        "DELETE /tasks propio devuelve 200",
        r.status_code == 200,
        f"(status={r.status_code})",
    )

    # ================== IA en lenguaje natural (modo fallback, sin GEMINI_API_KEY) ==================
    print("\n--- IA: endpoints en lenguaje natural (fallback) ---")

    r = client.post(
        "/api/v1/tasks/interpretar",
        headers=h1,
        json={"texto": "sacar la basura los lunes"},
    )
    check(
        "POST /tasks/interpretar responde 200 (fallback)",
        r.status_code == 200,
        f"(status={r.status_code})",
    )
    check("Tareas NL: propuesta nula sin IA", r.json().get("tarea") is None)

    r = client.post(
        "/api/v1/pantry/interpretar",
        headers=h1,
        json={"texto": "compré 6 huevos y leche", "fecha_referencia": "2026-06-14"},
    )
    check(
        "POST /pantry/interpretar responde 200 (fallback)",
        r.status_code == 200,
        f"(status={r.status_code})",
    )
    check("Despensa NL: sin productos sin IA", r.json().get("alimentos") == [])

    r = client.post(
        "/api/v1/pantry/sugerir-metadata",
        headers=h1,
        json={"nombre": "Yogur natural", "fecha_referencia": "2026-06-14"},
    )
    check(
        "POST /pantry/sugerir-metadata responde 200 (fallback)",
        r.status_code == 200,
        f"(status={r.status_code})",
    )
    check(
        "Metadata: generado_por_ia=False sin IA",
        r.json().get("generado_por_ia") is False,
    )

    r = client.get("/api/v1/pantry/plan-comidas", headers=h1)
    check(
        "GET /pantry/plan-comidas responde 200 (fallback)",
        r.status_code == 200,
        f"(status={r.status_code})",
    )
    check(
        "Plan comidas: generado_por_ia=False sin IA",
        r.json().get("generado_por_ia") is False,
    )

    # Auth: los endpoints de IA exigen token
    r = client.post("/api/v1/tasks/interpretar", json={"texto": "algo de prueba"})
    check(
        "POST /tasks/interpretar sin token devuelve 401",
        r.status_code == 401,
        f"(status={r.status_code})",
    )

    # ================== ONBOARDING (perfil de hogar) ==================
    print("\n--- Onboarding ---")

    # Sin perfil aún -> 404
    r = client.get("/api/v1/onboarding", headers=h1)
    check(
        "GET /onboarding sin perfil devuelve 404",
        r.status_code == 404,
        f"(status={r.status_code})",
    )

    # Crear perfil (upsert: primera vez = create)
    r = client.post(
        "/api/v1/onboarding",
        headers=h1,
        json={"gustos_culinarios": [" Arroces ", "Pescado", ""], "num_comensales": 4},
    )
    check("POST /onboarding crea perfil (200)", r.status_code == 200, f"(status={r.status_code})")
    perfil1 = r.json()
    check(
        "Onboarding limpia gustos (strip + descarta vacíos)",
        perfil1.get("gustos_culinarios") == ["Arroces", "Pescado"],
        f"(gustos={perfil1.get('gustos_culinarios')})",
    )
    check("Onboarding guarda num_comensales", perfil1.get("num_comensales") == 4)
    perfil1_id = perfil1.get("id")

    # GET devuelve el perfil recién creado
    r = client.get("/api/v1/onboarding", headers=h1)
    check("GET /onboarding tras crear devuelve 200", r.status_code == 200)
    check("GET /onboarding refleja num_comensales", r.json().get("num_comensales") == 4)

    # Upsert: segunda vez = update (mismo id, valores nuevos)
    r = client.post(
        "/api/v1/onboarding",
        headers=h1,
        json={"gustos_culinarios": ["Legumbres"], "num_comensales": 2},
    )
    check("POST /onboarding actualiza (upsert) 200", r.status_code == 200)
    check(
        "Upsert conserva el mismo id de perfil",
        r.json().get("id") == perfil1_id,
        f"(id={r.json().get('id')})",
    )
    check("Upsert actualiza num_comensales", r.json().get("num_comensales") == 2)

    # Validación: num_comensales fuera de rango -> 422
    r = client.post(
        "/api/v1/onboarding",
        headers=h1,
        json={"gustos_culinarios": [], "num_comensales": 0},
    )
    check(
        "Onboarding rechaza num_comensales=0 (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # extra='forbid': campo no mapeado -> 422
    r = client.post(
        "/api/v1/onboarding",
        headers=h1,
        json={"gustos_culinarios": [], "num_comensales": 3, "alergias": ["gluten"]},
    )
    check(
        "Onboarding rechaza campos extra (422, art. 9 no se cuela)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # Auth: sin token -> 401
    r = client.post("/api/v1/onboarding", json={"gustos_culinarios": [], "num_comensales": 1})
    check(
        "POST /onboarding sin token devuelve 401",
        r.status_code == 401,
        f"(status={r.status_code})",
    )

    # Aislamiento multi-tenant: hogar2 no ve el perfil de hogar1
    r = client.get("/api/v1/onboarding", headers=h2)
    check(
        "Aislamiento: hogar2 no ve el perfil de hogar1 (404)",
        r.status_code == 404,
        f"(status={r.status_code})",
    )
    # hogar2 crea su propio perfil, distinto del de hogar1
    r = client.post(
        "/api/v1/onboarding",
        headers=h2,
        json={"gustos_culinarios": ["Verduras"], "num_comensales": 1},
    )
    check("Hogar2 crea su propio perfil (200)", r.status_code == 200)
    check(
        "Aislamiento: el perfil de hogar2 tiene id propio",
        r.json().get("id") != perfil1_id,
    )

    # ================== HISTORIAL DE RECETAS (aprendizaje de comportamiento) ==================
    print("\n--- Historial de Recetas ---")

    # GET historial vacío -> lista vacía
    r = client.get("/api/v1/pantry/recetas/historial", headers=h1)
    check(
        "GET /pantry/recetas/historial vacío devuelve []",
        r.status_code == 200 and r.json() == [],
        f"(status={r.status_code}, body={r.json()})",
    )

    # POST 'cocinada'
    r = client.post(
        "/api/v1/pantry/recetas/historial",
        headers=h1,
        json={"nombre_receta": "Tortilla de patatas", "accion": "cocinada"},
    )
    check(
        "POST historial 'cocinada' devuelve 201",
        r.status_code == 201,
        f"(status={r.status_code})",
    )
    hist1 = r.json()
    check("Historial guarda nombre_receta", hist1.get("nombre_receta") == "Tortilla de patatas")
    check("Historial guarda accion", hist1.get("accion") == "cocinada")
    check("Historial incluye hogar_id", "hogar_id" in hist1)

    # POST 'rechazada'
    r = client.post(
        "/api/v1/pantry/recetas/historial",
        headers=h1,
        json={"nombre_receta": "Pasta con curry", "accion": "rechazada"},
    )
    check(
        "POST historial 'rechazada' devuelve 201",
        r.status_code == 201,
        f"(status={r.status_code})",
    )

    # GET historial ahora tiene 2 entradas
    r = client.get("/api/v1/pantry/recetas/historial", headers=h1)
    check(
        "GET historial tras 2 acciones devuelve 2 entradas",
        r.status_code == 200 and len(r.json()) == 2,
        f"(status={r.status_code}, len={len(r.json())})",
    )

    # Validación: accion inválida -> 422
    r = client.post(
        "/api/v1/pantry/recetas/historial",
        headers=h1,
        json={"nombre_receta": "Algo", "accion": "me_gusta_mucho"},
    )
    check(
        "Historial rechaza acción inválida (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # extra='forbid': campo extra -> 422
    r = client.post(
        "/api/v1/pantry/recetas/historial",
        headers=h1,
        json={"nombre_receta": "Algo", "accion": "cocinada", "valoracion": 5},
    )
    check(
        "Historial rechaza campos extra (422)",
        r.status_code == 422,
        f"(status={r.status_code})",
    )

    # Auth: sin token -> 401
    r = client.post(
        "/api/v1/pantry/recetas/historial",
        json={"nombre_receta": "Algo", "accion": "cocinada"},
    )
    check(
        "POST historial sin token devuelve 401",
        r.status_code == 401,
        f"(status={r.status_code})",
    )

    # Aislamiento: hogar2 tiene su propio historial (vacío)
    r = client.get("/api/v1/pantry/recetas/historial", headers=h2)
    check(
        "Aislamiento: hogar2 no ve el historial de hogar1",
        r.status_code == 200 and r.json() == [],
        f"(status={r.status_code}, body={r.json()})",
    )

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} fallos -> {fallos}")
    sys.exit(1)
print("RESULTADO: todas las pruebas pasaron")
