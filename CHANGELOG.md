# CHANGELOG — Asistente del Hogar IA

Formato: `[FECHA] [ÁREA] [TIPO] Descripción`
- **Tipos:** `ADD` (nuevo), `FIX` (corrección), `MOD` (modificación), `CFG` (configuración)
- **Historial anterior:** ver [`CHANGELOG_ARCHIVE.md`](CHANGELOG_ARCHIVE.md) para entradas pre-2026-06-11

---

## [2026-06-19] — Fase 3: Perfiles individuales de miembros del hogar

### Backend (smoke_test_perfiles.py: 20/20 · suites existentes sin regresiones)
- **ADD** Migración Alembic `a5b3c1d9e7f2` — tabla `perfiles_individuales` (id, hogar_id FK→hogares CASCADE, nombre str 100, preferencias_dieta JSON, excluir_ingredientes JSON, is_deleted bool, created_at, updated_at). Dialect-aware. Index en hogar_id.
- **ADD** `models/models.py` — modelo `PerfilIndividual` + relación `Hogar.perfiles_individuales` (cascade `all, delete-orphan`).
- **ADD** `schemas/schemas.py` — `PerfilIndividualCreate` / `PerfilIndividualUpdate` / `PerfilIndividualResponse`. Validator `limpiar_lista`: strip, dedupe, max 100 chars/item. `extra='forbid'`.
- **ADD** `repositories/perfiles_individual.py` — `PerfilIndividualRepository` con `list_by_hogar`, `get_by_id`, `create` (límite 10 por hogar → `ReglaNegocioError`), `update`, `delete` (soft). Aislamiento multi-tenant en todas las queries.
- **ADD** `api/routers/perfiles.py` — 5 endpoints bajo `/perfiles` protegidos con `get_current_user` + `get_hogar_id`.
- **MOD** `api/deps.py` — añadida `get_perfiles_repo`.
- **MOD** `services/llm.py` — helper `_bloque_perfiles_individuales(perfiles)` incluido en el prompt de `generate_recipe_suggestions` y `generate_meal_plan`.
- **MOD** `api/routers/pantry.py` — `GET /pantry/recetas`, `/plan-comidas`, `/sugerencias` consultan perfiles individuales del hogar y los inyectan al LLM.
- **MOD** `main.py` — registrado `perfiles.router`.
- **ADD** `smoke_test_perfiles.py` — 20 checks: CRUD básico (12), límite 10 (2), aislamiento multi-tenant (3), validación esquema (3), sin autenticación (2). 20/20 OK.
- **RGPD art. 9:** solo se almacenan preferencias culinarias (no alergias/intolerancias médicas).

### Frontend (ts:check 0 errores)
- **MOD** `types/types.ts` — interfaz `PerfilIndividual`.
- **MOD** `screens/SettingsScreen.tsx` — tarjeta «Miembros del hogar» con lista de perfiles + botones editar/eliminar + modal de añadir/editar (nombre, preferencias de dieta, ingredientes a evitar, separados por comas). Nota explícita: "Solo preferencias culinarias — no uses este campo para alergias medicas."

---

## [2026-06-19] — admin-web: panel Next.js para prompts y recetario maestro

### admin-web (Next.js 14, App Router, TypeScript, Tailwind — build 0 errores)
- **ADD** `app/login/page.tsx` — formulario de login con `POST /admin/auth/login`, token en localStorage.
- **ADD** `app/prompts/page.tsx` — lista todos los templates de prompt; `PromptEditor` permite editar `system_instruction` + toggle activo con badge de versión. Nota: la filosofía mediterránea se añade automáticamente server-side (no editable).
- **ADD** `app/recetario/page.tsx` — tabla de recetas maestras con filtro activa/inactiva y botón «Nueva receta» que abre `RecetaForm` en modal.
- **ADD** `app/recetario/[id]/page.tsx` — formulario de edición de receta con DELETE.
- **ADD** `components/AdminNav.tsx` — barra lateral: Prompts | Recetario | Logout.
- **ADD** `components/PromptEditor.tsx` — textarea + Guardar + badge de versión + toggle activo.
- **ADD** `components/RecetaForm.tsx` — campos nombre / ingredientes (tags) / pasos / categoría / temporada / aprovechamiento.
- **ADD** `lib/api.ts` — `adminApi` tipado: login, CRUD prompts, CRUD recetario.
- **ADD** `lib/auth.ts` — `getToken` / `setToken` / `clearToken` sobre localStorage.
- **ADD** `.gitignore` — excluye `node_modules/`, `.next/`, `.env.local`.

---

## [2026-06-19] — Mejora #7: umbral de caducidad configurable por hogar

### Frontend (ts:check 0 errores)
- **ADD** `state/pantrySettingsStore.ts` — Zustand store con `diasUmbral` (default 6 días), persistido en `expo-secure-store`. Expone `OPCIONES_UMBRAL = [3, 6, 10, 14]` y `hydrate()`.
- **MOD** `lib/caducidad.ts` — `getSemaforoCaducidad(dias, umbral = 6)` acepta umbral configurable. El borde "urgente" (≤3 días) es fijo; "Consumir pronto" empieza en `dias > 3 && dias <= umbral`.
- **MOD** `screens/PantryScreen.tsx` — lee `diasUmbral` del store y lo pasa a `getItemStatus(item, umbral)`.
- **MOD** `screens/SettingsScreen.tsx` — tarjeta «Despensa» con Chip picker 3d / 6d / 10d / 14d. El valor se persiste y se aplica inmediatamente al semáforo del inventario.
- **MOD** `navigation/AppNavigator.tsx` — `hydratePantrySettings()` en el mismo `useEffect` que `hydrate()` de auth.

---

## [2026-06-18] — Foto de nevera: UI completa en PantryScreen

### Frontend (ts:check 0 errores)
- **ADD** FAB cuaternario `camera-outline` (`colors.success`, bottom 216) en `PantryScreen` — acceso directo a la funcionalidad de foto de nevera (premium gate).
- **ADD** Handler `handleFotoNevera` — premium gate → permiso de cámara → Alert para elegir entre cámara y galería → `procesarFotoNevera`.
- **ADD** Handler `procesarFotoNevera` — llama a `POST /pantry/foto-nevera` con `imagen_base64` y `fecha_referencia`; muestra overlay de escaneo durante el análisis; mapea resultado a `OcrItem[]` y abre modal de revisión.
- **ADD** Handlers `toggleFotoItem` / `confirmarFotoItems` — misma mecánica de selección en lote que el OCR de ticket.
- **ADD** Overlay `fotoScanning` — modal fade con spinner verde ("Analizando nevera...").
- **ADD** Modal de revisión `fotoReviewVisible` — lista de ingredientes con checkboxes, sección "Recetas express posibles" cuando `sugerencias_rapidas` no está vacío, botones "Añadir seleccionados" / "Cancelar", `AIDisclaimerBanner`.

---

## [2026-06-18] — RecipeDetailScreen: pantalla de detalle de receta

### Frontend (ts:check 0 errores)
- **ADD** `screens/RecipeDetailScreen.tsx` — pantalla completa de receta con header de vuelta, badges de tiempo e ingredientes, lista de ingredientes con iconos checkmark, pasos numerados con burbuja de color marca, y footer fijo con botones "Marcar como cocinada" (primario) y "No me gusta" (ghost). Llama a `useRecetaHistorial` y navega atrás tras registrar la acción.
- **MOD** `navigation/AppNavigator.tsx` — añadida ruta `RecetaDetalle: { receta: RecetaSugerida }` al `RootStackParamList`; `Stack.Screen` con `animation: 'slide_from_right'`.
- **MOD** `screens/PantryScreen.tsx` — botón "Ver" en tarjeta de receta ahora navega a `RecetaDetalle` en lugar de mostrar un `Alert`. Los botones "Cocinada" / "No me gusta" se mantienen también en la tarjeta para acción rápida.

---

## [2026-06-18] — Fase 2: Panel admin — prompts dinámicos, recetario maestro, admin JWT

### Backend (verificado: 26/26 smoke_test_admin + 5 suites existentes en verde)
- **ADD** Migración Alembic `e1f3a5c70d84` — tablas globales (sin `hogar_id`): `admin_users`, `prompt_templates`, `recetario_maestro`. Dialect-aware (SQLite dev / PostgreSQL prod).
- **ADD** Modelos ORM `AdminUser`, `PromptTemplate`, `RecetaMaestra` en `models.py`.
- **ADD** `AdminUserRepository`, `PromptTemplateRepository`, `RecetaMaestraRepository` en `repositories/`.
- **ADD** `AdminAuthService` (`services/admin_auth.py`) — bcrypt + JWT firmado con `ADMIN_JWT_SECRET_KEY` (secreto separado del JWT de familias). Payload incluye `role: "admin"`; tokens cruzados devuelven 401.
- **ADD** `PromptConfigService` (`services/prompt_config.py`) — lee `system_instruction` de BD con caché TTL 5 min; siempre añade `_FILOSOFIA_MEDITERRANEA` al final (no-removible server-side).
- **ADD** Routers `admin_auth.py`, `admin_prompts.py`, `admin_recetario.py` bajo `/api/v1/admin/*`.
  - `POST /admin/auth/bootstrap` — crea el primer admin (501 si no hay token env; 409 si ya existe).
  - `POST /admin/auth/login` — devuelve `AdminTokenResponse`.
  - `GET/PATCH /admin/prompts` + `GET/PATCH /admin/prompts/{clave}` — CRUD de templates con invalidación de caché.
  - `GET/POST /admin/recetario` + `GET/PATCH/DELETE /admin/recetario/{id}` — CRUD recetario maestro (hard delete).
- **MOD** `core/config.py` — añadidos `ADMIN_JWT_SECRET_KEY`, `ADMIN_JWT_EXPIRE_MINUTES` (480), `ADMIN_BOOTSTRAP_TOKEN`.
- **MOD** `services/llm.py` — `generate_recipe_suggestions` y `generate_meal_plan` aceptan `prompt_config: PromptConfigService | None`; usa `TYPE_CHECKING` para evitar importación circular.
- **MOD** `api/routers/pantry.py` — los 3 endpoints de recetas/plan/sugerencias inyectan `PromptConfigService` y lo pasan a las funciones LLM.
- **ADD** `backend/.env.example` — documentadas las 3 nuevas variables de entorno.
- **ADD** `smoke_test_admin.py` — 26 checks: bootstrap, login, aislamiento JWT cruzado, CRUD prompts, guardia `_FILOSOFIA_MEDITERRANEA`, CRUD recetario.

### admin-web (Next.js 14, 0 errores TypeScript, 7 rutas compiladas)
- **ADD** `admin-web/` — panel de administración en Next.js 14 App Router + TypeScript + Tailwind CSS.
  - `login/page.tsx` — formulario de login admin → `POST /admin/auth/login`.
  - `prompts/page.tsx` — lista de templates con editor inline (textarea + badge de versión + checkbox activo). Nota: "La filosofía mediterránea se añade automáticamente".
  - `recetario/page.tsx` — tabla de recetas maestras + modal "Nueva receta".
  - `recetario/[id]/page.tsx` — formulario de edición con TagInput para ingredientes/pasos.
  - `lib/api.ts` — helpers tipados con Bearer auth; `lib/auth.ts` — gestión de token en localStorage.
  - `components/AdminNav.tsx`, `PromptEditor.tsx`, `RecetaForm.tsx`.

---

## [2026-06-18] — Pivote 2: App exclusivamente de comida, stock y recetas

### Decisión de producto
La app pasa a ser **100% comida**. Se eliminaron de raíz los módulos de **Eventos (calendario)**
y **Tareas (domésticas)**. El núcleo queda: stock real de la despensa → recetas mediterráneas
españolas de aprovechamiento. Ver `ARCHITECTURE_MAP.md` para el mapa de sistema actualizado.

Se relaja la restricción "IA pasiva": se permiten escrituras automáticas de bajo riesgo y
reversibles (descontar stock al terminar receta, ajustar perfil vía function calling) con undo
visible. Confirmación explícita sigue siendo obligatoria para acciones destructivas.

### Backend (verificado: smoke tests en verde)
- **DEL** `routers/calendar.py`, `services/calendar.py`, `repositories/calendar.py` — eliminados.
- **DEL** `routers/tasks.py`, `repositories/task.py` — eliminados.
- **DEL** Modelos `EventoCalendario`, `TareaHogar` de `models.py`; relaciones `eventos`/`tareas` de `Hogar`.
- **DEL** `EventoNotFoundError`, `TaskNotFoundError` de `repositories/exceptions.py`.
- **DEL** Schemas `Evento*`, `Tarea*`, `Conflicto*`, `CalendarAgenda*`, `InterpretarEvento*`, `InterpretarTarea*`.
- **MOD** `DashboardUnifiedContext` — quitados `eventos_hoy`, `tareas_pendientes`, `conflictos_agenda`.
- **MOD** `services/dashboard.py` — briefing solo con métricas de despensa.
- **MOD** `services/llm.py` — eliminadas `interpret_event_text`, `interpret_task_text`; briefing sin anonimizador (datos de pantry no contienen nombres).
- **MOD** `api/deps.py` — eliminadas deps de calendar/tasks; `get_dashboard_service` simplificado.
- **MOD** `jobs/purge.py` — purga solo `inventario_alimentos`.
- **MOD** `repositories/user.py` — `delete_hogar_fisico` sin selectinload de tareas/eventos.
- **ADD** Migración Alembic `d3e5f7b91a26` — `DROP TABLE eventos_calendario`, `DROP TABLE tareas_hogar` (downgrade reversible).

### Frontend (ts:check 0 errores)
- **DEL** `screens/CalendarScreen.tsx`, `screens/AgendaScreen.tsx`, `screens/TasksScreen.tsx`.
- **DEL** `hooks/useCalendar.ts`, `hooks/useTasks.ts`.
- **MOD** `navigation/AppNavigator.tsx` — tabs: **Inicio · Despensa · Ajustes** (eliminada Agenda).
- **MOD** `types/types.ts` — eliminados tipos de eventos, tareas, conflictos; `DashboardData` simplificado.
- **MOD** `screens/DashboardScreen.tsx` — solo briefing + alertas de despensa.

### Documentación
- **ADD** `ARCHITECTURE_MAP.md` — mapa de sistema Mermaid completo (sistema, ER, flujos, monetización, fases).
- **MOD** `CLAUDE.md`, `ENDPOINTS.md`, `LEGALIDAD.md`, `ESTADO_ACTUAL.md`, `DISENO_UI.md`, `MEJORAS_PENDIENTES.md`.

---

## [2026-06-18] — F-PIVOT #3: Entrada por audio NL

### Backend
- **ADD** `POST /api/v1/pantry/audio` (premium) — endpoint en `routers/pantry.py` que recibe texto transcrito y lo pasa a `interpret_pantry_text` de Gemini. Devuelve propuesta de alimentos (el usuario confirma antes de añadir). Rate limit: 20/5 min (compartido con `/interpretar`).

### Frontend
- **ADD** FAB de micrófono en `PantryScreen` — abre modal de entrada de texto con dictado nativo (teclado iOS/Android integrado, sin nuevas dependencias). El usuario habla → dicta el texto → envía al endpoint.

---

## [2026-06-18] — F-PIVOT #4: Foto de nevera (backend)

### Backend
- **ADD** `analyze_fridge_photo()` en `services/llm.py` — Gemini Vision multimodal (imagen base64), devuelve lista de alimentos detectados + sugerencias de recetas express.
- **ADD** `POST /api/v1/pantry/foto-nevera` (premium) en `routers/pantry.py` — schemas `FotoNeveraRequest` / `FotoNeveraResponse`. Rate limit: 10/h. Requiere `GEMINI_API_KEY`.
- **ADD** `foto_nevera_rate_limiter` en `core/rate_limit.py`.

### Frontend
- UI pendiente de integrar en el Home redesign (botón de cámara en `PantryScreen`). El backend está listo.

---

## [2026-06-18] — F-PIVOT #5: Historial de recetas + aprendizaje de comportamiento

### Backend (verificado: 59 smoke tests en verde, incl. 9 checks de historial)
- **ADD** Modelo `RecetaHistorial` (`models.py`) — registra acciones del hogar sobre recetas
  sugeridas (`accion`: `cocinada` | `rechazada`). Aislamiento multi-tenant vía `hogar_id` (JWT).
- **ADD** Migración Alembic `c2d4f6a80e04` — tabla `recetas_historial` compatible SQLite+Postgres.
- **ADD** `RecetaHistorialCreate` / `RecetaHistorialResponse` en `schemas.py` con `extra='forbid'`
  y validación de acción (`cocinada` | `rechazada`).
- **ADD** `RecetaHistorialRepository` (`repositories/historial.py`) — `registrar` + `get_recientes`.
- **ADD** `RecetaHistorialService` (`services/historial.py`).
- **ADD** Router `historial.py` — `POST /api/v1/pantry/recetas/historial` (201) +
  `GET /api/v1/pantry/recetas/historial` (lista últimas 20 entradas).
- **ADD** Helper `_bloque_historial` en `llm.py` — inyecta señales en el prompt de Gemini:
  cocinadas recientes (evitar repetir) + rechazadas (no sugerir nunca). Forma parte de la clave
  de caché al entrar en `prompt_usuario`.
- **MOD** `generate_recipe_suggestions` acepta `historial: list[RecetaHistorialResponse] | None`.
- **MOD** Endpoints `/pantry/recetas`, `/pantry/sugerencias` obtienen historial vía
  `RecetaHistorialService` e inyectan el contexto de comportamiento en cada llamada a Gemini.

### Frontend
- **ADD** `RecetaHistorial` interface en `types.ts`.
- **ADD** Hook `useRecetaHistorial` (`hooks/useRecetaHistorial.ts`) — `registrarAccion` +
  loading state por receta individual.
- **MOD** `PantryScreen.tsx` — botones «Cocinada» / «No me gusta» en cada tarjeta de receta;
  tras registrar la acción se recarga automáticamente la lista de sugerencias (caché invalida
  porque el historial cambia el hash del prompt).

---

## [2026-06-18] — F-PIVOT #6: Recetas personalizadas por perfil + decisión de arquitectura

### Decisión de arquitectura del motor de recetas: HÍBRIDA
- Fase 1 (en curso): generativo + personalización por perfil + aprendizaje por historial (#5).
- Fase 2: recetario base canónico (cientos de platos) como ancla de calidad.
- Fase 3: recomendador sobre catálogo + generativo. Ver `MEJORAS_PENDIENTES.md`.

### Personalización por perfil (F-PIVOT #6, verificado: 5 suites smoke en verde)
- **ADD** Helper `_bloque_perfil` en `llm.py` — inyecta `gustos_culinarios` + `num_comensales`
  en los prompts de `generate_recipe_suggestions` y `generate_meal_plan`. El bloque entra en
  `prompt_usuario` → forma parte de la clave de caché (perfiles distintos = sugerencias distintas).
- **MOD** Ambas funciones LLM aceptan `perfil: PerfilHogarResponse | None = None` (retrocompatible).
- **MOD** Router `pantry.py` — los 3 endpoints (`/pantry/recetas`, `/plan-comidas`, `/sugerencias`)
  obtienen el perfil vía `OnboardingService` (inyectado) y lo pasan a las funciones LLM.
- Sin intolerancias/alergias (datos de salud pospuestos); el perfil enviado a Gemini es no sensible.

---

## [2026-06-18] — F-PIVOT #2: Perfil de hogar + onboarding

### Backend (verificado: 5 suites smoke en verde, incl. 16 checks de onboarding)
- **ADD** Modelo `PerfilHogar` (`models.py`) — un perfil por hogar (`hogar_id` único), relación
  con cascade desde `Hogar` (el borrado de cuenta RGPD arrastra el perfil).
- **ADD** Migración Alembic `a1c3e5f70b92` — tabla `perfil_hogar` (`gustos_culinarios` JSON,
  `num_comensales` INT). Upgrade+downgrade probados en SQLite.
- **ADD** Schemas `OnboardingRequest` / `PerfilHogarResponse` (`extra='forbid'`, validación de
  `num_comensales` 1–20 y limpieza de gustos). El `extra='forbid'` bloquea que se cuelen
  alergias/intolerancias (datos de salud) por error.
- **ADD** `PerfilHogarRepository` (upsert), `OnboardingService`, router `GET`/`POST /api/v1/onboarding`
  (hogar_id siempre del JWT), cableado en `deps.py` y `main.py`.
- **Decisión RGPD:** esta iteración guarda SOLO datos no sensibles. Alergias/intolerancias
  (art. 9) se posponen a una iteración con flujo de consentimiento explícito dedicado.

### Frontend (ts:check 0 errores)
- **ADD** `OnboardingProfileScreen` — encuesta de gustos (chips mediterráneos) + nº de comensales
  (stepper), estética Tierra Cálida. Saltable ("Ahora no").
- **ADD** Hook `useOnboarding` — gate robusto sin depender de códigos de estado: flag local +
  GET /onboarding (200 → ya tiene perfil; fallo → mostrar encuesta saltable).
- **MOD** `AppNavigator` — nuevo componente `AuthedApp` que monta el gate de perfil SOLO con
  sesión activa (el GET /onboarding nunca corre sin token).
- **ADD** Tipo `PerfilHogar` en `types.ts`.

---

## [2026-06-17] — Pivote estratégico: Recetas mediterráneas españolas

### F-PIVOT #1 — Filosofía mediterránea en prompts LLM (implementado)
- **ADD** `backend/app/services/llm.py` — constante de módulo `_FILOSOFIA_MEDITERRANEA`
  (restricción no-negociable, ver `CLAUDE.md`) inyectada en `generate_recipe_suggestions`
  y `generate_meal_plan`. Cocina mediterránea española tradicional y de aprovechamiento:
  sofritos, ingredientes frescos y de temporada. Prohíbe explícitamente fusiones impropias
  (pasta con teriyaki, paella con curry, gazpacho con leche de coco).
- Fuente única compartida → ambos prompts no pueden desincronizarse. Verificado: import OK,
  `smoke_test_modules.py` 43/43.

### Rediseño visual — Sistema "Tierra Cálida Mediterránea" (implementado)
- **MOD** `frontend/src/theme/tokens.ts` — nueva paleta cálida (marrón arcilla `#8B5E3C`,
  lino `#FAF7F2`, beige, terracota), reemplaza el índigo `#6366F1`. Radios más orgánicos,
  sombras warm-tinted. Palanca única: cambia el look global sin tocar pantallas.
- **ADD** `frontend/src/lib/caducidad.ts` — `getSemaforoCaducidad`: semáforo centralizado
  de 3 niveles (fresco/pronto/urgente), umbrales alineados con backend (≤6 días) y
  notificaciones (≤3 días). Aplicado en `PantryScreen` y `DashboardScreen`.
- **FIX** Eliminados todos los colores hardcodeados residuales del sistema índigo viejo:
  hex en `CalendarScreen`/`SettingsScreen`/`DashboardScreen` → tokens semánticos; ripples
  Android índigo `rgba(99,102,241,…)` en `Button`/`Chip`/`Card`/`IconButton` → marrón cálido.
  `grep` de índigo → 0 coincidencias. `ts:check` 0 errores.
- **ADD** `DESIGN.md` — sistema de diseño documentado (síntesis Mastercard + Airbnb + Notion).
- **CFG** Skill `mobile-app-design` instalado en `~/.claude/skills/` (reglas RN nativas).

### Dirección del producto
- **MOD** Enfoque principal cambiado de "gestión del hogar generalista" a **generación de recetas
  mediterráneas españolas tradicionales y de aprovechamiento** basadas en el stock real de la despensa.
- Filosofía gastronómica: sofritos, ingredientes frescos, cocina de temporada. Sin fusiones incorrectas.
- Función secundaria: planificación semanal de menús + calendario familiar (complemento).

### Métodos de entrada planificados (F-PIVOT)
- `POST /pantry/audio` — entrada por voz en NL (micro-ajustes rápidos, IA pasiva).
- `POST /pantry/foto-nevera` — Gemini Vision analiza ingredientes visibles (IA pasiva, premium).
- `POST /onboarding` — perfil de hogar: gustos, intolerancias, alergias, nº comensales.
- Tabla `perfil_hogar` pendiente de migración Alembic.

### Documentación actualizada (rama `feat/pivote-recetas-mediterraneas`)
- **MOD** `CLAUDE.md` — nuevo overview, filosofía mediterránea en constraints LLM, fases actualizadas.
- **MOD** `01_CONTEXTO_Y_ARQUITECTURA_APP.md` — v3.0: schema `perfil_hogar`, endpoints planificados, tabla LLM.
- **MOD** `ENDPOINTS.md` — Despensa marcada como función principal; 3 endpoints planificados añadidos.
- **MOD** `ESTADO_ACTUAL.md` — nueva sección de pivote, "qué hace la app" actualizado, deuda técnica.
- **MOD** `MEJORAS_PENDIENTES.md` — backlog reescrito con prioridades F-PIVOT (#1–#8 anteriores movidos a CHANGELOG).
- **MOD** `DISENO_UI.md` — próximos componentes UI (micrófono, cámara, onboarding, receta detallada).
- **MOD** `LEGALIDAD.md` — flujos de datos nuevos (audio, foto, onboarding con datos de salud art. 9 RGPD).
- **MOD** `PRODUCCION_CHECKLIST.md` — permisos de micrófono y cámara añadidos al build nativo.

---

## [2026-06-16] — F-QA2: Auditoría y blindaje pre-producción (en curso)

### Bloque 1+2 — Auditoría de dependencias y secretos
- **ADD** `.gitleaks.toml` — allowlist de los archivos `smoke_test_*.py`. El escaneo del
  historial git (55 commits, 123 MB) reportó 12 hallazgos, todos falsos positivos:
  contraseñas de prueba (`contrasena_segura_123`) en los smoke tests. **0 secretos reales**.
- **Auditoría `pip-audit`** (`backend/requirements.txt`): única vulnerabilidad es `pip`
  en sí mismo (PYSEC-2026-196, fix 26.1.2), no una dependencia de la app. Sin riesgo prod.
- **Auditoría `npm audit`**: 19 moderate, todas en el toolchain de build de Expo/RN
  (`js-yaml`, `postcss`, `uuid` vía `@expo/*`). No afectan al runtime; el fix exige saltar
  a Expo SDK 56 (breaking). Aceptadas hasta la migración de SDK.

### Bloque 4 — Schemathesis (API schema fuzzing)
- **MOD** `backend/requirements.txt` — añadido `schemathesis>=3.27,<4`.
- **MOD** `.github/workflows/ci.yml` — nuevo step en el job `backend` tras los smoke tests:
  `schemathesis run --app=app.main:app http://localhost/openapi.json` en modo ASGI (sin servidor
  real; schemathesis inyecta requests directamente contra la app en memoria).
  Check: `not_a_server_error` — cualquier endpoint que devuelva 5xx falla la build.
  25 ejemplos por endpoint (`--hypothesis-max-examples=25`), 2 workers. Requests sin autenticar
  → 401 (correcto, no 5xx). Tiempo estimado: ~30 s extra sobre el job backend.

### Bloque 3 — Integración continua (GitHub Actions)
- **ADD** `.github/workflows/ci.yml` — pipeline en cada push/PR a `main`, 3 jobs en paralelo:
  - **backend**: Ruff (lint+formato) + Mypy strict sobre `app/` + los 5 smoke tests (122 checks).
  - **frontend**: `tsc` (0 errores) + ESLint sobre todo el proyecto.
  - **security**: `pip-audit -r requirements.txt`, `npm audit --audit-level=high`
    (solo bloquea high/critical), y `gitleaks` sobre el historial completo.
  - `concurrency` cancela ejecuciones antiguas de la misma rama. `JWT_SECRET_KEY` ficticio
    inyectado en el job backend (smoke tests usan SQLite temporal + `GEMINI_API_KEY=""`).
- El escudo de calidad deja de ser solo local (pre-commit/husky): ahora se valida en remoto.

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
