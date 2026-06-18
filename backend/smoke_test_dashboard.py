"""Prueba de humo del Dashboard (Informe de la Mañana).

Tras el pivote a app exclusiva de comida, el dashboard agrega únicamente el
estado de la despensa y genera el briefing:

- alertas_despensa: solo alimentos que caducan en 6 días o menos.
- briefing_texto: presente incluso sin GEMINI_API_KEY (fallback estático).
- Aislamiento multi-tenant: el dashboard de un hogar no agrega datos de otro.

Se ejecuta sin GEMINI_API_KEY: el briefing usa el modo de contingencia, de modo
que la prueba es determinista y no depende de la red ni de la API de Gemini.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

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
caduca_pronto = hoy_utc + timedelta(days=2)    # dentro de la ventana de 6 días
caduca_lejano = hoy_utc + timedelta(days=30)   # fuera de la ventana de alerta


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

    campos_esperados = {"fecha", "alertas_despensa", "briefing_texto"}
    check("La respuesta contiene los campos del contexto", campos_esperados.issubset(data.keys()),
          f"(faltan={campos_esperados - set(data.keys())})")

    check("briefing_texto presente sin API key (fallback)", bool(data.get("briefing_texto")))
    check("briefing_generado_por_ia=False sin API key", data.get("briefing_generado_por_ia") is False)

    # El contexto ya no expone eventos ni tareas (pivote a app de comida)
    check("Dashboard no expone eventos_hoy", "eventos_hoy" not in data)
    check("Dashboard no expone tareas_pendientes", "tareas_pendientes" not in data)
    check("Dashboard no expone conflictos_agenda", "conflictos_agenda" not in data)

    # Estado inicial: hogar recién creado, sin datos
    check("Dashboard inicial: 0 items disponibles", data["alertas_despensa"]["items_disponibles"] == 0)

    # ================== AGREGACIÓN Y FILTRADO DE DESPENSA ==================
    print("\n--- Agregación y filtrado de despensa ---")

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

    nombres_alerta = [a["nombre"] for a in data["alertas_despensa"]["alertas_caducidad"]]
    check("Caducidad: item próximo a caducar aparece en alertas", "Leche" in nombres_alerta)
    check("Caducidad: item de caducidad lejana NO alerta", "Arroz" not in nombres_alerta,
          f"(alertas={nombres_alerta})")
    check("Despensa: items_disponibles refleja el total (2)", data["alertas_despensa"]["items_disponibles"] == 2,
          f"(items={data['alertas_despensa']['items_disponibles']})")

    # ================== AISLAMIENTO MULTI-TENANT ==================
    print("\n--- Aislamiento multi-tenant ---")

    r = client.get("/api/v1/dashboard", headers=h2)
    data2 = r.json()
    check("Aislamiento: dashboard del hogar 2 sin items de despensa", data2["alertas_despensa"]["items_disponibles"] == 0)
    check("Aislamiento: dashboard del hogar 2 sin alertas", data2["alertas_despensa"]["alertas_caducidad"] == [])

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} fallos -> {fallos}")
    sys.exit(1)
print("RESULTADO: todas las pruebas pasaron")
