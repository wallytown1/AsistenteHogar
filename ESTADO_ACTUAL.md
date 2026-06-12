# ESTADO ACTUAL — AsistenteHogar (2026-06-12)

## ✅ Completado

| Fase | Descripción | Archivos principales |
|------|-----------|----------------------|
| F0 | MVP base (endpoints, BD, UI mock) | backend/app/main.py, frontend/App.tsx |
| F1 | JWT + multi-tenant (hogar_id del token) | backend/app/{core/security.py, services/auth.py, api/routers/auth.py} |
| F2 | Frontend auth (login/registro/SecureStore) | frontend/src/{state/authStore.ts, screens/AuthScreen.tsx} |
| F3 | Hardening (rate limiting, CORS, logs) | backend/app/core/{rate_limit.py, logging_config.py} |
| F-IA | Gemini real (briefing + recetas + caché) | backend/app/services/llm.py, backend/app/api/routers/pantry.py |
| F-HONESTA | Reenfoque agente personal (sin UI falsa) | frontend/src/screens/{DashboardScreen, PantryScreen, CalendarScreen}.tsx |
| F-TEST | Suite de tests + corrección de 3 bugs + CRUD calendario | backend/smoke_test_*.py, frontend/src/screens/TasksScreen.tsx |
| F-QA | Ciclo QA mobile: 2 críticos + 2 medios resueltos, 0 errores TS | frontend/src/{api,hooks,state}/ |

## 🧪 Sesión 2026-06-12 — Tests, bugs y consistencia

**Frontend**
- Nueva pantalla **TasksScreen** (gestión de tareas: crear, completar, eliminar, filtros). Integrada como tab "Tareas".
- `npm run ts:check` verificado: **0 errores** (Node.js v24.16.0 instalado).

**Backend — suite de smoke tests (82 checks, todos en verde)**
- `smoke_test_auth.py` (12) — autenticación + aislamiento.
- `smoke_test_modules.py` (30) — CRUD pantry/calendar/tasks, validación, conflictos, multi-tenant.
- `smoke_test_dashboard.py` (20) — agregación/filtrado por fecha y estado, fallback IA.
- `smoke_test_validation.py` (20) — contrato de errores HTTP (400/401/404/422) e integridad de texto.
- Ejecución: requieren `JWT_SECRET_KEY` en entorno y deps instaladas; cada uno usa su propia BD SQLite temporal.

**Backend — 3 bugs reales corregidos (con test de regresión)**
1. `PATCH /pantry/{id}` sin cuerpo → antes 500 (NoneType.model_dump), ahora **400**.
2. Registro con contraseña > 72 bytes → antes 500 (bcrypt ValueError), ahora **422**. (login ya estaba a salvo).
3. `sanitize_text` escapaba comillas/backslash y corrompía texto visible (doble escape en dashboard) → ahora solo `.strip()`.

**Backend — consistencia de API**
- Nuevo endpoint **`PATCH /calendar/{evento_id}`** para editar eventos (paridad con pantry/tasks; el servicio/repo ya existían).

**Documentación**
- `CLAUDE.md` — guía de trabajo para el repo.
- `ENDPOINTS.md` — referencia completa de la API REST.
- Eliminados docs obsoletos (CHANGELOG_ARCHIVE, ConversacionInicial, PROMPT_MAESTRO, .agents/rules/). Se conservó `01_CONTEXTO_Y_ARQUITECTURA_APP.md` como referencia del schema/contrato original.

## 🔍 Sesión 2026-06-12 — Ciclo QA móvil (F-QA)

Auditoría completa del frontend (`frontend/src/`) con foco en contratos de API, estado Zustand, red y seguridad.

**2 críticos resueltos**

1. **IP de backend obsoleta** (`frontend/.env.development`): apuntaba a `192.168.1.143` (red anterior); cambiada a `172.20.10.2` (IP LAN activa). Era la causa directa de que el registro/login fallase con error de red.
2. **Secretos del backend en `frontend/.env`**: el archivo contenía `JWT_SECRET_KEY` + `DATABASE_URL` y no estaba en `.gitignore` (un `git add .` lo hubiera subido al repo). Eliminado y añadida regla `frontend/.env` al `.gitignore` raíz.

**2 medios resueltos**

3. **Crash silencioso en web al registrar** (`authStore.ts`): `expo-secure-store` no está disponible en `react-native-web`; `setSession`/`logout` lanzaban excepción que `AuthScreen` capturaba como "No se pudo crear el hogar" aunque la cuenta sí se había creado en el backend. Fix: persistencia en `try/catch`; la sesión en memoria queda activa aunque SecureStore no esté disponible.
4. **Sin timeout ni cancelación en peticiones** (`api.ts` + 4 hooks): spinner infinito si el backend no responde; posible setState sobre componente desmontado. Fixes:
   - `AbortSignal.timeout(15000)` como señal por defecto en `apiRequest`.
   - `AbortController` + cleanup en `useEffect` de `useDashboard`, `useCalendar`, `usePantry` y `useTasks`.
   - Mensajes de error diferenciados: `TimeoutError` vs error genérico de red.
   - `refetch` expuesto como wrapper `() => fetchX()` para compatibilidad de tipos con `onPress`.

**Verificación final**: `npm run ts:check` → **0 errores**.

## 🚀 Próximo paso: F4 — Freemium

**Descripción:** Integración RevenueCat (IAP iOS/Android) + límites free vs premium en backend.

**Requiere:** Cuenta en https://app.revenuecat.com

**No iniciado aún.** Esperar instrucción del usuario.

---

## 📊 Qué hace la app ahora

### Dashboard
- Briefing diario generado por Gemini
- Eventos de hoy
- Tareas pendientes
- Alertas de alimentos próximos a caducar

### Despensa
- Inventario real con stock, categoría, caducidad
- Recetas sugeridas por IA (max 3)
- Filtros por categoría y stock bajo
- Añadir/editar productos

### Calendario
- Agenda familiar con eje horario 07:00–22:00
- Conflictos de horario detectados automáticamente
- **Quick-add en lenguaje natural** → Gemini interpreta y propone evento → usuario confirma
- Filtros por participantes (derivados de eventos reales)

### Autenticación
- Registro/login con JWT (30 días)
- Token en SecureStore (cifrado nativo)
- Aislamiento multi-tenant garantizado

---

## 🔧 Verificación mínima antes de cambios

```bash
# Backend — suite completa (82 checks). Requiere JWT_SECRET_KEY en el entorno.
cd backend
python smoke_test_auth.py        # 12/12
python smoke_test_modules.py     # 30/30
python smoke_test_dashboard.py   # 20/20
python smoke_test_validation.py  # 20/20

# Frontend
cd frontend
npm run ts:check  # Debe retornar 0 errores
```

---

## 📁 Archivos críticos

### Backend
- `backend/.env` — JWT_SECRET_KEY, GEMINI_API_KEY, DATABASE_URL, ENVIRONMENT
- `backend/app/main.py` — punto de entrada FastAPI
- `backend/app/services/llm.py` — Gemini (briefing, recetas, interpretar)
- `backend/app/api/routers/` — endpoints auth, dashboard, pantry, calendar, tasks
- `backend/alembic/versions/` — migraciones SQL

- `backend/smoke_test_*.py` — suite de pruebas de humo (auth, modules, dashboard, validation)

### Frontend
- `frontend/src/screens/` — DashboardScreen, PantryScreen, CalendarScreen, TasksScreen (UI principal)
- `frontend/src/state/authStore.ts` — Zustand (token, usuario, hogar)
- `frontend/src/api/api.ts` — httpx client con Bearer token
- `frontend/tailwind.config.js` — Tailwind config para NativeWind

### Documentación
- `CLAUDE.md` — guía de trabajo del repo (comandos + arquitectura) para Claude Code
- `ENDPOINTS.md` — referencia completa de la API REST
- `CHANGELOG.md` — historial de todas las fases
- `01_CONTEXTO_Y_ARQUITECTURA_APP.md` — schema BD, contrato API original, arquitectura
- `ESTADO_ACTUAL.md` — este archivo

---

## 🐛 Deuda técnica conocida

| Problema | Ubicación | Impacto | Solución |
|----------|-----------|--------|----------|
| Caché en memoria | backend/app/services/llm.py | Medium si escala | Migrar a Redis (F5) |
| Rate limit en memoria | backend/app/core/rate_limit.py | Medium si escala | Migrar a Redis (F5) |
| react-native-svg sin usar | frontend/package.json | Bajo (+50KB) | npm uninstall |
| Fotos unsplash de URLs | frontend/src/screens/ | Bajo (RN cachea) | Mover a assets/ |

Ver [[technical_debt]] en memoria para detalles.

---

## 🎯 Restricciones inamovibles

1. **Multi-tenant:** `hogar_id` SIEMPRE del JWT, NUNCA de cabecera cliente
2. **IA pasiva:** IA solo sugiere, usuario siempre confirma
3. **Temperatura LLM = 0:** Reproducibilidad, no creatividad
4. **Pydantic v2:** `extra='forbid'` en todos los schemas
5. **Sin modelos ORM:** Routers retornan schemas, no models

---

## 🔐 Stack & Versiones

| Componente | Versión | Notas |
|-----------|---------|-------|
| React Native | 0.76.9 (SDK 54) | Expo Go compatible |
| NativeWind | v4.1.23 | Tailwind para RN |
| FastAPI | 0.115+ | Python 3.12 |
| SQLAlchemy | 2.0.28+ | async + asyncpg |
| Pydantic | 2.6.0+ | `extra='forbid'` |
| Gemini | 2.5-flash | Configurable en .env |

---

## 📝 Notas últimas sesiones

- **2026-06-11:** Eliminadas funciones falsas (domótica, energía, clima, cámaras). App enfocada en agente personal honesto.
- **2026-06-11:** Implementado `POST /calendar/interpretar` con Gemini real (lenguaje natural → evento propuesto).
- **2026-06-11:** Refactorizado frontend (Dashboard, Pantry, Calendar) sin UI engañosa.
- **2026-06-11:** Creado sistema de memoria del proyecto (MEMORY.md + archivos).

---

## 👤 Contacto & Credenciales

- **Usuario GitHub:** navarroru
- **Email:** navaroruiz2000@gmail.com
- **Próximas cuentas necesarias:** RevenueCat (F4), hosting (F5), App Store + Google Play (F6/F7)
