# CHANGELOG — Asistente del Hogar IA

Formato: `[FECHA] [ÁREA] [TIPO] Descripción`
- **Tipos:** `ADD` (nuevo), `FIX` (corrección), `MOD` (modificación), `CFG` (configuración)
- **Historial anterior:** ver [`CHANGELOG_ARCHIVE.md`](CHANGELOG_ARCHIVE.md) para entradas pre-2026-06-11

---

## [2026-06-16] — PR #5: Bloque de mejoras de servicio #1–#8 (mergeado a main)

### Mejora #1 — Conflictos de agenda en el briefing matutino
- **MOD** `backend/app/services/llm.py` — `generate_morning_briefing()` incluye
  `conflictos_agenda` en el prompt de Gemini (título, hora y minutos de solapamiento).
  `generate_fallback_briefing()` añade sección ⚠️ con detalle de solapamiento.
  Los participantes de eventos en conflicto se anonimizan igual que el resto (RGPD).

### Mejora #2 — `ultimo_completado` visible en tareas con urgencia
- **MOD** `frontend/src/screens/TasksScreen.tsx` — badge "Última vez hace X días / Completada hoy"
  en cada card de tarea pendiente. Texto de próxima ejecución calculado de
  `ultimo_completado + frecuencia` (diaria=1d, semanal=7d, mensual=30d); urgente en naranja.
  Lista reordenada por urgencia: nunca completadas → vencidas → toca hoy → próximas → ocasionales.
  En vista "todas": pendientes primero, completadas por recencia.

### Mejora #3 — Gate premium consistente en todos los endpoints de IA
- **MOD** `backend/app/api/routers/calendar.py` — añadido `Depends(requiere_premium)` a
  `POST /calendar/interpretar`. Los 6 endpoints de IA quedan uniformemente protegidos.

### Mejora #4 — OCR de ticket: FAB dedicado y revisión en lote
- **MOD** `frontend/src/screens/PantryScreen.tsx` — segundo FAB `receipt-outline` en la
  pantalla principal de Despensa (no enterrado en el modal). Modal de revisión en lote con
  checkboxes por producto y botón "Añadir seleccionados". Estados nuevos: `ocrScanning`,
  `ocrReviewVisible`, `ocrReviewItems`, `ocrAdding`. Timeout 90 s (ahora `TIMEOUT.OCR_FULL`).

### Mejora #5 — Endpoint `/pantry/sugerencias` unificado con precarga en background
- **ADD** `backend/app/api/routers/pantry.py` — `GET /pantry/sugerencias`: lanza
  `generate_recipe_suggestions` y `generate_meal_plan` en paralelo con `asyncio.gather()`,
  reutilizando las cachés individuales de cada función LLM. Hereda ambos rate-limiters.
- **ADD** `backend/app/schemas/schemas.py` — `SugerenciasResponse { recetas, plan_comidas }`.
- **ADD** `frontend/src/types/types.ts` — interfaz `SugerenciasResponse`.
- **MOD** `frontend/src/screens/PantryScreen.tsx` — prefetch en background al montar si
  `isPremium && items.length > 0` (ref guard `autoFetchedRef` para evitar doble disparo).

### Mejora #6 — Duración del solapamiento visible en Calendario
- **MOD** `frontend/src/screens/CalendarScreen.tsx` — cada card de conflicto muestra
  "Solapamiento: X min" bajo los títulos de los eventos, usando
  `conf.duracion_solapamiento_segundos` (campo ya existente en `ConflictoDetalle`).

### Mejora #7 — Descartada (falso positivo)
- `generate_recipe_suggestions()` y `generate_meal_plan()` solo reciben nombres de alimentos
  (`InventarioAlimentoResponse`), nunca `asignado_a` ni `participantes`. No hay datos
  personales que anonimizar en esas rutas. Sin cambios de código.

### Mejora #8 — Timeouts tipados y consistentes
- **MOD** `frontend/src/api/api.ts` — exportada constante
  `TIMEOUT = { DEFAULT: 15_000, AI: 45_000, OCR: 60_000, OCR_FULL: 90_000 }`.
  El fallback interno de `apiRequest` usa `TIMEOUT.DEFAULT` en lugar del literal `15000`.
- **MOD** `frontend/src/hooks/useDashboard.ts` — `timeoutMs: TIMEOUT.AI`.
- **MOD** `frontend/src/hooks/usePantry.ts` — `timeoutMs: TIMEOUT.OCR`.
- **MOD** `frontend/src/screens/PantryScreen.tsx` — `TIMEOUT.AI` (sugerencias), `TIMEOUT.OCR_FULL` (OCR).
- **MOD** `frontend/src/screens/TasksScreen.tsx` — `timeoutMs: TIMEOUT.AI`.

---

## [2026-06-16] — Mejoras de servicio + fixes (sesión anterior, detalle)

### feat/mejoras-servicio — Mejora #1: conflictos de agenda en el briefing
- **MOD** `backend/app/services/llm.py` — `generate_morning_briefing()` ahora incluye
  `conflictos_agenda` en el prompt de Gemini (título, hora y minutos de solapamiento).
  Los participantes de los eventos en conflicto se anonomizan igual que el resto (RGPD).
  `generate_fallback_briefing()` añade sección ⚠️ con detalle de solapamiento.
  El system_instruction actualizado pide a Gemini que avise de conflictos con tono natural.

### fix/api-timeout — Regresión timeout en `apiRequest`
- **FIX** `frontend/src/api/api.ts` — el refactor de OCR cambió `AbortSignal.timeout()`
  (lanza `TimeoutError`) a `AbortController + setTimeout` (lanza `AbortError`, igual que
  cancelación intencional). Los 4 hooks capturaban `AbortError` primero y hacían `return`
  silencioso → timeouts invisibles para el usuario. Solución: flag `didTimeout` que
  convierte el abort del timer en `TimeoutError`, activando el mensaje de red en los hooks.

### Mejoras de servicio pendientes (rama feat/mejoras-servicio)
Ver `MEJORAS_PENDIENTES.md` para el backlog completo con estimaciones de esfuerzo.

---

## [2026-06-16] — OCR de tickets de compra + AgendaScreen + Rediseño Dashboard

### OCR de tickets (commit `ffaf19b`)
- **ADD** `backend/app/services/llm.py` — `process_receipt_ocr()`: multimodal Gemini Vision
  (imagen base64 inline), reutiliza `_DESPENSA_RESPONSE_SCHEMA`, timeout 30 s.
- **ADD** `backend/app/api/routers/pantry.py` — `POST /pantry/ocr-ticket` (premium + rate-limit).
- **ADD** `backend/app/schemas/schemas.py` — `TicketOcrRequest` / `TicketOcrResponse`.
- **MOD** `frontend/src/hooks/usePantry.ts` — `escanearTicketOcr()` con timeout 60 s.
- **MOD** `frontend/src/screens/PantryScreen.tsx` — flujo OCR: permiso cámara → Alert
  Cámara/Galería → `ImagePicker` → procesado → modo IA con resultados pre-cargados.
- **ADD** `frontend/package.json` — `expo-image-picker ~17.0.11`.
- **MOD** `frontend/babel.config.js` — eliminado `jsxImportSource: 'nativewind'` (limpieza).
- **ADD** `frontend/.gitignore`, `frontend/.env.example`.

### AgendaScreen — Tareas + Calendario unificados (commit `9148dfc`, Gemini)
- **ADD** `frontend/src/screens/AgendaScreen.tsx` — nueva pantalla que combina Tareas y
  Calendario en pestañas internas (`ScrollView` horizontal con `Chip` selector).
- **MOD** `frontend/src/navigation/AppNavigator.tsx` — sustituye las tabs separadas
  "Calendario" y "Tareas" por una única tab "Agenda" con `AgendaScreen`.

### Rediseño del briefing matutino (commit `ff0fa15`, Gemini)
- **MOD** `backend/app/services/llm.py` — system_instruction del briefing reescrita: tono
  de mayordomo elegante y cercano, 3 párrafos conversacionales sin Markdown, sin listas.
- **MOD** `frontend/src/screens/DashboardScreen.tsx` — ajustes de layout del card de briefing.

---

## [2026-06-16] — F-AUDIT2: Hardening post-F4/F5 (freemium server-side + Railway)

### Decisiones clave
- **Freemium aplicado en el servidor, no solo en la UI.** El gate `checkPremiumGate`
  del frontend era trivialmente evitable llamando a la API directamente. Nueva
  dependencia `requiere_premium` que valida el entitlement contra la API REST de
  RevenueCat (cache Redis 5 min, **fail-open** ante caídas del proveedor) en los
  5 endpoints de IA. Desactivada si no hay `REVENUECAT_SECRET_KEY` (dev/tests).
- **Compatibilidad con la `DATABASE_URL` inyectada por Railway.** Reescritura de
  `postgres://`/`postgresql://` → `postgresql+asyncpg://` para el engine async.
- **Resiliencia Redis.** Reconexión perezosa con cooldown (sobrevive a que el
  backend arranque antes que Redis) y `socket_timeout` 5 s → 2 s.
- **Procfile** para Nixpacks: `alembic upgrade head` + bind a `0.0.0.0:$PORT`.
- **Rate-limit:** miembro del sorted set con `uuid4` (evita colisión/subconteo).
- **Frontend:** desuscripción del listener de RevenueCat, selectores Zustand
  (menos re-renders) y loaders independientes por paquete en el Paywall.
- **Higiene:** `frontend/.gitignore` + `.env.example`; `.env.{development,production}`
  desindexados de git.

### Archivos
- `ADD` backend/app/services/premium.py — verificación de suscripción (RevenueCat REST + cache Redis).
- `ADD` backend/Procfile — release con migraciones + uvicorn a $PORT.
- `MOD` backend/app/api/deps.py — dependencia `requiere_premium`.
- `MOD` backend/app/api/routers/{pantry,tasks}.py — gate en los 5 endpoints de IA.
- `MOD` backend/app/database.py — rewrite del driver de DATABASE_URL.
- `MOD` backend/app/core/redis_client.py — reconexión perezosa + timeouts.
- `MOD` backend/app/core/rate_limit.py — miembro único (uuid4).
- `MOD` backend/app/core/config.py — REVENUECAT_SECRET_KEY / REVENUECAT_ENTITLEMENT.
- `MOD` backend/.env.example — documentadas las nuevas variables.
- `MOD` frontend/src/state/purchasesStore.ts — cleanup del listener.
- `MOD` frontend/src/navigation/AppNavigator.tsx, frontend/src/screens/{Pantry,Tasks,Paywall}Screen.tsx — selectores + loaders por paquete.
- `ADD` frontend/.gitignore, frontend/.env.example.

### Verificación: 120/120 smoke tests; 0 errores TypeScript; Ruff + Ruff-format + Mypy strict OK.
### Rama: `fix/auditoria-f4-f5` (pendiente de merge a main).

---

## [2026-06-16] — FASE F4: Freemium y RevenueCat

### Decisiones clave
- **RevenueCat SDK**: Se implementó `react-native-purchases` en el frontend para gestionar IAP (In-App Purchases) de Apple y Google.
- **Paywall Inteligente**: Se creó `PaywallScreen.tsx` (como Modal fullScreen nativo sobre las pestañas) que levanta de forma remota los paquetes configurados (Offerings) desde el panel de RevenueCat.
- **Restricción de IA**: La inteligencia artificial se ha agrupado como función "Pro". Si el estado local `isPremium` es falso, funciones como "Sugerir con IA" o "Plan de Comidas" se bloquean e invocan automáticamente el Paywall.

### Archivos
- `ADD` frontend/src/screens/PaywallScreen.tsx — interfaz del Paywall nativo.
- `ADD` frontend/src/state/purchasesStore.ts — estado Zustand para Purchases (init, login, checkPremium).
- `MOD` frontend/src/navigation/AppNavigator.tsx — envoltura de Tabs en un RootStack; inyección del modal Paywall y `configure()` de RevenueCat.
- `MOD` frontend/src/screens/PantryScreen.tsx — inyección del Paywall `checkPremiumGate` para limitar IA.
- `MOD` frontend/src/screens/TasksScreen.tsx — inyección del Paywall para limitar interpretación de IA.
- `MOD` backend/.env — Se retiró la variable pública `REVENUE_CAT` (pertenece al frontend).
- `MOD` frontend/.env.development / frontend/.env.production — Se añadió `EXPO_PUBLIC_RC_KEY`.

### Verificación: 0 errores de TypeScript en frontend; Paywall modal comprobado nativamente.

---

## [2026-06-16] — FASE F5: Migración a Redis y Despliegue en la Nube (Railway)

### Decisiones clave
- **Despliegue en Railway**: Se aprovisionó el backend en Railway usando NIXPACKS, con bases de datos PostgreSQL y Redis conectadas y variables de entorno (`JWT_SECRET_KEY`, `DATABASE_URL` asíncrona) configuradas automáticamente. El frontend apunta ahora a `https://asistentehogar-production.up.railway.app`.
- La caché TTL de IA y el rate-limit operaban en memoria (diccionarios Python). Con múltiples
  workers o réplicas, cada proceso tenía su propio estado → límites de IA ineficaces y caché
  duplicada. Migrado a **Redis** con fallback automático en memoria si Redis no está disponible
  (la app nunca se rompe por falta de Redis).
- **Rate-limit:** ventana deslizante con sorted sets de Redis (ZRANGEBYSCORE + pipeline atómico).
  Si Redis cae, degrada transparentemente al deque en memoria original.
- **Caché LLM:** `SETEX` con TTL nativo de Redis. Serialización JSON con soporte para modelos
  Pydantic (`model_dump(mode="json")`). Los TTL se mantienen: briefing 30 min, recetas 1 h,
  plan de comidas 2 h.
- **Conexión:** pool asíncrono (`redis.asyncio`) inicializado en el `lifespan` de FastAPI y
  cerrado en el shutdown. Verificación de conectividad con `PING` al arrancar.
- Docker Compose actualizado con Redis 7 Alpine (AOF, 128 MB, LRU eviction).

### Archivos
- `ADD` backend/app/core/redis_client.py — pool async, init/close, get_redis().
- `MOD` backend/app/core/rate_limit.py — estrategia dual Redis/memoria.
- `MOD` backend/app/services/llm.py — caché dual Redis/memoria (funciones ahora async).
- `MOD` backend/app/main.py — init_redis()/close_redis() en lifespan.
- `MOD` backend/app/core/config.py — nueva variable REDIS_URL.
- `MOD` backend/docker-compose.yml — servicio Redis 7 Alpine.
- `MOD` backend/.env.example — documentada REDIS_URL.
- `MOD` backend/requirements.txt — redis[hiredis]>=5.0.0.
- `CFG` .pre-commit-config.yaml — types-redis>=4.6 para mypy.

### Verificación: 122/122 smoke tests en verde (modo degradado sin Redis); ruff + mypy + ruff-format OK; 0 errores TypeScript frontend.

---

## [2026-06-11] — Reenfoque: agente personal honesto (eliminación de funciones imposibles)

### Decisiones clave
- La app NO tiene integraciones de hardware: se eliminó toda la UI que fingía tenerlas (consumo energético,
  domótica, seguridad, cámaras, clima falso, notificaciones inventadas, escáner de códigos). Alcance real:
  **comida (despensa), eventos (calendario) y tareas**, asistidos por IA pasiva.
- El "evento rápido" del calendario pasa de simulación a IA real: nuevo `POST /calendar/interpretar` con
  Gemini interpreta lenguaje natural ("cena con mis padres el viernes a las 21h") y devuelve una PROPUESTA
  con fecha/hora resueltas; el usuario siempre confirma antes de crear (IA pasiva). Sin caché (cada texto es único).
- Clima eliminado también del backend (no hay proveedor real): fuera de `DashboardUnifiedContext`, del
  briefing IA y del fallback.
- Despensa: estado de stock ahora calculado de datos reales (caducidad + cantidad), no de un mock por id;
  recomendaciones de compra derivadas del stock bajo real; fotos unsplash → emoji por categoría.
- Calendario: fecha y contadores reales en cabecera; filtros por participantes derivados de los eventos
  (iniciales, sin fotos falsas); fuera tabs Día/Semana/Mes sin función, mockupEventos, "Reprogramar" falso
  e "Integraciones" simuladas; eje horario ampliado 07:00–22:00.

### Archivos
- `ADD` backend: `interpret_event_text()` en services/llm.py (+schema estructurado, validación fin>inicio),
  `POST /calendar/interpretar` en routers/calendar.py, schemas `InterpretarEventoRequest/EventoInterpretado/InterpretarEventoResponse`.
- `MOD` backend: schemas.py y llm.py sin campos de clima.
- `MOD` frontend/src/types/types.ts — fuera clima; +EventoInterpretado, InterpretarEventoResponse.
- `MOD` frontend/src/screens/{DashboardScreen,PantryScreen,CalendarScreen}.tsx — limpieza completa descrita arriba.

### Verificación: E2E real — "viernes a las 21h" → 2026-06-12T21:00 (+1h por defecto) OK; texto sin sentido → mensaje sin evento OK; sin token → 401 OK; smoke test 12/12; `ts:check` 0 errores.
### Qué sigue: **F4 — Modelo freemium** (requiere cuenta RevenueCat).

---

## [2026-06-11] — FASE IA: Integración real de Gemini (briefing + recetas)

### Decisiones clave
- `gemini-1.5-flash` ya no existe en la API (el briefing caía siempre al fallback sin saberlo). Modelo
  actualizado a `gemini-2.5-flash`, configurable vía `GEMINI_MODEL`; `thinkingBudget=0` (menos latencia/coste).
- Caché TTL en memoria por hash de datos: briefing 30 min, recetas 1 h. Cambian los datos → se regenera.
  Deuda: migrar a Redis junto con el rate limiter si hay varias réplicas.
- Nueva función IA: `GET /pantry/recetas` — sugiere hasta 3 recetas desde el inventario real, priorizando
  caducidades (salida JSON estructurada con `responseSchema`). IA pasiva: solo sugiere.

### Archivos
- `MOD` backend/app/services/llm.py — rewrite: helper `_call_gemini`, caché, `generate_recipe_suggestions`.
- `MOD` backend/app/{core/config.py (+GEMINI_API_KEY/GEMINI_MODEL), schemas/schemas.py (+RecetaSugerida), api/routers/pantry.py (+/pantry/recetas), .env.example}.
- `MOD` frontend/src/{types/types.ts (+RecetaSugerida), screens/PantryScreen.tsx — mock de recetas hardcodeado sustituido por IA real con botón "Sugerir con IA"}.

### Verificación: E2E con API real — briefing IA OK; 3 recetas coherentes con inventario; caché 2ª llamada 7 ms; smoke test 12/12; `ts:check` 0 errores.

---

## [2026-06-11] — Auditoría: corrección de bugs y deuda técnica

### Correcciones (auditoría exhaustiva pre-producción)
- `FIX` backend/app/services/llm.py — la API key de Gemini iba como query param en la URL y se filtraba
  en logs de errores de red; movida al header `x-goog-api-key`. Eliminado "(Madrid)" hardcodeado del fallback.
- `FIX` backend/app/repositories/{exceptions.py (+TaskNotFoundError), task.py (ValueError → TaskNotFoundError), user.py (+rollback si refresh falla tras commit)}.
- `FIX` backend/app/api/routers/{tasks.py (captura TaskNotFoundError, no ValueError genérico), dashboard.py (docstring obsoleto X-Hogar-ID, clima duplicado)}.
- `FIX` backend/app/services/dashboard.py — sanitización vía `model_copy()`: ya no muta DTOs Pydantic in-place.
- `ADD` backend/app/core/utils.py — `sanitize_text` única (estaba duplicada en tasks.py y dashboard.py).
- `ADD` backend/alembic/versions/3e8f2a1b9c7d — índices: tareas_hogar(hogar_id,estado,is_deleted), eventos_calendario(hogar_id,fecha_inicio/fin).
- `MOD` backend/app/services/calendar.py — comentario de complejidad corregido (O(N²) peor caso, no O(N log N)).

### Verificación: smoke test 12/12 OK; migración de índices aplicada; imports verificados.

---

Ver [[CHANGELOG_ARCHIVE.md]] para historial de F0, F1, F2, F3 y setup inicial.

### Correcciones TypeScript (tsc --noEmit: 0 errores)
- `FIX` [frontend/src/navigation/AppNavigator.tsx](file:///p:/AsistenteHogar/frontend/src/navigation/AppNavigator.tsx) — Añadidos tipos explícitos (`RouteProp<RootTabParamList>`, `BottomTabNavigationOptions`, `{ focused: boolean }`) para resolver errores TS7031 (implicit `any`).
