# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Asistente del Hogar IA** — app de cocina familiar centrada en la **generación y sugerencia de recetas mediterráneas españolas tradicionales y de aprovechamiento** a partir del stock real de la despensa. Filosofía gastronómica estricta: sofritos, ingredientes frescos, cocina de temporada; sin fusiones incorrectas.

**Función principal:** recetas basadas en el stock real del hogar.
**Función secundaria (complemento):** planificación semanal de menús de aprovechamiento.

> **Pivote 2 (2026-06-18):** la app es **exclusivamente de comida, stock y recetas**.
> Se eliminaron de raíz los módulos de **Eventos (calendario)** y **Tareas (domésticas)**;
> no reintroducir nada relacionado. Ver `ARCHITECTURE_MAP.md`.

**Tres métodos de entrada de fricción cero:**
1. **OCR de ticket** — escanea el ticket de la compra con Gemini Vision (implementado, premium).
2. **Audio NL** — micrófono para micro-ajustes rápidos ("Apunta que he gastado dos huevos") vía Gemini.
3. **Foto de nevera** — análisis visual de ingredientes visibles, propuesta express con confirmación del usuario.

**Encuesta de onboarding** — perfil inicial (gustos, intolerancias, alergias, nº comensales). El sistema aprende del comportamiento para optimizar las recetas con el uso.

Single family account model (multi-tenant isolation by `hogar_id` derived from JWT). Language: Spanish throughout (UI, logs, AI responses).

Stack: React Native (Expo SDK 54) frontend (UI styled with StyleSheet + design tokens; NativeWind/Tailwind fully removed), FastAPI + SQLAlchemy 2.0 async backend, PostgreSQL (SQLite for dev/tests).

---

## Commands

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Setup: copy and fill .env
cp .env.example .env  # then add JWT_SECRET_KEY and optionally GEMINI_API_KEY

# Run dev server (SQLite default, no Docker needed)
uvicorn app.main:app --reload

# Run with PostgreSQL (requires docker-compose up -d first)
docker-compose up -d
uvicorn app.main:app --reload

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Seed del recetario maestro (idempotente — safe re-ejecutar)
python seed_recetario.py        # inserta 15 recetas mediterráneas base en recetario_maestro

# Smoke tests (each uses its own separate temp SQLite DB)
python smoke_test_auth.py       # auth + multi-tenant isolation (12 checks)
python smoke_test_modules.py    # pantry CRUD + AI endpoints (recetas, audio, foto-nevera, plan), onboarding, historial, isolation
python smoke_test_dashboard.py  # dashboard aggregation/filtering + isolation (19 checks)
python smoke_test_validation.py # endpoint error contract: 400/401/404/422 (20 checks)
python smoke_test_legal.py      # GDPR purge, account deletion, LLM anonymization (26 checks)
python smoke_test_admin.py      # admin bootstrap, login, prompts CRUD, recetario CRUD
python smoke_test_perfiles.py       # perfiles individuales CRUD + isolation + limit (10/hogar)
python smoke_test_lista_compra.py   # lista de la compra CRUD + borrado masivo + isolation (27 checks)
python smoke_test_rechazar_ingrediente.py  # rechazar-ingrediente: schema, multi-tenant, auth (16 checks)
python smoke_test_chef.py           # chef chat + valoración + memoria de gustos + aislamiento
python smoke_test_movimientos.py    # ledger de movimientos + agregados de hábitos + aislamiento
python smoke_test_lista_inteligente.py  # sugerencias de compra por cadencia del ledger
python smoke_test_confianza.py      # stock incierto por cadencia + agotar + confirmar

# Manual GDPR purge pass (also runs automatically every 24h from the app lifespan)
python -m app.jobs.purge
```

### Frontend

```bash
cd frontend

npm install

# Start Expo dev server (choose device from menu)
npm start

# Platform-specific
npm run android
npm run ios

# TypeScript check (must return 0 errors before committing)
npm run ts:check

# Lint + format (ESLint + Prettier)
npm run lint
npm run format

# EAS Build (requires: npm install -g eas-cli + eas login)
eas init                          # one-time: creates projectId, updates app.json
eas build --profile development   # dev client (iOS simulator or device)
eas build --profile preview       # APK for internal testing
eas build --profile production    # store-ready build
eas submit --platform ios         # submit to App Store Connect
eas submit --platform android     # submit to Google Play
```

### Admin web (panel Next.js — `admin-web/`)

```bash
cd admin-web

npm install

# Dev server (http://localhost:3000)
npm run dev

# Production build
npm run build

# TypeScript check
npm run ts:check
```

Bootstrap the first admin user via `POST /api/v1/admin/auth/bootstrap` (requires `ADMIN_BOOTSTRAP_TOKEN` set in backend `.env`). After that, log in via `POST /api/v1/admin/auth/login` — the resulting token is separate from family JWTs and only works on `/admin/*` routes.

### CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/PR to `main` — 3 parallel jobs:
- **backend**: Ruff + Mypy + all smoke tests + Schemathesis (25 examples/endpoint, ASGI mode, any 5xx fails).
- **frontend**: TypeScript check + ESLint.
- **security**: `pip-audit` + `npm audit` + `gitleaks` (allowlist in `.gitleaks.toml`).

### Quality shield (runs automatically on every commit via husky)

```bash
# One-time setup (backend shield): installs pre-commit into the repo's git hooks.
# pre-commit lives in the project venv; activate it once per clone:
uv run pre-commit install

# Backend — Ruff (lint+format) + Mypy strict, scoped to backend/app/ (config in backend/pyproject.toml)
uv run pre-commit run --all-files     # run the full backend shield manually

# Frontend — husky + lint-staged run TypeScript + ESLint + Prettier on staged files at commit time.
cd frontend && npx lint-staged        # run the frontend shield manually
```

The husky pre-commit hook (`.husky/pre-commit`) orchestrates both: it runs `lint-staged` for the
frontend and `pre-commit` for the backend. If `pre-commit` is not installed, the hook fails the commit
with instructions instead of silently skipping the shield.

### Verification before any change

```bash
# Backend
cd backend
python smoke_test_auth.py        # 12/12 must pass
python smoke_test_modules.py     # must pass
python smoke_test_dashboard.py   # 19/19 must pass
python smoke_test_validation.py  # 20/20 must pass
python smoke_test_legal.py       # 26/26 must pass
python smoke_test_admin.py       # must pass
python smoke_test_perfiles.py        # must pass
python smoke_test_lista_compra.py    # 27/27 must pass
python smoke_test_rechazar_ingrediente.py  # 16/16 must pass
python smoke_test_chef.py            # chef chat + valoración + memoria must pass
python smoke_test_movimientos.py     # ledger de movimientos + hábitos must pass
python smoke_test_lista_inteligente.py  # sugerencias de compra must pass
python smoke_test_confianza.py       # confianza de stock + agotar/confirmar must pass

# Frontend
cd frontend && npm run ts:check           # 0 errors
```

---

## Architecture

### Multi-tenant isolation

`hogar_id` is **always** extracted from the validated JWT by `get_hogar_id()` in `backend/app/api/deps.py`. It is **never** accepted from client headers or request bodies. Every repository method takes `hogar_id: UUID` as a mandatory parameter and includes it in all queries. Breaking this rule creates a tenant data leak.

### Backend layering

```
Router (api/routers/) → Service (services/) → Repository (repositories/) → SQLAlchemy models
```

- **Routers** return Pydantic schemas, never ORM model instances.
- **Services** contain business logic (conflict detection, LLM calls, metric calculations).
- **Repositories** contain only async DB queries; raise typed exceptions from `repositories/exceptions.py`.
- **Global exception handlers** in `main.py` map repository exceptions to HTTP status codes.

Dependency injection is done via FastAPI `Depends()` chains defined in `api/deps.py`. Services receive their repositories through constructor injection.

### LLM integration (`services/llm.py`)

Gemini functions, all via the shared `_call_gemini` helper (temperature=0, thinkingBudget=0;
`_call_gemini` admite multi-turno vía `contents` para el chat):
`generate_morning_briefing`, `generate_recipe_suggestions`, `interpret_pantry_text` (multi-item),
`analyze_fridge_photo` (Vision), `suggest_food_metadata`, `generate_meal_plan`, `interpret_audio_text`,
`distill_taste_memory` (resume gustos del hogar → `memoria_gustos`), `chef_chat` (conversacional).

**Persona unificada (`_PERSONA_CHEF`):** voz cálida del chef ("Marce"), inyectada en briefing/recetas/
plan/chat. Antepuesta en `PromptConfigService.get_system_instruction` (afinable desde el panel admin) y
en las ramas fallback; `_FILOSOFIA_MEDITERRANEA` sigue como guard final no-removible.

**Memoria de gustos:** `_bloque_memoria_gustos` inyecta un resumen NL destilado (tabla `memoria_gustos`,
1/hogar) en sugerencias/plan/chat → el asistente "recuerda" al hogar con prompt acotado. `MemoriaService`
la recalcula best-effort al recibir feedback nuevo (valoración en `recetas_historial`). No fine-tuning:
toda la personalización es prompt + memoria en inferencia.

**Hábitos de compra/consumo (ledger):** la tabla `movimientos_despensa` registra entradas/salidas de
stock (compra/consumo/caducado) como efecto secundario de `PantryService.add_item/update_item/remove_item`.
`MovimientoDespensaRepository.habitos_compra`/`ritmo_consumo` agregan por alimento (frecuencia, recencia,
intervalo medio) vía SQL, y `distill_taste_memory` los incorpora a la memoria → las sugerencias priorizan
lo que el hogar suele tener. El ledger crudo NUNCA va al prompt (solo el resumen destilado). El stock es
una *hipótesis* (lo que probablemente tienes), no un inventario exacto; la reconciliación fiable se hará
en el punto de uso (fase siguiente). Ver `ARCHITECTURE_MAP.md`/`CHANGELOG.md`.
The `interpret_*` / `analyze_*` functions use Gemini structured output (`responseSchema`) and return a
proposal the user must confirm before any destructive write. Low-risk writes (stock depletion, profile
micro-adjustments via function calling) may happen automatically with visible undo. Results that are
expensive are cached in-process with TTL (briefing 30 min, recipes/meal plan 1–2 h); the cache key is a
SHA-256 hash of the prompt data. When `GEMINI_API_KEY` is absent, all functions return static fallback
responses — the app works without a key.

**Filosofía gastronómica (restricción de prompts):** todos los prompts de `generate_recipe_suggestions`
y `generate_meal_plan` deben incluir la instrucción de sistema: cocina mediterránea española tradicional
y de aprovechamiento, priorizando sofritos, ingredientes frescos y de temporada. Prohibir explícitamente
fusiones culturales incorrectas (ej. pasta con salsa teriyaki). Esta restricción es no-negociable y debe
sobrevivir cualquier refactorización de los prompts.

**`_call_gemini` infrastructure**: a single shared `httpx.AsyncClient` (keep-alive pool, closed in the
app lifespan via `aclose_http_client`), bounded retry with backoff on transient errors (429/5xx/network),
and `_extract_text` that distinguishes safety blocks / missing candidates / `MAX_TOKENS` truncation.
The AI endpoints are rate-limited (see `core/rate_limit.py`): `/pantry/interpretar` and `/pantry/audio`
share 20/5 min, `/pantry/recetas` 20/h, `/pantry/sugerir-metadata` 40/5 min, `/pantry/plan-comidas` 10/h,
`/pantry/foto-nevera` 10/h.

**Gemini data-tier compliance (RGPD)**: the `GEMINI_API_KEY` must belong to a **billing-enabled** Google AI
project (where prompts are NOT used to improve Google's products) or Vertex AI with a DPA / EU region. The
free tier may use prompts for product improvement, which is not acceptable for household personal data.

**LLM anonymization (`services/privacy.py`)**: `AnonimizadorLLM` is preserved for future use (chat). The briefing no longer receives personal names (pantry data only), so anonymization is not called there. If personal names re-enter any prompt (e.g., chat context), `AnonimizadorLLM` must be applied before the prompt leaves for Gemini and reverted after. `generate_morning_briefing` returns `(text, generado_por_ia)`; the flag drives the AI transparency banner (`AIDisclaimerBanner`) in the frontend, which must never label the static fallback as AI.

### Pydantic schemas (`schemas/schemas.py`)

All schemas extend `BaseSchema` which enforces `extra='forbid'` globally. The pattern for each entity: `XCreate` / `XUpdate` / `XResponse`. Validators use `@field_validator` (Pydantic v2 syntax). Never add `extra='allow'` or bypass validation.

### Frontend state

- **Auth**: Zustand store at `src/state/authStore.ts` — holds JWT token, user, and hogar. Persists to `expo-secure-store` (encrypted). On app boot, `hydrate()` restores the session before rendering.
- **Purchases**: `src/state/purchasesStore.ts` — Zustand store for RevenueCat premium entitlement state.
- **Pantry settings**: `src/state/pantrySettingsStore.ts` — persisted store for configurable expiry threshold (3/6/10/14 days).
- **API calls**: `src/api/api.ts` — adds `Authorization: Bearer <token>` to every request automatically. Exports `TIMEOUT = { DEFAULT: 15_000, AI: 45_000, OCR: 60_000, OCR_FULL: 90_000 }` used by all hooks and screens.
- **Feature hooks**: `src/hooks/use{Dashboard,Pantry,ListaCompra}.ts` — fetch data and expose loading/error state to screens. `src/hooks/useRecetaHistorial.ts` — historial de recetas cocinadas/rechazadas + `registrarAccion`.

### Frontend screens

Two-layer onboarding before auth: `OnboardingScreen` (pager con hero images de `assets/onboarding/` — mercado.jpg, cocina.jpg — se marca visto en `expo-secure-store`). Después del login, `useOnboarding` hace `GET /onboarding`; si falla (404/red), monta `OnboardingProfileScreen` para capturar gustos y nº comensales (saltable).

Stack navigation (`AppNavigator.tsx`) con bottom tabs (Inicio → `DashboardScreen`, Despensa → `PantryScreen`, Compra → `ShoppingListScreen`, Ajustes → `SettingsScreen`) y estas Stack screens:
- `AuthScreen` — login/registro.
- `PaywallScreen` — modal fullscreen RevenueCat (presentation: fullScreenModal).
- `RecipeDetailScreen` — pasos numerados + ingredientes con checkmark + botones «Marcar cocinada»/«No me gusta».
- `PlanComidaScreen` — plan semanal 7 días (comida/cena) con `AIDisclaimerBanner` + botón regenerar.
- `HistorialScreen` — FlatList del historial de recetas con badges cocinada/rechazada + pull-to-refresh.

### Frontend design system

> Rediseño visual completo para un look nativo iOS/Android.

- **Tokens**: `src/theme/tokens.ts` — única fuente de color, tipografía, espaciado, radios y sombras. Marca índigo `#6366F1`; acento de despensa verde. No hardcodear valores en componentes/pantallas.
- **Componentes UI**: `src/components/ui/` (barrel en `index.ts`): `Screen` (safe-area + pull-to-refresh), `Card`, `Button`, `IconButton`, `Chip`, `StatCard`, `SectionHeader`, `Fab`, `Badge`, `EmptyState`, `Field`, `AppText`, `Icon`/`FoodIcon`. `LoadingView`/`ErrorView` se co-exportan desde `Feedback.tsx` (un solo fichero).
- **Iconos**: vectoriales vía `@expo/vector-icons` (Ionicons + MaterialCommunityIcons para comida). Sin emoji en la UI.
- **Animaciones**: `src/animations/index.ts` — `useFadeInFromBottom` (fade + rise, para cards y secciones async), `usePulseGlow` (loop de opacidad para badges de caducidad urgente), `FadeInView` (wrapper JSX). Usar `useNativeDriver: true` siempre.
- **Lib utilities**: `src/lib/haptics.ts` (no-op en web), `src/lib/notifications.ts` (caducidad local), `src/lib/caducidad.ts` (`getSemaforoCaducidad(dias, umbral)` — semáforo configurable), `src/lib/categoria.ts` (`getCategoriaIcon()` — icono por categoría de alimento).
- **Importante**: la UI ya **no usa NativeWind `className`**; todo es StyleSheet + tokens. NativeWind y Tailwind se **desinstalaron por completo** (deps + `global.css` + `tailwind.config.js` + `nativewind-env.d.ts` + cableado en `babel.config.js`/`metro.config.js`). No reintroducir `className` en pantallas.

### AI write policy (Pivote 2 — revised)

The AI (Gemini) **suggests by default; confirmación explícita requerida para acciones destructivas o de alto impacto** (borrar stock en bloque, eliminar cuenta). Se permiten escrituras automáticas de **bajo riesgo y reversibles** con undo visible (descontar stock estimado al terminar receta; ajustar perfil individual vía function calling al rechazar un ingrediente). El banner de transparencia IA (`AIDisclaimerBanner`) sigue siendo obligatorio donde haya generación visible.

---

## Key constraints (non-negotiable)

1. `hogar_id` always from JWT — never from client input.
2. All Pydantic schemas use `extra='forbid'`.
3. LLM temperature = 0 for all backend calls.
4. Routers return schemas, not ORM models.
5. AI writes are allowed only for low-risk reversible actions (stock depletion, profile micro-update) with visible undo. Destructive/high-impact actions always require explicit user confirmation.

---

## Environment variables (`backend/.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET_KEY` | **Yes** | — | Signs family JWT tokens; app exits at startup without it |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./asistente_hogar.db` | Dev: SQLite. Prod: `postgresql+asyncpg://...` |
| `ENVIRONMENT` | No | `development` | `production` disables `/docs`, `/redoc`, `/openapi.json` |
| `GEMINI_API_KEY` | No | — | Without it, AI features run in fallback/static mode |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Configurable Gemini model |
| `ALLOWED_ORIGINS` | No | Expo localhost origins | CORS origins (comma-separated) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `43200` (30 days) | Family JWT validity |
| `REDIS_URL` | No | — | Shared cache + rate-limit store. Without it, in-memory only (single worker). Required in production with multiple workers. |
| `REVENUECAT_SECRET_KEY` | No | — | Server-side premium gate. Without it, premium gate is disabled and AI endpoints are open (dev/test mode). |
| `REVENUECAT_ENTITLEMENT` | No | `premium` | RevenueCat entitlement ID to check |
| `REVENUECAT_FAMILIA_ENTITLEMENT` | No | `familia` | RevenueCat entitlement ID for the higher "familia" tier |
| `REVENUECAT_WEBHOOK_SECRET` | No | — | Shared secret for `POST /api/v1/webhooks/revenuecat` (RC panel → Webhooks). Endpoint returns 501 if empty. |
| `ADMIN_JWT_SECRET_KEY` | No | — | Signs admin JWT tokens. Without it, all `/admin/*` routes return 503. Generate same as `JWT_SECRET_KEY`. |
| `ADMIN_JWT_EXPIRE_MINUTES` | No | `120` (2 h) | Admin JWT validity |
| `ADMIN_BOOTSTRAP_TOKEN` | No | — | One-time token for `POST /api/v1/admin/auth/bootstrap`. Disabled (501) if empty. |
| `RUN_MIGRATIONS_ON_STARTUP` | No | — | If `true`, runs `alembic upgrade head` in a subprocess at startup (used by Railway/CI). Locally, run migrations manually. |

Generate secrets: `python -c "import secrets; print(secrets.token_hex(48))"`

---

## Database

- Dev/test: SQLite (default `DATABASE_URL` in `.env.example`)
- Production: PostgreSQL 16 via `docker-compose.yml` in `backend/`
- Migrations: Alembic in `backend/alembic/versions/`
- Business tables use soft deletes (`is_deleted = TRUE`). **Only two authorized hard-delete paths** (GDPR art. 17): the scheduled purge in `app/jobs/purge.py` (physically deletes `is_deleted=true` rows older than 30 days, daily from the FastAPI lifespan) and `DELETE /api/v1/auth/cuenta` (destroys the JWT-derived hogar + all linked data via ORM cascade, requires password re-auth). Both log aggregate evidence (no personal data) to `registros_borrado`. No other code may issue physical DELETEs.
- All timestamps stored as `TIMESTAMPTZ` (UTC)

---

## Next planned phases

**F-PIVOT — Recetas mediterráneas (completado):**
- ✅ Filosofía mediterránea española en los prompts (`_FILOSOFIA_MEDITERRANEA` en `llm.py`).
- ✅ Tabla `perfil_hogar` (migración `a1c3e5f70b92`) + `GET`/`POST /api/v1/onboarding` (gustos +
  nº comensales; intolerancias/alergias pospuestas por RGPD art. 9).
- ✅ `POST /api/v1/pantry/audio` — entrada por voz, Gemini interpreta, devuelve propuesta.
- ✅ `POST /api/v1/pantry/foto-nevera` — Gemini Vision detecta ingredientes, propuesta con confirmación (premium).
- ✅ **Pivote 2** — eliminados Eventos y Tareas; app 100% comida. Ver `ARCHITECTURE_MAP.md`.
- ✅ Perfil del hogar integrado en prompts de recetas (F-PIVOT #6): helper `_bloque_perfil` en `llm.py`.
- ✅ Historial de recetas cocinadas (tabla `recetas_historial`, migración `c2d4f6a80e04`) — mejora sugerencias.

**Fases de producto completadas:**
- ✅ **Fase 2** — `prompt_templates` + `recetario_maestro` dinámicos + panel admin Next.js (`admin-web/`).
- ✅ **Fase 3** — `perfiles_individuales`: preferencias culinarias por miembro (máx. 10/hogar, solo datos gastronómicos). CRUD completo + inyección en prompts LLM. Migración `a5b3c1d9e7f2`.

**Próxima fase pendiente:**
- ⏳ **Fase 5** — RevenueCat 3 tiers + flujos A/B/C completos. Bloqueada: requiere `REVENUECAT_SECRET_KEY`.

**Fases recientemente completadas**: Fase 4 (`rechazar-ingrediente` + inyección `recetario_maestro`), F6 (EAS Build + `eas.json` + `eas init`), Notificaciones locales de caducidad, Lista de la compra, Animaciones UI + Onboarding con hero images.

**Historial completo**: F0–F5, F-IA, F-IA-2, F-UI, F-LEGAL, F-AUDIT, F4 (Freemium/RevenueCat), F-AUDIT2 (server-side premium gate + Railway deploy), F-OCR, F-AGENDA, F-PIVOT #1–6, Pivote 2, Fase 2, Fase 3, Fase 4, F6, Notificaciones locales, Lista de la compra. Ver `CHANGELOG.md` para detalles.

## MCPs disponibles — reglas de uso automático

Cuatro MCP servers activos (scope global). Usarlos sin que el usuario tenga que pedirlo.

### context7 — documentación actualizada de librerías
**Usar SIEMPRE antes de adivinar** la API de cualquier librería o framework.

Trigger automático en cualquiera de estos casos:
- Duda sobre API de Expo SDK, React Native, expo-notifications, expo-image-picker, etc.
- Duda sobre FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Alembic.
- Error TypeScript con tipos de librería externa.
- Cualquier pregunta de tipo "¿cómo se hace X en la versión Y?".
- Antes de escribir código que dependa de una API concreta (triggers, hooks, schemas).

Flujo: `mcp__context7__resolve-library-id` → `mcp__context7__query-docs`. No más de 3 llamadas por pregunta.

### github — gestión del repositorio remoto
**Usar en lugar de `gh` CLI** para todo lo que sea GitHub (no git local).

Trigger automático en cualquiera de estos casos:
- Crear un Pull Request → `mcp__github__create_pull_request`
- Crear una issue para trackear deuda técnica o bug → `mcp__github__create_issue`
- Consultar estado de CI / checks de un PR → `mcp__github__get_pull_request_status`
- Revisar comentarios de revisión de un PR → `mcp__github__get_pull_request_comments`
- Buscar código en el repo remoto → `mcp__github__search_code`
- Añadir comentario a una issue o PR → `mcp__github__add_issue_comment`

**No usar** para operaciones git locales (commit, push, branch) — esas siguen con Bash.

### Higgsfield — generación de arte de la app
Instalado en scope user (`~/.claude.json`). Usar para generar icono, splash y adaptive-icon cuando se solicite arte.

Archivos destino:
- `frontend/assets/icon.png` (1024×1024) — icono principal
- `frontend/assets/splash.png` (1284×2778) — splash iOS
- `frontend/assets/adaptive-icon.png` (1024×1024, sin fondo) — Android adaptive

### Gmail y Google Calendar
Disponibles pero no relevantes para trabajo de desarrollo en este proyecto. No usar salvo instrucción explícita del usuario.

---

### MCPs de frontend — pendientes de instalar

| MCP | Caso de uso | Comando de instalación |
|-----|------------|----------------------|
| **Figma MCP** (`@figma/code-connect-mcp` o equiv.) | Extraer tokens de diseño, componentes y assets de Figma directamente | `claude mcp add --scope user figma -- npx -y @figma/mcp` |
| **React Native Debugger MCP** | Inspección de estado en simulador/dispositivo | Evaluar opciones cuando tengamos build nativo |
| **PostgreSQL MCP** (`sgaunet/postgresql-mcp`) | Inspección directa de BD Railway en producción | Instalar cuando Railway tenga datos reales |
| **Playwright MCP** (`@playwright/mcp`) | Tests E2E cuando haya build de producción | `claude mcp add --scope user playwright -- npx -y @playwright/mcp` |

> Los 15 **Expo skills oficiales** ya están instalados en scope global (`claude plugin install expo@claude-plugins-official`): building-native-ui, expo-deployment, upgrading-expo, native-data-fetching, expo-dev-client, etc. Se activan automáticamente por nombre de skill.

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
