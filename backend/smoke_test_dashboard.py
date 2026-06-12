"""Prueba de humo del Dashboard (Informe de la Mañana).

El dashboard es la pieza con más lógica de agregación del backend: orquesta
de forma concurrente despensa, calendario y tareas, y aplica varios filtros
no triviales que aquí se verifican de forma aislada:

- eventos_hoy: solo eventos cuya fecha_inicio cae HOY (UTC), no los de otros días.
- tareas_pendientes: solo tareas en estado 'pendiente', no las completadas.
- alertas_despensa: solo alimentos que caducan en 6 días o menos.
- briefing_texto: presente incluso sin GEMINI_API_KEY (fallback estático).
- Aislamiento multi-tenant: el dashboard de un hogar no agrega datos de otro.

Se ejecuta sin GEMINI_API_KEY: el briefing usa el modo de contingencia, de modo
que la prueba es determinista y no depende de la red ni de la API de Gemini.
"""
import os
import sys
from datetime import datetime, timedelta, timezone, time as dtime

TEST_DB = "smoke_test_dashboard.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///./{TEST_DB}"
# Forzar el modo de contingencia del briefing: prueba determinista, sin red.
os.environ["GEMINI_API_KEY"] = ""

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


# Fechas alineadas con el servicio (que usa UTC) para no fallar cerca de medianoche
hoy_utc = datetime.now(timezone.utc).date()
manana_utc = hoy_utc + timedelta(days=1)
caduca_pronto = hoy_utc + timedelta(days=2)    # dentro de la ventana de 6 días
caduca_lejano = hoy_utc + timedelta(days=30)   # fuera de la ventana de alerta


def iso(dia, hora: int) -> str:
    """datetime ISO-8601 con offset UTC para un día y hora dados."""
    return datetime.combine(dia, dtime(hora, 0), tzinfo=timezone.utc).isoformat()


def registrar(client, nombre_hogar, nombre, email):
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": nombre_hogar,
        "nombre": nombre,
        "email": email,
        "password": "contrasena_segura_123"
    })
    return r.json().get("access_token", "")


with TestClient(app) as client:
    token1 = registrar(client, "Hogar Uno", "Ana", "ana@dash.com")
    token2 = registrar(client, "Hogar Dos", "Berta", "berta@dash.com")
    h1 = {"Authorization": f"Bearer {token1}"}
    h2 = {"Authorization": f"Bearer {token2}"}

    # ================== ESTRUCTURA Y AUTENTICACIÓN ==================
    print("\n--- Estructura y autenticación ---")

    r = client.get("/api/v1/dashboard")
    check("GET /dashboard sin token devuelve 401", r.status_code == 401, f"(status={r.status_code})")

    r = client.get("/api/v1/dashboard", headers=h1)
    check("GET /dashboard con token devuelve 200", r.status_code == 200, f"(status={r.status_code})")
    data = r.json()

    campos_esperados = {"fecha", "eventos_hoy", "alertas_despensa", "tareas_pendientes", "conflictos_agenda", "briefing_texto"}
    check("La respuesta contiene todos los campos del contexto", campos_esperados.issubset(data.keys()),
          f"(faltan={campos_esperados - set(data.keys())})")

    check("briefing_texto presente sin API key (fallback)", bool(data.get("briefing_texto")))

    # Estado inicial: hogar recién creado, sin datos
    check("Dashboard inicial: eventos_hoy vacío", data["eventos_hoy"] == [])
    check("Dashboard inicial: tareas_pendientes vacío", data["tareas_pendientes"] == [])
    check("Dashboard inicial: 0 items disponibles", data["alertas_despensa"]["items_disponibles"] == 0)

    # ================== AGREGACIÓN Y FILTRADO ==================
    print("\n--- Agregación y filtrado ---")

    # Eventos: uno HOY y uno MAÑANA (solo el de hoy debe aparecer)
    client.post("/api/v1/calendar", headers=h1, json={
        "titulo": "Evento de Hoy", "fecha_inicio": iso(hoy_utc, 9), "fecha_fin": iso(hoy_utc, 10)
    })
    client.post("/api/v1/calendar", headers=h1, json={
        "titulo": "Evento de Manana", "fecha_inicio": iso(manana_utc, 9), "fecha_fin": iso(manana_utc, 10)
    })

    # Tareas: una pendiente y una que se completará (solo la pendiente debe aparecer)
    client.post("/api/v1/tasks", headers=h1, json={
        "nombre": "Tarea Pendiente", "frecuencia": "diaria", "prioridad": "alta"
    })
    r = client.post("/api/v1/tasks", headers=h1, json={
        "nombre": "Tarea Completada", "frecuencia": "diaria", "prioridad": "baja"
    })
    tarea_completada_id = r.json().get("id")
    client.patch(f"/api/v1/tasks/{tarea_completada_id}", headers=h1, json={"estado": "completado"})

    # Despensa: uno que caduca pronto y uno lejano (solo el próximo debe alertar)
    client.post("/api/v1/pantry", headers=h1, json={
        "nombre": "Leche", "cantidad": 2.0, "unidad": "litros",
        "categoria": "Lácteos", "fecha_caducidad": caduca_pronto.isoformat()
    })
    client.post("/api/v1/pantry", headers=h1, json={
        "nombre": "Arroz", "cantidad": 5.0, "unidad": "kg",
        "categoria": "Despensa", "fecha_caducidad": caduca_lejano.isoformat()
    })

    r = client.get("/api/v1/dashboard", headers=h1)
    data = r.json()

    titulos_hoy = [e["titulo"] for e in data["eventos_hoy"]]
    check("Filtrado fecha: evento de hoy aparece en eventos_hoy", "Evento de Hoy" in titulos_hoy)
    check("Filtrado fecha: evento de mañana NO aparece", "Evento de Manana" not in titulos_hoy,
          f"(titulos={titulos_hoy})")

    nombres_tareas = [t["nombre"] for t in data["tareas_pendientes"]]
    check("Filtrado estado: tarea pendiente aparece", "Tarea Pendiente" in nombres_tareas)
    check("Filtrado estado: tarea completada NO aparece", "Tarea Completada" not in nombres_tareas,
          f"(tareas={nombres_tareas})")

    nombres_alerta = [a["nombre"] for a in data["alertas_despensa"]["alertas_caducidad"]]
    check("Caducidad: item próximo a caducar aparece en alertas", "Leche" in nombres_alerta)
    check("Caducidad: item de caducidad lejana NO alerta", "Arroz" not in nombres_alerta,
          f"(alertas={nombres_alerta})")
    check("Despensa: items_disponibles refleja el total (2)", data["alertas_despensa"]["items_disponibles"] == 2,
          f"(items={data['alertas_despensa']['items_disponibles']})")

    # Conflicto de hoy: segundo evento solapado con "Evento de Hoy" (09:00-10:00)
    client.post("/api/v1/calendar", headers=h1, json={
        "titulo": "Solapado Hoy", "fecha_inicio": iso(hoy_utc, 9), "fecha_fin": iso(hoy_utc, 11)
    })
    r = client.get("/api/v1/dashboard", headers=h1)
    conflictos = r.json()["conflictos_agenda"]
    check("Conflicto de hoy aparece en conflictos_agenda", len(conflictos) >= 1, f"(conflictos={len(conflictos)})")

    # ================== AISLAMIENTO MULTI-TENANT ==================
    print("\n--- Aislamiento multi-tenant ---")

    r = client.get("/api/v1/dashboard", headers=h2)
    data2 = r.json()
    check("Aislamiento: dashboard del hogar 2 no ve eventos del hogar 1", data2["eventos_hoy"] == [])
    check("Aislamiento: dashboard del hogar 2 no ve tareas del hogar 1", data2["tareas_pendientes"] == [])
    check("Aislamiento: dashboard del hogar 2 sin items de despensa", data2["alertas_despensa"]["items_disponibles"] == 0)
    check("Aislamiento: dashboard del hogar 2 sin conflictos", data2["conflictos_agenda"] == [])

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} fallos -> {fallos}")
    sys.exit(1)
print("RESULTADO: todas las pruebas pasaron")
