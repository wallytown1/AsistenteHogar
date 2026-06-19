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

# Smoke tests (each uses its own separate temp SQLite DB)
python smoke_test_auth.py       # auth + multi-tenant isolation (12 checks)
python smoke_test_modules.py    # pantry CRUD + AI endpoints (recetas, audio, foto-nevera, plan), onboarding, historial, isolation
python smoke_test_dashboard.py  # dashboard aggregation/filtering + isolation (19 checks)
python smoke_test_validation.py # endpoint error contract: 400/401/404/422 (20 checks)
python smoke_test_legal.py      # GDPR purge, account deletion, LLM anonymization (26 checks)

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
```

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

Seven Gemini functions, all via the shared `_call_gemini` helper (temperature=0, thinkingBudget=0):
`generate_morning_briefing`, `generate_recipe_suggestions`, `interpret_pantry_text` (multi-item),
`analyze_fridge_photo` (Vision), `suggest_food_metadata`, `generate_meal_plan`, `interpret_audio_text`.
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
- **API calls**: `src/api/api.ts` — adds `Authorization: Bearer <token>` to every request automatically.
- **Feature hooks**: `src/hooks/use{Dashboard,Pantry}.ts` — fetch data and expose loading/error state to screens.

### Frontend design system

> Rediseño visual completo para un look nativo iOS/Android.

- **Tokens**: `src/theme/tokens.ts` — única fuente de color, tipografía, espaciado, radios y sombras. Marca índigo `#6366F1`; acento de despensa verde. No hardcodear valores en componentes/pantallas.
- **Componentes UI**: `src/components/ui/` (barrel en `index.ts`): `Screen` (safe-area + pull-to-refresh), `Card`, `Button`, `IconButton`, `Chip`, `StatCard`, `SectionHeader`, `Fab`, `Badge`, `EmptyState`, `Field`, `AppText`, `Icon`/`FoodIcon`, `LoadingView`/`ErrorView`.
- **Iconos**: vectoriales vía `@expo/vector-icons` (Ionicons + MaterialCommunityIcons para comida). Sin emoji en la UI.
- **Haptics**: `src/lib/haptics.ts` — wrapper seguro sobre `expo-haptics` (no-op en web).
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
| `JWT_SECRET_KEY` | **Yes** | — | Signs JWT tokens; app exits at startup without it |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./asistente_hogar.db` | Dev: SQLite. Prod: `postgresql+asyncpg://...` |
| `ENVIRONMENT` | No | `development` | `production` disables `/docs`, `/redoc`, `/openapi.json` |
| `GEMINI_API_KEY` | No | — | Without it, AI features run in fallback/static mode |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Configurable Gemini model |
| `ALLOWED_ORIGINS` | No | Expo localhost origins | CORS origins (comma-separated) |

Generate a `JWT_SECRET_KEY`: `python -c "import secrets; print(secrets.token_hex(48))"`

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

**Próximas fases:**
- ⏳ **Fase 4** — Inyección del `recetario_maestro` en prompts vía Gemini context caching + function calling (ajuste de perfil al rechazar ingredientes).
- ⏳ **Fase 5** — RevenueCat 3 tiers + flujos A/B/C completos. Bloqueada: requiere `REVENUECAT_SECRET_KEY`.
- ⏳ **F6 — EAS Build**: production build con EAS, iconos/splash reales, plugin `expo-notifications` + permisos de micrófono y cámara en `app.json`, App Store Connect + Google Play.

**Completed phases (summary)**: F0–F5, F-IA, F-IA-2, F-UI, F-LEGAL, F-AUDIT, F4 (Freemium/RevenueCat), F-AUDIT2 (server-side premium gate + Railway deploy), F-OCR, F-AGENDA, F-PIVOT #1–6, Pivote 2, Fase 2, Fase 3. See `CHANGELOG.md` for details.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
