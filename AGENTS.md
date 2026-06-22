# AGENTS.md

> **How-To operativo**: comandos de consola, flujo git y directrices de calidad de este monorepo.
> Para arquitectura/conceptos → `01_CONTEXTO_Y_ARQUITECTURA_APP.md`. Para estado/roadmap → `ESTADO_ACTUAL.md`.

---

## 1. Comandos de Consola Rápidos

### 1.1 Backend (FastAPI + SQLAlchemy)

```bash
cd backend

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables locales (crear a partir del ejemplo)
cp .env.example .env

# Levantar base de datos PostgreSQL local (opcional)
docker-compose up -d

# Correr migraciones de base de datos locally
uv run alembic upgrade head

# Generar una nueva migración (autodetectada)
uv run alembic revision --autogenerate -m "descripcion"

# Poblar base de datos con el catálogo maestro (idempotente)
uv run python seed_recetario.py

# Ejecutar el servidor de desarrollo local (SQLite por defecto)
uv run uvicorn app.main:app --reload
```

### 1.2 Frontend (Expo + React Native)

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor Expo de desarrollo
npm start

# Ejecutar en emulador específico
npm run android
npm run ios

# Comprobación de tipos (TypeScript)
npm run ts:check

# Linter y formateo
npm run lint
npm run format
```

### 1.3 Panel de Administración (Next.js)

```bash
cd admin-web

# Instalar dependencias
npm install

# Correr en modo desarrollo
npm run dev

# Compilar build de producción local
npm run build

# Comprobación estática de TypeScript
npm run ts:check
```

---

## 2. Control de Calidad y Pruebas de Humo (Smoke Tests)

### 2.1 Ejecución Manual de Pruebas de Humo
Cada test suite levanta una base de datos temporal SQLite para evitar colisiones:

```bash
cd backend

# Ejecutar todos los smoke tests secuencialmente (PowerShell)
Get-ChildItem -Filter smoke_test_*.py | ForEach-Object { uv run python $_.Name }

# O bien, de forma individual:
uv run python smoke_test_auth.py
uv run python smoke_test_modules.py
uv run python smoke_test_dashboard.py
uv run python smoke_test_validation.py
uv run python smoke_test_legal.py
uv run python smoke_test_admin.py
uv run python smoke_test_perfiles.py
uv run python smoke_test_lista_compra.py
uv run python smoke_test_rechazar_ingrediente.py
uv run python smoke_test_chef.py
uv run python smoke_test_movimientos.py
uv run python smoke_test_lista_inteligente.py
uv run python smoke_test_confianza.py
```

### 2.2 Escudo de Calidad (Husky + pre-commit)
- Los commits ejecutan de forma automática la revisión antes de confirmarse.
- **Frontend**: Ejecuta `lint-staged` (TypeScript + ESLint + Prettier sobre archivos staged).
- **Backend**: Ejecuta el framework `pre-commit` (Ruff + Mypy).
- Para ejecutar manualmente el escudo en todo el backend:
  ```bash
  uv run pre-commit run --all-files
  ```
- **Nota**: No ejecutar `pre-commit install`, ya que sobreescribiría la configuración de Husky (`core.hooksPath`).

---

## 3. Git Workflow (Git Flow)

Este proyecto sigue estrictamente el flujo de trabajo **Git Flow**. Todo desarrollo por agentes IA o colaboradores humanos debe seguir estas directrices:

### 3.1 Ramas Principales
*   **`main`**: Código estable actualmente en producción. Cada merge a `main` debe ser etiquetado con su tag correspondiente (ej. `v1.0.0`).
*   **`develop`**: Rama de integración central. Reúne las nuevas características terminadas antes del empaquetado y lanzamiento.

### 3.2 Ramas de Soporte (Temporales)
*   **Funcionalidades (`feat/<nombre-funcionalidad>`)**:
    *   Origen: `develop`.
    *   Destino: `develop` (a través de un Pull Request revisado).
    *   Flujo: `git checkout develop && git pull origin develop` -> `git checkout -b feat/mi-funcionalidad` -> Confirmar commits -> Subir -> Crear PR.
*   **Correcciones Urgentes (`fix/<descripcion-corta>`)**:
    *   Origen: `main`.
    *   Destino: `main` (con incremento de tag) y `develop`.
    *   Propósito: Parchear bugs críticos en producción que no admiten esperar al ciclo de release regular.
*   **Preparación de entregas (`release/v<version>`)**:
    *   Origen: `develop`.
    *   Destino: `main` y `develop`.

### 3.3 Commits Convencionales (Conventional Commits)
Los mensajes de commit deben mantener un formato estricto y atómico:
-   `feat(modulo): <descripcion corta en minúsculas>` (nuevas funcionalidades).
-   `fix(modulo): <descripcion corta>` (resolución de bugs).
-   `docs(modulo): <descripcion>` (cambios en documentación).
-   `refactor(modulo): <descripcion>` (refactorización sin cambio funcional).

> [!WARNING]
> **Prohibido realizar commits directos a `main` o a `develop`**: Toda propuesta de cambio del asistente debe ser subida a una rama de soporte remota, dejando al desarrollador humano el control de la revisión y fusión del PR.

---

## 4. Directrices de Uso de Graphify

Este proyecto cuenta con un grafo de conocimiento en `graphify-out/` que mapea relaciones y cross-files.

*   **Consultas conceptuales**: Antes de analizar a ciegas el código, usa Graphify para ver dependencias:
    *   `graphify query "<pregunta>"` (consultar dudas generales).
    *   `graphify path "<A>" "<B>"` (ver relaciones y dependencias entre ficheros).
    *   `graphify explain "<concepto>"` (explicación enfocada).
*   **Broad Navigation**: Si existe `graphify-out/wiki/index.md`, utilízalo para navegar de forma panorámica.
*   **Mantenimiento del Grafo**: Tras modificar o añadir código fuente, ejecuta inmediatamente el comando de actualización (sin coste de tokens/API):
    ```bash
    graphify update .
    ```

---

## 5. Directrices sobre Servidores MCP

*   **context7 (Documentación de Librerías)**: Utilízalo antes de adivinar firmas de métodos o tipos del Expo SDK, FastAPI, SQLAlchemy 2.0 o Pydantic v2.
*   **github**: Usa el plugin de github para la creación de Pull Requests, issues y revisión de checks del CI de GitHub Actions, evitando el uso redundante del CLI de `gh`.
*   **Higgsfield (Generador de Arte)**: Utilízalo para generar o rediseñar activos de imagen en `frontend/assets/` (splash, icon, adaptive-icon) bajo demanda.

---

## 6. Contexto del Proyecto para el Agente IA

> Esta sección contiene instrucciones y restricciones que el agente IA debe conocer para trabajar
> correctamente. **No es documentación Diátaxis** — es contexto operativo cargado en cada sesión.
> El detalle completo está en `01_CONTEXTO_Y_ARQUITECTURA_APP.md` y `ESTADO_ACTUAL.md`.

### 6.1 Descripción del producto

**Asistente del Hogar IA** — app de cocina familiar centrada en la generación de recetas mediterráneas
españolas tradicionales y de aprovechamiento a partir del stock real de la despensa.
Filosofía gastronómica estricta: sofritos, ingredientes frescos, temporada; sin fusiones incorrectas.

> **Pivote 2 (2026-06-18):** la app es **exclusivamente de comida, stock y recetas**.
> Los módulos Eventos y Tareas fueron eliminados. **No reintroducir nada relacionado.**

Stack: React Native (Expo SDK 54) · FastAPI + SQLAlchemy 2.0 async · PostgreSQL (SQLite dev/test).
Idioma: español en toda la UI, logs y respuestas IA.

### 6.2 Restricciones no negociables

1. **`hogar_id` siempre del JWT** — nunca de cabeceras ni del body del cliente. Se extrae en
   `backend/app/api/deps.py → get_hogar_id()`. Romper esta regla crea una fuga de datos multi-tenant.
2. **Todos los schemas Pydantic usan `extra='forbid'`** — extendidos de `BaseSchema`. Nunca añadir
   `extra='allow'` ni saltar la validación.
3. **Temperatura LLM = 0** en todas las llamadas al backend (Gemini).
4. **Routers devuelven schemas Pydantic**, nunca instancias ORM.
5. **Escrituras IA solo para acciones de bajo riesgo y reversibles** (descontar stock estimado,
   ajuste de perfil) con undo visible. Acciones destructivas o de alto impacto requieren confirmación
   explícita del usuario.

### 6.3 Arquitectura (resumen operativo)

```
Router (api/routers/) → Service (services/) → Repository (repositories/) → SQLAlchemy models
```

- Dependency injection vía `FastAPI Depends()` definido en `api/deps.py`.
- Excepciones tipadas en `repositories/exceptions.py`; mapeadas a HTTP en `main.py`.
- Aislamiento multi-tenant: cada método de repositorio recibe `hogar_id: UUID` obligatorio.

### 6.4 LLM — puntos críticos

- **Persona unificada `_PERSONA_CHEF`** ("Marce") — inyectada en `PromptConfigService.get_system_instruction()`
  y en ramas fallback. No remover.
- **`_FILOSOFIA_MEDITERRANEA`** — guard final no removible en todos los prompts de recetas/plan.
- **`memoria_gustos`** (tabla, 1/hogar): resumen NL destilado con Gemini. Se inyecta vía
  `_bloque_memoria_gustos()` en sugerencias, plan y chat. `MemoriaService` la recalcula best-effort
  tras ≥5 señales gastronómicas nuevas o >7 días.
- **`movimientos_despensa`** (ledger): hábitos de compra/consumo → `distill_taste_memory()` los
  incorpora al resumen. El ledger crudo **nunca** va al prompt.
- **Chat chef**: el servidor NO persiste texto del chat (RGPD). El cliente reenvía los últimos turnos
  (máx. 12); la continuidad de largo plazo vive en `memoria_gustos`.
- Sin API key: todas las funciones devuelven fallback estático — la app funciona sin clave.

### 6.5 Estado de fases (actualizar en ESTADO_ACTUAL.md)

**Completado (CI verde, Fase 3 terminada):**
- Chef amigo: `_PERSONA_CHEF`, `memoria_gustos`, `POST /chef/chat`, `ChefChatScreen`.
- Stock Fase 1: ledger `movimientos_despensa` + hábitos en memoria destilada.
- Stock Fase 2A: `GET /lista-compra/sugerencias` (cadencia, sin IA).
- Stock Fase 2B: `ultima_confirmacion` + `incierto` + `agotar`/`confirmar` de un toque.
- Chat accionable y Cupo Freemium: structured output `platos`, descuento automático de stock, límite `CHEF_FREE_DAILY_LIMIT` de 5 mensajes/día, y upsell a `PaywallScreen` en error 402.
- Briefing Personalizado: inyección de memoria destilada en el saludo matutino del Dashboard.
- Voz al Chef: botón hold-to-talk, API `POST /chef/transcribe` base64 y soporte nativo de audio en Gemini.
- Chef Proactivo: notificaciones push locales generadas por IA, programación diaria vía `expo-notifications`, deep-linking y bienvenida contextual.

**Próximo paso — Fase 5: Integración Comercial y Publicación:**
- Definir `REVENUECAT_SECRET_KEY` en producción (Railway) para cerrar el gate premium.
- Configurar productos y offerings en App Store Connect, Google Play Console y RevenueCat.
- Realizar las builds nativas finales de producción y EAS Submit.

### 6.6 Variables de entorno clave (backend)

| Variable | Requerida | Propósito |
|---|---|---|
| `JWT_SECRET_KEY` | **Sí** | Firma tokens JWT de familia; la app no arranca sin ella |
| `DATABASE_URL` | No | Dev: SQLite. Prod: `postgresql+asyncpg://...` |
| `GEMINI_API_KEY` | No | Sin ella, IA en modo fallback estático |
| `ADMIN_JWT_SECRET_KEY` | No | Firma tokens admin; sin ella `/admin/*` devuelve 503 |
| `ADMIN_BOOTSTRAP_TOKEN` | No | Token one-time para crear el primer admin |
| `REVENUECAT_SECRET_KEY` | No | Gate premium server-side; sin ella endpoints IA son abiertos |
| `REVENUECAT_WEBHOOK_SECRET` | No | Valida webhooks RC; sin ella el endpoint devuelve 501 |
| `REDIS_URL` | No | Caché compartida + rate-limit; sin ella solo memoria (1 worker) |

Generar secretos: `python -c "import secrets; print(secrets.token_hex(48))"`

---

## 🗺️ REGLAS DE ENRUTAMIENTO DE DOCUMENTACIÓN (DIÁTAXIS ENFORCEMENT)
Cada vez que crees, modifiques o consultes documentación en este repositorio, debes autorregularte y enrutar la información al archivo correcto según el framework Diátaxis:
1. ¿Es una EXPLICACIÓN (Conceptos, decisiones de diseño, arquitectura, justificación legal RGPD/AI Act)?
   👉 Enrútalo SIEMPRE a: `01_CONTEXTO_Y_ARQUITECTURA_APP.md` (Prohibido meter comandos prácticos aquí).
2. ¿Es un HOW-TO (Comandos de consola, cómo correr tests, flujos prácticos de desarrollo)?
   👉 Enrútalo SIEMPRE a: `AGENTS.md`.
3. ¿Es el ESTADO TEMPORAL (Fases del proyecto, bugs actuales, roadmap de mejoras, historial)?
   👉 Enrútalo SIEMPRE a: `ESTADO_ACTUAL.md`.
4. ¿Es una REFERENCIA ATÓMICA (Especificaciones técnicas de APIs/endpoints)?
   👉 Enrútalo a: `ENDPOINTS.md`.
5. ¿Es POSTURA DE SEGURIDAD (modelo de autenticación, rate limits, prompt injection, riesgos
   aceptados, contacto de divulgación responsable)?
   👉 Enrútalo a: `SECURITY.md` (fichero estándar de GitHub; la justificación legal RGPD/AI Act
   de alto nivel va en `01_CONTEXTO_Y_ARQUITECTURA_APP.md §5`).
6. ¿Es el CHANGELOG detallado (entradas fechadas por área/tipo)?
   👉 Enrútalo a: `CHANGELOG.md` (historial pre-2026-06-11 en `CHANGELOG_ARCHIVE.md`).

> **Nota:** los ficheros bajo `.Codex/skills/graphify/references/` son documentación interna de
> la skill graphify (referenciada por path exacto desde `SKILL.md`). **No tocar ni consolidar.**

[Restricción]: Queda prohibido crear nuevos archivos .md en la raíz del monorepo sin confirmación explícita del usuario.
---
