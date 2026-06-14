"""Prueba de humo de la fase F-LEGAL: purga física RGPD, eliminación de cuenta
(App Store/Google Play + art. 17) y anonimización LLM.
Usa una base de datos SQLite temporal independiente de la de desarrollo."""
import asyncio
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

TEST_DB = "smoke_test_legal.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///./{TEST_DB}"
# Hermético: forzar el modo de contingencia del LLM (sin red ni llamadas reales a Gemini),
# independientemente de lo que haya en .env.
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
from app.services.privacy import AnonimizadorLLM
from app.jobs.purge import run_purge_once

fallos = []

def check(nombre, condicion, detalle=""):
    estado = "OK " if condicion else "FALLO"
    print(f"[{estado}] {nombre} {detalle}")
    if not condicion:
        fallos.append(nombre)


# --- Parte 1: AnonimizadorLLM (unidad) ---------------------------------------

anon = AnonimizadorLLM(["Juan", "Ana María", "Ana", None, "  ", "ana"])
texto = "Ana María lleva a Juan al dentista; Ana prepara la cena."
anonimo = anon.anonimizar(texto)
check("Anonimizador: ningún nombre real queda en el prompt",
      "Juan" not in anonimo and "Ana" not in anonimo, f"({anonimo})")
check("Anonimizador: usa tokens Familiar_N", "Familiar_" in anonimo)
check("Anonimizador: 'Ana María' no se rompe por 'Ana' (longest-first)",
      "María" not in anonimo, f"({anonimo})")
check("Anonimizador: la reversión restaura el texto original",
      anon.revertir(anonimo) == texto, f"({anon.revertir(anonimo)})")
check("Anonimizador: revierte también 'Familiar 1' con espacio",
      "Familiar" not in anon.revertir(anonimo.replace("_", " ")))
check("Anonimizador: sin nombres es un no-op",
      AnonimizadorLLM([]).anonimizar("hola Pedro") == "hola Pedro")


# --- Parte 2: API (purga + eliminación de cuenta) -----------------------------

with TestClient(app) as client:
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": "Familia Legal",
        "nombre": "Carla",
        "email": "carla@test.com",
        "password": "contrasena_segura_123"
    })
    check("Registro devuelve 201", r.status_code == 201, f"(status={r.status_code})")
    token = r.json().get("access_token", "")
    h = {"Authorization": f"Bearer {token}"}

    # El dashboard expone el flag de transparencia IA (fallback sin API key -> False)
    r = client.get("/api/v1/dashboard", headers=h)
    check("Dashboard expone briefing_generado_por_ia=False sin API key",
          r.status_code == 200 and r.json().get("briefing_generado_por_ia") is False)

    # Crear y soft-borrar un recurso de cada tipo (candidatos a purga)
    ids_purga = {}
    r = client.post("/api/v1/pantry", headers=h, json={
        "nombre": "Yogur viejo", "cantidad": 1.0, "unidad": "unidades", "categoria": "Lácteos"})
    ids_purga["inventario_alimentos"] = r.json()["id"]
    r = client.post("/api/v1/tasks", headers=h, json={
        "nombre": "Tarea antigua", "frecuencia": "diaria"})
    ids_purga["tareas_hogar"] = r.json()["id"]
    r = client.post("/api/v1/calendar", headers=h, json={
        "titulo": "Evento antiguo",
        "fecha_inicio": "2030-01-01T10:00:00+00:00",
        "fecha_fin": "2030-01-01T11:00:00+00:00"})
    ids_purga["eventos_calendario"] = r.json()["id"]

    client.delete(f"/api/v1/pantry/{ids_purga['inventario_alimentos']}", headers=h)
    client.delete(f"/api/v1/tasks/{ids_purga['tareas_hogar']}", headers=h)
    client.delete(f"/api/v1/calendar/{ids_purga['eventos_calendario']}", headers=h)

    # Un soft-delete RECIENTE que NO debe purgarse, y un item activo
    r = client.post("/api/v1/pantry", headers=h, json={
        "nombre": "Borrado reciente", "cantidad": 1.0, "unidad": "unidades", "categoria": "Otros"})
    id_reciente = r.json()["id"]
    client.delete(f"/api/v1/pantry/{id_reciente}", headers=h)
    client.post("/api/v1/pantry", headers=h, json={
        "nombre": "Leche activa", "cantidad": 2.0, "unidad": "litros", "categoria": "Lácteos"})

    # Retroceder updated_at de los candidatos más allá del plazo de retención.
    # SQLite (SQLAlchemy): UUIDs como hex de 32 chars sin guiones; datetimes sin offset.
    def sid(uuid_str):
        return uuid_str.replace("-", "")

    antigua = (datetime.now(timezone.utc) - timedelta(days=40)).strftime("%Y-%m-%d %H:%M:%S.%f")
    con = sqlite3.connect(TEST_DB)
    for tabla, fila_id in ids_purga.items():
        cur = con.execute(f"UPDATE {tabla} SET updated_at = ? WHERE id = ?", (antigua, sid(fila_id)))
        check(f"Preparación: updated_at retrocedido en {tabla}", cur.rowcount == 1, f"(rowcount={cur.rowcount})")
    con.commit()
    con.close()

    # Ejecutar la purga manualmente (misma vía que el CLI y el scheduler)
    purgados = asyncio.run(run_purge_once())
    check("Purga: elimina exactamente los 3 registros caducados", purgados == 3, f"(purgados={purgados})")

    con = sqlite3.connect(TEST_DB)
    restantes = sum(
        con.execute(f"SELECT COUNT(*) FROM {tabla} WHERE id = ?", (sid(fila_id),)).fetchone()[0]
        for tabla, fila_id in ids_purga.items()
    )
    check("Purga: los registros caducados ya no existen físicamente", restantes == 0, f"(restantes={restantes})")
    reciente_existe = con.execute(
        "SELECT COUNT(*) FROM inventario_alimentos WHERE id = ?", (sid(id_reciente),)).fetchone()[0]
    check("Purga: el soft-delete reciente sobrevive (dentro del plazo)", reciente_existe == 1)
    activos = con.execute(
        "SELECT COUNT(*) FROM inventario_alimentos WHERE is_deleted = 0").fetchone()[0]
    check("Purga: los registros activos sobreviven", activos == 1, f"(activos={activos})")
    auditoria = con.execute(
        "SELECT tipo_evento, motivo, registros_afectados FROM registros_borrado").fetchall()
    check("Purga: queda evidencia agregada en registros_borrado",
          ("purga_programada", "retencion_30_dias", 3) in auditoria, f"(auditoria={auditoria})")
    columnas = [c[1] for c in con.execute("PRAGMA table_info(registros_borrado)").fetchall()]
    check("Auditoría sin datos personales (sin hogar_id/email/nombre)",
          not any(c in columnas for c in ("hogar_id", "email", "nombre")), f"(columnas={columnas})")
    con.close()

    # --- Eliminación de cuenta -------------------------------------------------
    r = client.request("DELETE", "/api/v1/auth/cuenta", json={"password": "contrasena_segura_123"})
    check("DELETE /auth/cuenta sin token devuelve 401", r.status_code == 401, f"(status={r.status_code})")

    r = client.request("DELETE", "/api/v1/auth/cuenta", headers=h, json={"password": "incorrecta_123"})
    check("Contraseña errónea devuelve 401 y no borra", r.status_code == 401, f"(status={r.status_code})")
    r = client.get("/api/v1/auth/me", headers=h)
    check("La sesión sigue viva tras el intento fallido", r.status_code == 200, f"(status={r.status_code})")

    r = client.request("DELETE", "/api/v1/auth/cuenta", headers=h,
                       json={"password": "contrasena_segura_123", "extra": "x"})
    check("Campo extra en el cuerpo devuelve 422 (extra='forbid')", r.status_code == 422, f"(status={r.status_code})")

    r = client.request("DELETE", "/api/v1/auth/cuenta", headers=h, json={"password": "contrasena_segura_123"})
    check("Eliminación correcta devuelve 200 y success=true",
          r.status_code == 200 and r.json().get("success") is True, f"(status={r.status_code})")

    r = client.get("/api/v1/auth/me", headers=h)
    check("El token deja de ser válido tras la eliminación", r.status_code == 401, f"(status={r.status_code})")

    con = sqlite3.connect(TEST_DB)
    totales = {
        tabla: con.execute(f"SELECT COUNT(*) FROM {tabla}").fetchone()[0]
        for tabla in ("hogares", "usuarios", "inventario_alimentos", "tareas_hogar", "eventos_calendario")
    }
    check("Destrucción física total del hogar y datos vinculados",
          all(n == 0 for n in totales.values()), f"({totales})")
    cuenta_audit = con.execute(
        "SELECT COUNT(*) FROM registros_borrado WHERE tipo_evento = 'eliminacion_cuenta'").fetchone()[0]
    check("La eliminación de cuenta queda auditada", cuenta_audit == 1)
    con.close()

    # El email queda libre: se puede volver a registrar (los datos se fueron de verdad)
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": "Familia Nueva",
        "nombre": "Carla",
        "email": "carla@test.com",
        "password": "otra_contrasena_456"
    })
    check("El email puede reutilizarse tras la eliminación", r.status_code == 201, f"(status={r.status_code})")

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} fallos -> {fallos}")
    sys.exit(1)
print("RESULTADO: todas las pruebas pasaron")
