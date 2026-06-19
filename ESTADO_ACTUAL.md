# ESTADO ACTUAL — AsistenteHogar (2026-06-19)

## ✅ Sesión 2026-06-19 (2ª parte) — Auditoría UI + FlatList + seed recetario

### FlatList virtualization — PantryScreen
- **MOD** `screens/PantryScreen.tsx`: reemplazado `ScrollView` + `.map()` por `FlatList` con `PantryItemCard` como `React.memo`. Off-screen items no montan → rendimiento constante con despensas grandes. `useCallback` para `renderItem` y `toggleSelectProduct` (movidos antes de early returns para cumplir Rules of Hooks).
- Eliminado el componente `Screen` (era un `ScrollView`) como raíz; `FlatList` es ahora el scrollable raíz con `useSafeAreaInsets` manual. `ListHeaderComponent`, `ListEmptyComponent`, `ListFooterComponent` estructuran el contenido.

### Seed del recetario maestro
- **ADD** `backend/seed_recetario.py`: 15 recetas mediterráneas españolas idempotentes en `recetario_maestro` (paella, gazpacho, cocido, tortilla, lentejas, bacalao al pil-pil, fabada, salmorejo…). 9/15 con `aprovechamiento=True`. Activa `_bloque_recetario` en prompts de Gemini en producción.

### Auditoría UI (mobile-app-design — touch targets, tipografía, copy)
- **FIX** `theme/tokens.ts`: variante `micro` 10→11pt (mínimo Apple HIG).
- **FIX** `screens/ShoppingListScreen.tsx`: variante `h1`→`title` + touch targets ≥44pt + `accessibilityLabel`.
- **FIX** `screens/PantryScreen.tsx`: steppers `hitSlop` 6→9pt.
- **FIX** `screens/SettingsScreen.tsx`: copy post-Pivote2 (referencias a Eventos/Tareas eliminadas) + `hitSlop` 8→14pt.
- **FIX** `screens/OnboardingScreen.tsx`: copy actualizado post-Pivote2 + `hitSlop` 8→19pt.
- **FIX** `screens/OnboardingProfileScreen.tsx`: «Ahora no» 36→44pt + `accessibilityLabel`.

### Plan de la semana — nueva pantalla
- **ADD** `screens/PlanComidaScreen.tsx`: pantalla dedicada al plan semanal de aprovechamiento (7 días × comida/cena). FlatList de tarjetas con icono sol/luna, `AIDisclaimerBanner`, estados loading/error/vacío, botón regenerar en header.
- **MOD** `navigation/AppNavigator.tsx`: ruta `PlanComidas` en Stack + import.
- **MOD** `screens/DashboardScreen.tsx`: tarjeta Pressable "Plan de la semana" → navega a `PlanComidas`.

### Tests
- **ADD** `backend/smoke_test_lista_compra.py`: 27/27 checks — CRUD lista de la compra + borrado masivo + aislamiento multi-tenant.

---

## ✅ Sesión 2026-06-19 — Fase 3 + mejoras de producto

### Fase 3 — Perfiles individuales de miembros del hogar (smoke_test_perfiles 20/20)
- **ADD** Migración `a5b3c1d9e7f2`: tabla `perfiles_individuales` con soft delete, FK hogar CASCADE, JSON arrays para preferencias culinarias. Máx. 10 perfiles/hogar.
- **ADD** `PerfilIndividualRepository` con aislamiento multi-tenant en todas las queries.
- **ADD** Router `/api/v1/perfiles`: GET list, POST (201), GET by id, PATCH, DELETE (204).
- **MOD** `services/llm.py`: helper `_bloque_perfiles_individuales()` inyectado en `generate_recipe_suggestions` y `generate_meal_plan`.
- **MOD** `api/routers/pantry.py`: `/recetas`, `/plan-comidas`, `/sugerencias` consultan y pasan perfiles al LLM.
- **MOD** `screens/SettingsScreen.tsx`: tarjeta «Miembros del hogar» con lista + modal añadir/editar. Nota explícita: «no usar para alergias médicas» (RGPD art. 9).
- **RGPD art. 9:** solo se almacenan preferencias culinarias (no alergias/intolerancias médicas).

### Mejora #7 — Umbral de caducidad configurable
- `state/pantrySettingsStore.ts`: Zustand store persistido en SecureStore. Opciones 3/6/10/14 días.
- `lib/caducidad.ts`: `getSemaforoCaducidad(dias, umbral)` acepta umbral configurable.
- `screens/SettingsScreen.tsx`: tarjeta «Despensa» con Chip picker.

### Admin-web (Next.js) — documentación y .gitignore añadidos.

### RecipeDetailScreen (2026-06-18)
- `screens/RecipeDetailScreen.tsx`: pasos numerados, ingredientes con checkmark, footer «Marcar como cocinada» / «No me gusta».

### Foto de nevera UI (2026-06-18)
- FAB `camera-outline` en `PantryScreen` + overlay de escaneo + modal de revisión en lote con `AIDisclaimerBanner`.

---

## 🎯 Pivote 2 (2026-06-18) — App exclusivamente de comida, stock y recetas

La app es **exclusivamente comida, stock y recetas mediterráneas españolas**. Los módulos de
Eventos (calendario) y Tareas (domésticas) fueron **eliminados por completo** del backend,
frontend y base de datos. Ver `ARCHITECTURE_MAP.md`.

- **Función única:** recetas y stock real de la despensa (sofritos, ingredientes frescos, temporada).
- **Tres métodos de entrada de fricción cero:** OCR de ticket ✅, audio NL ✅, foto de nevera ✅ (backend).
- **Onboarding:** perfil de gustos culinarios + nº comensales ✅. Intolerancias/alergias (RGPD art. 9) ⏳.
- **Rama activa:** `feat/pivote-recetas-mediterraneas`

---

## 🛡️ Sesión 2026-06-16 — F-QA2: Auditoría y blindaje pre-producción (en curso)

Nueva fase **antes de F6** para auditar seguridad/calidad antes del build de producción.
Plan reajustado tras revisión crítica: se descartó SonarCloud (redundante con el escudo
Ruff+Mypy+ESLint ya existente) y Maestro E2E (prematuro/frágil sobre UI que aún cambiará);
se añadió secret-scanning (gitleaks) y CI en remoto como prioridades. Trabajo directo en `main`.

**Bloque 1+2 — Dependencias y secretos (completado)**
- `pip-audit`: solo `pip` vulnerable (no deps de la app). `npm audit`: 19 moderate en
  toolchain Expo/RN (build, no runtime) — aceptadas hasta migrar a SDK 56.
- `gitleaks` sobre 55 commits: 12 falsos positivos (passwords de prueba en smoke tests).
  **0 secretos reales en el historial.** Añadido `.gitleaks.toml` con allowlist.

**Bloque 3 — CI GitHub Actions (completado)**
- `.github/workflows/ci.yml`: 3 jobs paralelos (backend lint+types+smoke, frontend tsc+eslint,
  security deps+gitleaks) en cada push/PR a `main`. Valida en remoto, no solo en pre-commit local.

**Bloque 4 — Schemathesis (completado)**
- Step añadido en el job `backend` del CI, tras los smoke tests. Modo ASGI (sin servidor real):
  `schemathesis run --app=app.main:app http://localhost/openapi.json --checks=not_a_server_error`.
  25 ejemplos por endpoint, 2 workers. Cualquier 5xx falla la build.

**Pendiente de F-QA2:**
- Bloque 5 — Revisión de seguridad enfocada → `SECURITY.md` (multi-tenant, auth, LLM, secretos).
- Bloque 6 — OWASP ZAP (una pasada contra Railway, baja prioridad).
- Diferidos a post-lanzamiento: SonarCloud, Maestro E2E, Langfuse.

---

## 🔧 Sesión 2026-06-16 (noche tardía) — Bloque de pulido #4–#8

Trabajo en rama `feat/mejoras-servicio`.

**Mejora #4 — OCR ticket: FAB dedicado + revisión en lote** (`frontend/src/screens/PantryScreen.tsx`)
- Segundo FAB `receipt-outline` en la pantalla principal de Despensa (no dentro del modal).
- Modal de revisión en lote: lista de productos detectados con checkboxes individuales + "Añadir seleccionados".
- Estados nuevos: `ocrScanning`, `ocrReviewVisible`, `ocrReviewItems`, `ocrAdding`.
- Timeout: 90 s para el endpoint de visión (ahora `TIMEOUT.OCR_FULL`).

**Mejora #5 — Endpoint `/pantry/sugerencias` unificado** (`backend/app/api/routers/pantry.py`)
- Nuevo endpoint `GET /pantry/sugerencias` que lanza `generate_recipe_suggestions` y `generate_meal_plan`
  en paralelo con `asyncio.gather()`, reutilizando las cachés individuales de cada función.
- Schema `SugerenciasResponse` añadido a `schemas.py` y `types.ts`.
- `PantryScreen` prefetcha en background al montar si `isPremium && items.length > 0` (ref guard).

**Mejora #6 — Duración del solapamiento en Calendario** (`frontend/src/screens/CalendarScreen.tsx`)
- Cada card de conflicto ahora muestra "Solapamiento: X min" bajo los títulos de los eventos.
- Usa `conf.duracion_solapamiento_segundos / 60` redondeado; el campo ya existía en `ConflictoDetalle`.

**Mejora #7 — Descartada** (falso positivo)
- `generate_recipe_suggestions()` y `generate_meal_plan()` solo reciben nombres de alimentos,
  nunca `asignado_a`/`participantes`. No hay nombres personales que anonimizar.

**Mejora #8 — Timeouts consistentes** (`frontend/src/api/api.ts` + 4 consumidores)
- Exportada constante `TIMEOUT = { DEFAULT: 15_000, AI: 45_000, OCR: 60_000, OCR_FULL: 90_000 }`.
- Sustituidos todos los valores literales en `useDashboard`, `usePantry`, `PantryScreen`, `TasksScreen`.
- El fallback interno de `apiRequest` ahora usa `TIMEOUT.DEFAULT` en lugar de `15000`.

---

## 🔧 Sesión 2026-06-16 (noche) — Mejoras de servicio #2 y #3

Trabajo en rama `feat/mejoras-servicio`.

**Mejora #2 — `ultimo_completado` visible en tareas** (`frontend/src/screens/TasksScreen.tsx`)
- Badge "Última vez hace X días / Completada hoy" en cada card de tarea.
- Texto de próxima ejecución para pendientes: "próxima en N días / toca hoy / vencida hace N días"
  (urgente en naranja). Calculado de `ultimo_completado + frecuencia` (diaria=1d, semanal=7d, mensual=30d).
- Lista reordenada por urgencia: nunca completadas primero, vencidas, toca hoy, próximas, ocasionales al final.
  En vista "todas": pendientes antes que completadas; completadas por recencia.
- Solo frontend; los datos `ultimo_completado` y `frecuencia` ya existían en la API.

**Mejora #3 — Gate premium consistente en endpoints IA** (`backend/app/api/routers/calendar.py`)
- Política adoptada: **todos los endpoints de IA son premium** (6/6 consistente).
- `/calendar/interpretar` era el único sin `requiere_premium`. Añadida la dependencia.
- Smoke tests: 12/12 + 43/43 + 22/22 en verde tras el cambio.

**Documentación:** `AGENTS.md` en `main` actualizado a Git Flow con ramas feature/hotfix/release.

---

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
| F-IA-2 | Optimización del flujo Gemini + 4 funciones de IA nuevas (tareas/despensa NL, metadata, plan de comidas) | backend/app/services/llm.py, backend/app/api/routers/{tasks,pantry}.py, backend/app/core/rate_limit.py |
| F-UI 🎨 | Rediseño visual nativo iOS/Android | frontend/src/theme/, frontend/src/components/ui/, frontend/src/lib/, las 6 pantallas |
| F5 | Migración a Redis (caché y rate limit distribuidos) | backend/app/core/redis_client.py, backend/app/core/rate_limit.py, backend/app/services/llm.py |
| F4 | Freemium: RevenueCat IAP + Paywall + gate server-side | frontend/src/state/purchasesStore.ts, frontend/src/screens/PaywallScreen.tsx, backend/app/services/premium.py |
| F-AUDIT2 | Hardening post-F4/F5: gate premium server-side, DATABASE_URL Railway, resiliencia Redis, migraciones en arranque | backend/app/{database,main,core/redis_client,services/premium}.py |
| F-OCR | OCR de tickets con Gemini Vision (premium) | backend/app/services/llm.py, backend/app/api/routers/pantry.py, frontend/src/screens/PantryScreen.tsx |
| F-AGENDA | AgendaScreen: Tareas + Calendario unificados en una tab | frontend/src/screens/AgendaScreen.tsx, frontend/src/navigation/AppNavigator.tsx |

## 🔧 Sesión 2026-06-16 (tarde) — Auditoría de servicios + fixes + workflow de ramas

**Workflow de ramas cambiado:** eliminadas las ramas `claude` y `gemini` (por agente).
Adoptado flujo por feature/fix (`feat/<x>`, `fix/<x>`). Ver `AGENTS.md`.

**Ramas publicadas:**
- `fix/api-timeout` — regresión timeout: `AbortController.abort()` lanzaba `AbortError`
  (igual que cancelación por desmontaje), timeouts silenciosos. Corregido con flag `didTimeout`
  que convierte el abort del timer en `TimeoutError`, activando el mensaje de red en los 4 hooks.
- `feat/mejoras-servicio` — mejora #1 de la auditoría de servicios: conflictos de agenda
  incluidos en el prompt de Gemini y en el fallback del briefing.

**Auditoría de servicios (resultado):** ver `MEJORAS_PENDIENTES.md` para el backlog
priorizado con esfuerzo estimado. Mejoras pendientes: `ultimo_completado` en tareas,
gate premium consistente, OCR en lote, plan/recetas unificados.

**Documentación actualizada:** `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `ENDPOINTS.md`,
`ESTADO_ACTUAL.md` (este archivo), `MEJORAS_PENDIENTES.md` (nuevo).

---

## 🔍 Sesión 2026-06-16 — Auditoría post-F4/F5 (hardening) + verificación Railway

Auditoría de los cambios de F4 (freemium) y F5 (Redis/Railway). Trabajo en la rama
`fix/auditoria-f4-f5` (**pendiente de merge a main**).

**Corregido (commit `447248f`)**
- 🔴 **Freemium server-side:** el gate de la UI era evitable llamando a la API. Nueva
  dependencia `requiere_premium` (`backend/app/services/premium.py` + `deps.py`) que
  valida el entitlement contra la API REST de RevenueCat (cache Redis 5 min, fail-open)
  en los 5 endpoints de IA. Desactivada sin `REVENUECAT_SECRET_KEY` (dev/tests intactos).
- 🔴 **DATABASE_URL Railway:** `database.py` reescribe `postgres://`/`postgresql://` a
  `+asyncpg` para aceptar la variable inyectada.
- 🟡 **Procfile** (Nixpacks): `alembic upgrade head` + uvicorn a `0.0.0.0:$PORT`.
- 🟡 **Redis:** reconexión perezosa con cooldown + `socket_timeout` 5 s → 2 s.
- 🟡 **Rate-limit:** miembro del sorted set con `uuid4` (evita colisión/subconteo).
- 🟡 **Frontend:** cleanup del listener RevenueCat, selectores Zustand, loaders por
  paquete en el Paywall; `.gitignore` + `.env.example`; envs desindexados.
- **Verificación:** 120/120 smoke tests, 0 errores TS, Ruff + Mypy strict OK.

**Despliegue en Railway (CLI) — verificado y desplegado**
- Servicio `AsistenteHogar` (proyecto `nurturing-tranquility`) **Online**, `/health` → 200 (~0,4 s).
- **Merge a `main` (`10c2bd5`) desplegado:** logs confirman `alembic upgrade` OK, Redis
  conectado y `Uvicorn running on 0.0.0.0:8080` (Procfile activo). Hardening en vivo.
- **`ENVIRONMENT=production` aplicado:** `/docs` y `/openapi.json` ahora devuelven 404.
- ⏳ **Modo prueba:** `GEMINI_API_KEY` se usará una **personal con datos ficticios**; cambiar
  a clave con *billing* antes de datos reales (RGPD). `REVENUECAT_SECRET_KEY` aún sin definir
  → gate premium desactivado hasta cobrar.
- 📋 **Checklist completo de paso a producción:** ver [`PRODUCCION_CHECKLIST.md`](PRODUCCION_CHECKLIST.md).

## ⚡ Sesión 2026-06-16 — Migración a Redis (F5) e Infraestructura

Se adelantó la Fase F5 para hacer el backend "Stateless" y prepararlo para producción de forma escalable (multi-worker / multi-instancia):
- **Redis Asíncrono:** Añadido `redis_client.py` con pool de conexiones en lifespan de FastAPI. Resiliencia integrada (modo degradado/mock si Redis no está disponible).
- **Rate-limiting Distribuido:** Migrado `app/core/rate_limit.py` a Redis usando una ventana deslizante basada en Sorted Sets (ZADD, ZREMRANGEBYSCORE, ZCARD).
- **Caché de LLM Distribuido:** Migrado `app/services/llm.py` a Redis con expiración automática TTL (SETEX).
- **Verificación:** Ejecución de 122/122 smoke tests y corrección de lints de ruff/mypy (instalados types-redis para tipado robusto).

## 🔀 Sesión 2026-06-15 — Integración de ramas + tooling + rescate de features

Fusión de las dos ramas de trabajo (`chore/backend-typing-shield` = tipado/IA/escudo, `redesign/native-ui` = UI nativa) en la rama `integracion/merge-all` (**futuro `main`**). Único conflicto: una tabla en este archivo (resuelto conservando ambas secciones).

- **Verificación post-merge:** backend **122 smoke checks** verde, frontend **0 errores TS** (solo hubo que `npm install` por `expo-haptics`, ya en el lockfile).
- **graphify activado:** knowledge graph del código (`uv tool install graphifyy`, skill project-scoped en `.claude/`, hooks PreToolUse). `graphify-out/` gitignorado → regenerar con `graphify update .` (AST local, sin coste). Ver [[tooling_dev]] en memoria.
- **Rescate de 2 features huérfanas** (eran archivos untracked solo en el PC viejo; el rediseño se construyó sin verlos):
  - `useExpiryNotifications.ts` — notificaciones locales de caducidad (≤3 días, aviso 9:00). Dep `expo-notifications` añadida; cableado en `PantryScreen`.
  - `OnboardingScreen.tsx` — **reescrito al nuevo sistema de diseño** (tokens + iconos vectoriales, sin emoji ni paleta vieja); gate `hasSeenOnboarding` recableado en `AppNavigator`.
- **Pendiente del usuario:** `uv run pre-commit install` (escudo backend, hoy bloquea commits) · plugin `expo-notifications` en `app.json` antes del build de producción (F6) · descartar `stash@{0}` (sus únicos archivos únicos ya están rescatados).

## 🤖 Sesión 2026-06-15 — Optimización de IA + nuevas funciones (backend)

Trabajo de IA en `main` (backend). Lógica de negocio intacta, IA pasiva en todo (propone, el usuario confirma).

**Optimización del flujo Gemini**
- Cliente `httpx.AsyncClient` **compartido** (pool keep-alive), cerrado en el lifespan (`aclose_http_client`). Adiós al cliente nuevo por llamada.
- **Reintento con backoff** ante 429/5xx/red; `_extract_text` distingue bloqueo de seguridad, sin candidatos y `MAX_TOKENS`.
- **Rate-limit** de endpoints de IA: `/{calendar,tasks,pantry}/interpretar` 20/5 min (compartido), `/recetas` 20/h, `/sugerir-metadata` 40/5 min, `/plan-comidas` 10/h.
- Smoke tests **herméticos** (fuerzan `GEMINI_API_KEY=""`) + test del rate-limit.

**4 funciones de IA nuevas** (reutilizan `_call_gemini` + structured output)
- `POST /tasks/interpretar` — tarea en lenguaje natural ("poner la lavadora cada martes" → propuesta).
- `POST /pantry/interpretar` — despensa en lenguaje natural, **multi-item**, resuelve caducidades relativas.
- `POST /pantry/sugerir-metadata` — categoría + caducidad estimada de un alimento por su nombre.
- `GET /pantry/plan-comidas` — plan semanal (comida + cena, 7 días) priorizando lo que caduca. Cacheado 2 h.

**Compliance**: los 6 requisitos de `LEGALIDAD.md` siguen cumplidos. Añadido requisito de **tier de Gemini con billing** (no entrenar con los prompts) y tabla de flujos de datos por endpoint en `LEGALIDAD.md`.

**Verificación**: 122 smoke checks (modules 34→43, validation 20→22) + las 4 funciones probadas con Gemini real. **Pendiente**: cableado de UI de las nuevas funciones (irá en la rama del rediseño).

## 🎨 Sesión 2026-06-13 — Rediseño visual nativo

Rediseño completo del frontend con un **lenguaje visual nuevo (con color)** para que la app
se sienta nativa en iOS y Android. Lógica de negocio preservada al 100%.

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

**Verificación**: `npm run ts:check` → 0 errores · 0 referencias a `className` en `src/` ·
`expo export` (bundle Metro) OK sin errores de imports/runtime.

**Revisión post-rediseño (5 correcciones aplicadas)**
1. **FAB demasiado alto** — `Fab` sumaba `insets.bottom + 78`, pero el área de la pantalla ya excluye la tab bar y su safe-area; ahora flota a `bottom: 20` justo sobre la barra.
2. **Flash de loader en pull-to-refresh** — las 4 pantallas con datos hacían `if (isLoading) return <LoadingView/>`; ahora el loader completo solo aparece en la carga inicial (sin datos) y los refrescos usan el spinner nativo.
3. **Botones en `loading` se veían grises** — `Button` aplicaba aspecto deshabilitado durante la carga; ahora mantiene su color con spinner del color correcto (`busy` accesible).
4. **Imports/variables sin usar** — retirados (`Badge` en Pantry, `tasksLoading` en Dashboard); `tsc --noUnusedLocals` limpio en el código nuevo.
5. **Modal de Tareas sin `maxHeight`** — añadido `88%` para evitar corte con el teclado en pantallas pequeñas (igual que Despensa/Calendario).

Pendiente: validación visual en dispositivo real.

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

## 🚀 Fase actual: F4 — Freemium (✅ Completada)

**Descripción:** Integración RevenueCat (IAP iOS/Android) + Paywall + Límites premium en frontend.

- [x] Configuración de RevenueCat en frontend (`react-native-purchases`).
- [x] Lógica de estado `purchasesStore` (Zustand).
- [x] Diseño y enrutamiento de la `PaywallScreen`.
- [x] Bloqueo de funciones de IA (Sugerir metadatos, Plan de comidas, Tareas NL) hasta tener suscripción.

---

## 📊 Qué hace la app ahora

### Despensa ★ (función principal)
- Inventario real con stock, categoría, caducidad
- **Recetas sugeridas por IA** (mediterráneas españolas, priorizan lo que caduca)
- **Plan de comidas semanal** (comida + cena, 7 días) por IA
- **Perfiles individuales**: preferencias culinarias por miembro del hogar influyen en las recetas
- **Pantalla de detalle de receta** con pasos numerados e ingredientes con checkmark
- OCR de ticket de compra con Gemini Vision (revisión en lote con checkboxes)
- Añadir por lenguaje natural ("compré 6 huevos y leche que caduca el viernes")
- Añadir por audio NL (FAB micrófono, dictado nativo)
- Foto de nevera: Gemini Vision detecta ingredientes (FAB cámara + modal revisión)
- Historial de recetas cocinadas/rechazadas → mejora las sugerencias futuras
- Umbral de caducidad configurable (3/6/10/14 días) en Ajustes
- Filtros por categoría y stock bajo
- Alertas de caducidad (notificaciones locales ≤3 días)

### Dashboard
- Briefing diario generado por Gemini (o fallback estático sin API key)
- Alertas de alimentos próximos a caducar

### Autenticación
- Registro/login con JWT (30 días)
- Token en SecureStore (cifrado nativo)
- Aislamiento multi-tenant garantizado

### Eliminados en Pivote 2
- ~~Calendario~~ (agenda familiar, conflictos de horario, quick-add NL)
- ~~Tareas~~ (lista doméstica con prioridad, frecuencia, `ultimo_completado`)

---

## 🔧 Verificación mínima antes de cambios

```bash
# Backend — suite completa. Requiere JWT_SECRET_KEY en el entorno.
cd backend
python smoke_test_auth.py        # 12/12
python smoke_test_modules.py     # must pass
python smoke_test_dashboard.py   # must pass
python smoke_test_validation.py  # must pass
python smoke_test_legal.py       # must pass
python smoke_test_perfiles.py        # 20/20
python smoke_test_lista_compra.py    # 27/27

# Frontend
cd frontend
npm run ts:check  # Debe retornar 0 errores
```

---

## 📁 Archivos críticos

### Backend
- `backend/.env` — JWT_SECRET_KEY, GEMINI_API_KEY, DATABASE_URL, ENVIRONMENT
- `backend/app/main.py` — punto de entrada FastAPI
- `backend/app/services/llm.py` — Gemini (briefing, recetas, audio, foto-nevera, interpretar)
- `backend/app/api/routers/` — endpoints: auth, dashboard, pantry, onboarding, historial, perfiles
- `backend/app/repositories/perfiles_individual.py` — CRUD perfiles con límite 10/hogar
- `backend/alembic/versions/` — migraciones SQL
- `backend/smoke_test_*.py` — suite de pruebas de humo (incluye smoke_test_perfiles.py 20/20)

### Frontend
- `frontend/src/screens/` — DashboardScreen, PantryScreen, SettingsScreen (UI principal)
- `frontend/src/state/authStore.ts` — Zustand (token, usuario, hogar)
- `frontend/src/api/api.ts` — cliente HTTP con Bearer token

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
| `GEMINI_API_KEY` personal (datos de prueba) | panel Railway | Medio: cambiar a clave con billing antes de datos reales (RGPD) | Ver [`PRODUCCION_CHECKLIST.md`](PRODUCCION_CHECKLIST.md) §1 |
| `REVENUECAT_SECRET_KEY` sin definir | panel Railway | Medio: gate premium desactivado en prod | Ver `PRODUCCION_CHECKLIST.md` §2 |
| Migración `drop_eventos_tareas` pendiente en Railway | panel Railway / Alembic | Bajo (tablas vacías, no rompe nada) | `alembic upgrade head` en próximo deploy |

Ver [[technical_debt]] en memoria para detalles.

---

## 🎯 Restricciones inamovibles

1. **Multi-tenant:** `hogar_id` SIEMPRE del JWT, NUNCA de cabecera cliente
2. **IA y escrituras:** confirmación explícita para acciones destructivas; se permiten escrituras de bajo riesgo reversibles con undo visible
3. **Temperatura LLM = 0:** Reproducibilidad, no creatividad
4. **Pydantic v2:** `extra='forbid'` en todos los schemas
5. **Sin modelos ORM:** Routers retornan schemas, no models

---

## 🔐 Stack & Versiones

| Componente | Versión | Notas |
|-----------|---------|-------|
| React Native | 0.76.9 (SDK 54) | Expo Go compatible |
| NativeWind | — | Eliminado (StyleSheet + tokens) |
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
