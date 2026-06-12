# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Asistente del Hogar IA** — a family household management app with an AI assistant (Gemini 2.5-flash). Single family account model (multi-tenant isolation by `hogar_id` derived from JWT). Language: Spanish throughout (UI, logs, AI responses).

Stack: React Native (Expo SDK 54) + NativeWind v4 frontend, FastAPI + SQLAlchemy 2.0 async backend, PostgreSQL (SQLite for dev/tests).

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
python smoke_test_modules.py    # pantry/calendar/tasks CRUD, validation, isolation (30 checks)
python smoke_test_dashboard.py  # dashboard aggregation/filtering + isolation (20 checks)
python smoke_test_validation.py # endpoint error contract: 400/401/404/422 (16 checks)
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

### Verification before any change

```bash
# Backend
cd backend
python smoke_test_auth.py        # 12/12 must pass
python smoke_test_modules.py     # 30/30 must pass
python smoke_test_dashboard.py   # 20/20 must pass
python smoke_test_validation.py  # 16/16 must pass

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

Three Gemini functions: `generate_morning_briefing`, `generate_recipe_suggestions`, `interpret_event_text`. All use temperature=0 and thinkingBudget=0. Results are cached in-process with TTL (30 min briefing, 60 min recipes). Each cache key is a SHA-256 hash of the prompt data, so any real data change invalidates the entry automatically. When `GEMINI_API_KEY` is absent, all three functions return static fallback responses — the app works without a key.

### Pydantic schemas (`schemas/schemas.py`)

All schemas extend `BaseSchema` which enforces `extra='forbid'` globally. The pattern for each entity: `XCreate` / `XUpdate` / `XResponse`. Validators use `@field_validator` (Pydantic v2 syntax). Never add `extra='allow'` or bypass validation.

### Frontend state

- **Auth**: Zustand store at `src/state/authStore.ts` — holds JWT token, user, and hogar. Persists to `expo-secure-store` (encrypted). On app boot, `hydrate()` restores the session before rendering.
- **API calls**: `src/api/api.ts` — adds `Authorization: Bearer <token>` to every request automatically.
- **Feature hooks**: `src/hooks/use{Dashboard,Pantry,Calendar}.ts` — fetch data and expose loading/error state to screens.

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
- All tables use soft deletes (`is_deleted = TRUE`), no hard deletes
- All timestamps stored as `TIMESTAMPTZ` (UTC)

---

## Next planned phase

**F4 — Freemium**: RevenueCat IAP integration (iOS/Android) + free vs premium limits in the backend. Not started. See `ESTADO_ACTUAL.md` for full phase history.
