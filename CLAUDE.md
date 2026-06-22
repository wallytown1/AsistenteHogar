# Guía Práctica de Desarrollo — CLAUDE.md

Este documento sirve como manual práctico de referencia rápida ("How-To") para la ejecución de comandos, el flujo de trabajo de git y las directrices de calidad de este repositorio.

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
## 🗺️ REGLAS DE ENRUTAMIENTO DE DOCUMENTACIÓN (DIÁTAXIS ENFORCEMENT)
Cada vez que crees, modifiques o consultes documentación en este repositorio, debes autorregularte y enrutar la información al archivo correcto según el framework Diátaxis:
1. ¿Es una EXPLICACIÓN (Conceptos, decisiones de diseño, arquitectura, justificación legal RGPD/AI Act)?
   👉 Enrútalo SIEMPRE a: `01_CONTEXTO_Y_ARQUITECTURA_APP.md` (Prohibido meter comandos prácticos aquí).
2. ¿Es un HOW-TO (Comandos de consola, cómo correr tests, flujos prácticos de desarrollo)?
   👉 Enrútalo SIEMPRE a: `CLAUDE.md`.
3. ¿Es el ESTADO TEMPORAL (Fases del proyecto, bugs actuales, roadmap de mejoras, historial)?
   👉 Enrútalo SIEMPRE a: `ESTADO_ACTUAL.md`.
4. ¿Es una REFERENCIA ATÓMICA (Esquemas de bases de datos, especificaciones técnicas de APIs o herramientas)?
   👉 Enrútalo a su archivo técnico: `ENDPOINTS.md` o dentro de la carpeta `.claude/skills/graphify/references/REFERENCES.md`.
[Restricción]: Queda prohibido crear nuevos archivos .md en la raíz del monorepo sin confirmación explícita del usuario.
---
