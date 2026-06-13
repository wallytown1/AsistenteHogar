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
| F-LEGAL | Compliance RGPD/AI Act/stores: purga física, DELETE /auth/cuenta, anonimización LLM, banner IA, SettingsScreen | backend/app/jobs/purge.py, backend/app/services/privacy.py, frontend/src/screens/SettingsScreen.tsx |
| F-AUDIT | Auditoría post-F-LEGAL: 7 bugs corregidos (B1–B7) + alineación de cifras de tests | backend/app/services/calendar.py, frontend/src/screens/CalendarScreen.tsx, frontend/src/hooks/{useTasks,usePantry}.ts |
| F-UI 🎨 | Rediseño visual nativo iOS/Android (rama `redesign/native-ui`, NO en main) | frontend/src/theme/, frontend/src/components/ui/, frontend/src/lib/, las 6 pantallas |

## 🎨 Sesión 2026-06-13 — Rediseño visual nativo (rama `redesign/native-ui`)

Rediseño completo del frontend con un **lenguaje visual nuevo (con color)** para que la app
se sienta nativa en iOS y Android. Hecho en la rama `redesign/native-ui` para poder comparar
contra `main` antes de fusionar. Lógica de negocio preservada al 100%.

**Sistema de diseño nuevo**
- `src/theme/tokens.ts` — fuente única de color, tipografía, espaciado, radios y sombras (por plataforma). Marca índigo `#6366F1` + acentos por módulo (despensa verde, calendario índigo, tareas ámbar).
- `src/components/ui/` — 14 componentes reutilizables: `Screen`, `Card`, `Button`, `IconButton`, `Chip`, `StatCard`, `SectionHeader`, `Fab`, `Badge`, `EmptyState`, `Field`, `AppText`, `Icon`/`FoodIcon`, `LoadingView`/`ErrorView`.
- `src/lib/haptics.ts` — wrapper seguro sobre `expo-haptics`; `src/lib/categoria.ts` — iconos de comida por categoría.

**Mejoras de nativismo**
1. Iconos vectoriales (`@expo/vector-icons`: Ionicons + MaterialCommunityIcons) — **cero emoji** en la UI; tab bar con iconos relleno/contorno.
2. Safe areas reales (`Screen` + `useSafeAreaInsets`) — fin de los `paddingTop` hardcodeados; FAB y tab bar respetan el inset inferior.
3. Sabor de plataforma: ripple Material en Android, `Switch` nativo, sombras iOS vs elevación Android.
4. Feedback háptico en crear/borrar/confirmar/toggles.
5. Tipografía con escala definida.
6. Pull-to-refresh nativo en Dashboard, Despensa, Calendario y Tareas.

**Decisión técnica**: la UI deja de usar NativeWind `className` y pasa a StyleSheet + tokens
(tipado robusto, control fino). NativeWind queda instalado pero sin uso de estilo.

**Dependencia añadida**: `expo-haptics` (vía `expo install`).

**Verificación**: `npm run ts:check` → 0 errores · 0 referencias a `className` en `src/`.
Pendiente: validación visual en dispositivo antes de fusionar a `main`.

## 🐞 Sesión 2026-06-13 — Auditoría y corrección de bugs (B1–B7)

Auditoría completa de código tras F-LEGAL. 7 bugs detectados y corregidos, con tests de regresión donde aplica. Verificación: **111 checks** backend en verde, **0 errores** TS.

**Backend**
- **B1 (MEDIA-ALTA) — PATCH calendario, validación parcial de fechas.** El validador del schema solo comparaba `fecha_inicio`/`fecha_fin` cuando llegaban AMBAS. Un PATCH parcial (solo una fecha) podía dejar `fecha_fin <= fecha_inicio`. Ahora `CalendarService.update_event` fusiona los campos del PATCH con el evento persistido y valida el estado resultante, lanzando `ReglaNegocioError` → **HTTP 422** (nuevo handler en `main.py`). +3 checks en `smoke_test_modules.py`.

**Frontend**
- **B2 (MEDIA) — Calendario mostraba solo el primer evento por hora.** `eventos.find()` → `eventos.filter()`; se renderizan todos los eventos de cada franja (tarjeta extraída a `renderEventoCard`).
- **B3 (MEDIA-BAJA) — Eventos fuera de 07:00–22:00 invisibles.** Nueva sección "Fuera de horario" que lista los eventos cuya hora de inicio cae fuera del eje.
- **B4 (BAJA-MEDIA) — `getDiasParaCaducar` desfase UTC.** `new Date("YYYY-MM-DD")` se interpretaba como medianoche UTC y `setHours` lo corría un día en husos negativos (off-by-one). Ahora se construye la fecha con componentes Y-M-D en hora local.
- **B5 (BAJA) — `useTasks` rollback con stale-closure.** El rollback restauraba un snapshot global del array, pisando cambios optimistas concurrentes. Ahora revierte solo el item afectado mediante updates funcionales.
- **B6 (BAJA) — `numberOfLines` ausente.** Añadido a títulos/descripciones largos en calendario, despensa y tareas para evitar desbordes.
- **B7 (MUY BAJA) — Keys duplicadas de participantes en calendario.** Key compuesta `${evento.id}-${nombre}-${idx}`.

**Limpieza de código muerto (sin cambios de comportamiento)**
- Backend: eliminados `DashboardRepository` (no inyectado en ningún servicio), schemas `HogarCreate`/`HogarUpdate`, excepción `HogarNotFoundError` (nunca lanzada) + su handler, y métodos de servicio sin uso `PantryService.get_item`/`list_items` y `CalendarService.get_event`. Imports huérfanos asociados retirados (`RepositoryError` en pantry, `date`/`typing` sin uso).
- Frontend: eliminado tipo `BriefingData` (sin referencias) y dependencia `react-native-svg` (no importada en `src/`).
- `psycopg2-binary` se **mantiene** deliberadamente: aunque el runtime usa `asyncpg`, se conserva como driver síncrono de respaldo para herramientas/migraciones. Verificación: 111 checks backend + 0 errores TS tras la limpieza.

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

## ⚖️ Sesión 2026-06-12 — Fase F-LEGAL (compliance RGPD / EU AI Act / stores)

Antes de implementar se reescribió `01_CONTEXTO_Y_ARQUITECTURA_APP.md` (v2.x): el
documento describía el contrato antiguo con `{hogar_id}` en las URLs (propenso a
IDOR) y se actualizó al diseño real (tenant del JWT) + la arquitectura de compliance.

**Backend**
- **Purga física programada (RGPD art. 5.1.e):** `purge_expired()` en los repos de
  pantry/tasks/calendar + `PurgeService` en `app/jobs/purge.py`. Borra físicamente
  filas con `is_deleted=true` y `updated_at` > 30 días. Corre cada 24 h desde el
  `lifespan` de FastAPI y manualmente con `python -m app.jobs.purge`.
- **`DELETE /api/v1/auth/cuenta` (RGPD art. 17 + App Store 5.1.1(v) / Google Play):**
  destrucción física del hogar del JWT y todos sus datos vía cascade ORM. Exige
  re-autenticación con contraseña (401 si es errónea, sin borrar). Rate limit 5/h.
- **Tabla `registros_borrado`** (migración `b7d4e9a2c1f8`): auditoría agregada de
  cada supresión — tipo, motivo, recuento, timestamp — sin ningún dato personal.
- **Anonimización LLM (RGPD art. 5.1.c):** `AnonimizadorLLM` en `services/privacy.py`
  sustituye nombres (de `asignado_a`/`participantes`) por `Familiar_N` antes de enviar
  el briefing a Gemini y los restaura en la respuesta. La clave de caché se calcula
  sobre el prompt ya anonimizado y la caché guarda la respuesta anonimizada.
- **Flag `briefing_generado_por_ia`** en el dashboard (el fallback estático no se
  etiqueta como IA). `generate_morning_briefing` devuelve ahora `(texto, flag)`.

**Frontend**
- **`AIDisclaimerBanner`** (EU AI Act art. 50): «Este resumen ha sido generado por IA
  y puede contener imprecisiones.» — en Dashboard (briefing), Pantry (recetas) y en
  el diálogo de confirmación de la propuesta IA del Calendario. Solo aparece si el
  contenido proviene realmente del modelo.
- **`SettingsScreen`** (pestaña Ajustes ⚙️): datos de cuenta, cerrar sesión y zona de
  peligro con eliminación de cuenta — confirmación inline en dos pasos con campo de
  contraseña (sin Alert nativo: funciona también en web).
- **`deleteAccount(password)`** en el authStore: llama al DELETE, limpia estado y
  SecureStore solo si el backend confirma; un 401 muestra error sin cerrar sesión.

**Verificación**: `smoke_test_legal.py` nuevo (**26/26**), suite completa anterior
(12+30+20+20) en verde, `npm run ts:check` → **0 errores**.

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
# Backend — suite completa (111 checks). Requiere JWT_SECRET_KEY en el entorno.
cd backend
python smoke_test_auth.py        # 12/12
python smoke_test_modules.py     # 34/34
python smoke_test_dashboard.py   # 19/19
python smoke_test_validation.py  # 20/20
python smoke_test_legal.py       # 26/26

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
