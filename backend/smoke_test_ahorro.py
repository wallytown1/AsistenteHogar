"""Smoke test -- Informe de Ahorro (North Star: € ahorrados/mes por hogar).

Valida el cálculo de AhorroService cruzando consumos del mes con precios de
tickets (movimientos 'compra' con precio_unitario). Verifica:
  - El ahorro real se calcula correctamente (precio x cantidad consumida).
  - El cruce precio<->consumo es por (nombre, unidad): unidades incoherentes
    NO se valoran (no inventar cifras absurdas €/ud contra kg).
  - Aislamiento multi-tenant: un hogar NUNCA ve los € ni el desglose de otro
    (fuga de datos financieros entre familias = crítico).

Las siembras se hacen vía el repositorio async (misma engine que la app) porque
una conexión sqlite separada no vería los commits de aiosqlite durante el TestClient.

Ejecutar: python smoke_test_ahorro.py
"""
import asyncio
import os
import sys
import uuid

_DBFILE = f"./smoke_ahorro_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DBFILE}"
os.environ.setdefault("JWT_SECRET_KEY", "smoke-test-ahorro-secret-key")
# Hermético: sin red ni llamadas reales. REVENUECAT vacío => gate premium OFF en tests.
os.environ["GEMINI_API_KEY"] = ""
os.environ["REVENUECAT_SECRET_KEY"] = ""

from alembic import command as alembic_command
from alembic.config import Config

alembic_command.upgrade(Config("alembic.ini"), "head")

from fastapi.testclient import TestClient
from app.main import app

fallos: list[str] = []


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    estado = "OK  " if condicion else "FALLO"
    print(f"[{estado}] {nombre}" + (f" ({detalle})" if detalle else ""))
    if not condicion:
        fallos.append(nombre)


def _registrar_hogar(client: TestClient, suffix: str) -> dict:
    """Registra un hogar y devuelve las cabeceras de auth."""
    r = client.post("/api/v1/auth/registro", json={
        "nombre_hogar": f"Hogar {suffix}", "nombre": f"User {suffix}",
        "email": f"ahorro_{suffix}@test.com", "password": "SecurePass123",
    })
    token = r.json()["access_token"]
    hogar_id = r.json()["hogar"]["id"]
    return {"headers": {"Authorization": f"Bearer {token}"}, "hogar_id": hogar_id}


async def _sembrar_movimientos(hogar_a: str, hogar_b: str) -> None:
    """Siembra movimientos en movimientos_despensa vía el repositorio async.

    La fecha la rellena el server_default (utcnow) => mes actual, que es justo el
    mes que el resumen analiza por defecto."""
    from app.database import async_session_maker
    from app.repositories.movimientos import MovimientoDespensaRepository

    async with async_session_maker() as session:
        repo = MovimientoDespensaRepository(session)
        ha = uuid.UUID(hogar_a)
        hb = uuid.UUID(hogar_b)

        # --- Hogar A: caso correcto (misma unidad kg) ---
        # Compra de tomate: 2 kg a 1.80 €/kg (precio de ticket).
        await repo.registrar(
            ha, "tomate", "compra", cantidad=2, unidad="kg",
            origen="ticket", precio_unitario=1.80,
        )
        # Consumo de tomate: 2 kg en el mes actual.
        await repo.registrar(
            ha, "tomate", "consumo", cantidad=2, unidad="kg", origen="cocina",
        )

        # --- Hogar A: caso de unidad incoherente (NO debe valorarse) ---
        # Compra de platano con precio en 'ud' pero consumo en 'kg':
        # el cruce es por (nombre, unidad), así que no debe sumar al ahorro.
        await repo.registrar(
            ha, "platano", "compra", cantidad=6, unidad="ud",
            origen="ticket", precio_unitario=0.30,
        )
        await repo.registrar(
            ha, "platano", "consumo", cantidad=1, unidad="kg", origen="cocina",
        )

        # --- Hogar B: SIN movimientos de ahorro (debe ver 0/None) ---
        # (no se siembra nada para B a propósito).


with TestClient(app) as client:
    hA = _registrar_hogar(client, "A")
    hB = _registrar_hogar(client, "B")

    asyncio.run(_sembrar_movimientos(hA["hogar_id"], hB["hogar_id"]))

    print("\n[Bloque 1] Preview (free) del hogar A")
    r = client.get("/api/v1/ahorro/resumen/preview", headers=hA["headers"])
    check("1.1 GET /ahorro/resumen/preview -> 200", r.status_code == 200, f"status={r.status_code}")
    prev = r.json() if r.status_code == 200 else {}
    check("1.2 preview marca tiene_datos_reales", prev.get("tiene_datos_reales") is True,
          f"valor={prev.get('tiene_datos_reales')}")

    print("\n[Bloque 2] Resumen (premium, gate OFF en tests) del hogar A")
    r = client.get("/api/v1/ahorro/resumen", headers=hA["headers"])
    check("2.1 GET /ahorro/resumen -> 200", r.status_code == 200, f"status={r.status_code}")
    res = r.json() if r.status_code == 200 else {}

    ahorro = res.get("ahorro_real_eur")
    check("2.2 ahorro_real_eur >= 0 (esperado ~3.60)",
          ahorro is not None and ahorro >= 0 and abs(ahorro - 3.60) < 1e-6,
          f"ahorro_real_eur={ahorro}")
    check("2.3 tiene_datos_reales True", res.get("tiene_datos_reales") is True,
          f"valor={res.get('tiene_datos_reales')}")
    pct = res.get("porcentaje_media_espana")
    check("2.4 0 <= porcentaje_media_espana <= 100",
          isinstance(pct, int) and 0 <= pct <= 100, f"pct={pct}")

    desglose = res.get("desglose", [])
    check("2.5 desglose sin valores negativos",
          all(d.get("valor_total", 0) >= 0 and d.get("cantidad_total", 0) >= 0
              and d.get("precio_unitario_medio", 0) >= 0 for d in desglose),
          f"n={len(desglose)}")

    print("\n[Bloque 3] Unidad incoherente NO se valora")
    nombres_desglose = {d.get("nombre") for d in desglose}
    check("3.1 'tomate' (kg<->kg) SÍ está en el desglose", "tomate" in nombres_desglose,
          f"nombres={nombres_desglose}")
    check("3.2 'platano' (ud<->kg) NO está en el desglose", "platano" not in nombres_desglose,
          f"nombres={nombres_desglose}")
    # El platano incoherente no debe haber sumado al ahorro: el total sigue siendo el del tomate.
    check("3.3 el ítem incoherente no infló el ahorro (sigue ~3.60)",
          ahorro is not None and abs(ahorro - 3.60) < 1e-6, f"ahorro_real_eur={ahorro}")

    print("\n[Bloque 4] Aislamiento multi-tenant (fuga de datos financieros)")
    r = client.get("/api/v1/ahorro/resumen", headers=hB["headers"])
    check("4.1 GET /ahorro/resumen del hogar B -> 200", r.status_code == 200, f"status={r.status_code}")
    resB = r.json() if r.status_code == 200 else {}
    check("4.2 hogar B NO ve € del hogar A (ahorro_real_eur 0/None)",
          resB.get("ahorro_real_eur") in (None, 0, 0.0),
          f"ahorro_real_eur={resB.get('ahorro_real_eur')}")
    check("4.3 hogar B NO ve el desglose del hogar A (vacío)",
          len(resB.get("desglose", [])) == 0, f"n={len(resB.get('desglose', []))}")
    check("4.4 hogar B tiene_datos_reales False",
          resB.get("tiene_datos_reales") is False, f"valor={resB.get('tiene_datos_reales')}")


# Limpieza de la BD temporal (cada test usa su propio fichero único).
# En Windows hay que liberar el engine (cierra el pool de conexiones aiosqlite)
# antes de borrar el fichero, o el SO impide el unlink por handle abierto.
try:
    from app.database import engine
    asyncio.run(engine.dispose())
except Exception:
    pass
try:
    if os.path.exists(_DBFILE):
        os.remove(_DBFILE)
except OSError:
    pass

print("\n" + "=" * 50)
if fallos:
    print(f"smoke_test_ahorro: {len(fallos)} FALLO(S): {fallos}")
    sys.exit(1)
print("smoke_test_ahorro: todos los checks pasaron")
