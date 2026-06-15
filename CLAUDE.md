# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Asistente del Hogar IA** — a family household management app with an AI assistant (Gemini 2.5-flash). Single family account model (multi-tenant isolation by `hogar_id` derived from JWT). Language: Spanish throughout (UI, logs, AI responses).

Stack: React Native (Expo SDK 54) frontend (UI styled with StyleSheet + design tokens; NativeWind v4 still installed but no longer used for styling), FastAPI + SQLAlchemy 2.0 async backend, PostgreSQL (SQLite for dev/tests).

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
python smoke_test_modules.py    # pantry/calendar/tasks CRUD + AI endpoints, validation, isolation (43 checks)
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
python smoke_test_modules.py     # 43/43 must pass
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
`generate_morning_briefing`, `generate_recipe_suggestions`, `interpret_event_text`,
`interpret_task_text`, `interpret_pantry_text` (multi-item), `suggest_food_metadata`, `generate_meal_plan`.
The `interpret_*` and `suggest_*` functions use Gemini structured output (`responseSchema`) and follow
the **AI-passive** rule: they return a proposal the user must confirm before any write. Results that are
expensive are cached in-process with TTL (briefing 30 min, recipes/meal plan 1–2 h); the cache key is a
SHA-256 hash of the prompt data. When `GEMINI_API_KEY` is absent, all functions return static fallback
responses — the app works without a key.

**`_call_gemini` infrastructure**: a single shared `httpx.AsyncClient` (keep-alive pool, closed in the
app lifespan via `aclose_http_client`), bounded retry with backoff on transient errors (429/5xx/network),
and `_extract_text` that distinguishes safety blocks / missing candidates / `MAX_TOKENS` truncation.
The AI endpoints are rate-limited (see `core/rate_limit.py`): `/{calendar,tasks,pantry}/interpretar` share
20/5 min, `/pantry/recetas` 20/h, `/pantry/sugerir-metadata` 40/5 min, `/pantry/plan-comidas` 10/h.

**Gemini data-tier compliance (RGPD)**: the `GEMINI_API_KEY` must belong to a **billing-enabled** Google AI
project (where prompts are NOT used to improve Google's products) or Vertex AI with a DPA / EU region. The
free tier may use prompts for product improvement, which is not acceptable for household personal data.

**LLM anonymization (`services/privacy.py`)**: family names (from structured fields `asignado_a`/`participantes`) are replaced with `Familiar_N` tokens before the briefing prompt leaves for Gemini, and restored in the response. Critical ordering: the cache key is hashed over the *anonymized* prompt and the cached value is the *anonymized* response — reversal always happens after the cache. `generate_morning_briefing` returns `(text, generado_por_ia)`; the flag drives the AI transparency banner (`AIDisclaimerBanner`) in the frontend, which must never label the static fallback as AI.

### Pydantic schemas (`schemas/schemas.py`)

All schemas extend `BaseSchema` which enforces `extra='forbid'` globally. The pattern for each entity: `XCreate` / `XUpdate` / `XResponse`. Validators use `@field_validator` (Pydantic v2 syntax). Never add `extra='allow'` or bypass validation.

### Frontend state

- **Auth**: Zustand store at `src/state/authStore.ts` — holds JWT token, user, and hogar. Persists to `expo-secure-store` (encrypted). On app boot, `hydrate()` restores the session before rendering.
- **API calls**: `src/api/api.ts` — adds `Authorization: Bearer <token>` to every request automatically.
- **Feature hooks**: `src/hooks/use{Dashboard,Pantry,Calendar}.ts` — fetch data and expose loading/error state to screens.

### Frontend design system

> Rediseño visual completo para un look nativo iOS/Android.

- **Tokens**: `src/theme/tokens.ts` — única fuente de color, tipografía, espaciado, radios y sombras. Marca índigo `#6366F1`; acentos por módulo (despensa verde, calendario índigo, tareas ámbar). No hardcodear valores en componentes/pantallas.
- **Componentes UI**: `src/components/ui/` (barrel en `index.ts`): `Screen` (safe-area + pull-to-refresh), `Card`, `Button`, `IconButton`, `Chip`, `StatCard`, `SectionHeader`, `Fab`, `Badge`, `EmptyState`, `Field`, `AppText`, `Icon`/`FoodIcon`, `LoadingView`/`ErrorView`.
- **Iconos**: vectoriales vía `@expo/vector-icons` (Ionicons + MaterialCommunityIcons para comida). Sin emoji en la UI.
- **Haptics**: `src/lib/haptics.ts` — wrapper seguro sobre `expo-haptics` (no-op en web).
- **Importante**: la UI ya **no usa NativeWind `className`**; todo es StyleSheet + tokens. NativeWind sigue instalado (babel preset + `global.css`) pero no se usa para estilar. No reintroducir `className` en pantallas.

### AI passive rule

The AI (Gemini) **only suggests; it never writes to the database**. The `interpret_event_text` function returns a proposed event that the user must confirm in the UI before a `POST /api/v1/calendar/eventos` is made. Do not add any LLM call that directly mutates data.

---

## Key constraints (non-negotiable)

1. `hogar_id` always from JWT — never from client input.
2. All Pydantic schemas use `extra='forbid'`.
3. LLM temperature = 0 for all backend calls.
4. Routers return schemas, not ORM models.
5. AI is passive: suggests only, user confirms before any write.

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

## Next planned phase

**F4 — Freemium**: RevenueCat IAP integration (iOS/Android) + free vs premium limits in the backend. Not started. See `ESTADO_ACTUAL.md` for full phase history.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
