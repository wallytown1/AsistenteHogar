## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Git Workflow (Git Flow) para Asistentes IA y Desarrolladores

El proyecto implementa de manera estricta el flujo de trabajo **Git Flow**. Todo desarrollo de Inteligencia Artificial (y colaboradores humanos) debe seguir rigurosamente estas pautas para mantener un historial limpio, trazable y seguro.

### 1. Ramas Principales (De larga duración)
*   **`main`**: Representa el código en producción actual, el cual es siempre estable. Cada merge a `main` debe ser etiquetado con su versión correspondiente (ej. `v1.0.0`).
*   **`develop`**: Es la rama de integración central para todo el desarrollo activo. Aquí se reúnen las nuevas funcionalidades terminadas para la próxima versión.

### 2. Ramas de Soporte (Temporales)

#### A. Funcionalidades (`feature/*`)
*   **Propósito**: Desarrollar nuevas características o mejoras.
*   **Origen**: `develop`
*   **Destino**: `develop` (a través de un Pull Request/Merge Request aprobado).
*   **Nomenclatura**: `feat/<nombre-funcionalidad>` (ej. `feat/ocr-tickets`).
*   **Flujo de trabajo**:
    1.  Crear rama local: `git checkout develop && git pull origin develop` y luego `git checkout -b feat/mi-funcionalidad`.
    2.  Hacer commits atómicos y claros.
    3.  Subir cambios: `git push origin feat/mi-funcionalidad`.
    4.  Crear Pull Request hacia `develop`.

#### B. Correcciones Urgentes (`hotfix/*`)
*   **Propósito**: Solucionar errores críticos en producción (`main`) que no pueden esperar a la próxima release en `develop`.
*   **Origen**: `main`
*   **Destino**: Tanto `main` (con tag de versión incrementado) como `develop`.
*   **Nomenclatura**: `fix/<descripcion-corta>` (ej. `fix/api-timeout-produccion`).
*   **Flujo de trabajo**:
    1.  Crear desde producción: `git checkout main && git pull origin main` y luego `git checkout -b fix/mi-fix`.
    2.  Aplicar y probar la corrección.
    3.  Integrar en `main` (creando un tag, ej. `v1.0.1`) y también en `develop` para asegurar que el desarrollo futuro conserve el arreglo.

#### C. Preparación de Versiones (`release/*`)
*   **Propósito**: Preparar y pulir una nueva versión de entrega. Permite corregir pequeños fallos de QA y ajustar metadatos sin detener las nuevas características que se siguen desarrollando en `develop`.
*   **Origen**: `develop`
*   **Destino**: Tanto `main` (con su tag) como `develop`.
*   **Nomenclatura**: `release/v<version>` (ej. `release/v1.1.0`).

---

### 3. Buenas Prácticas del Proyecto
*   **Commits Convencionales (Conventional Commits)**: Los mensajes de commit deben seguir el estándar:
    *   `feat(modulo): <descripcion corta en minuscula>` para nuevas funcionalidades.
    *   `fix(modulo): <descripcion corta en minuscula>` para resolución de bugs.
    *   `docs(modulo): <descripcion>` para cambios en documentación.
    *   `refactor(modulo): <descripcion>` para reorganización de código sin cambios funcionales.
*   **Commits Atómicos**: Un commit debe representar un cambio conceptual único y pequeño.
*   **No hacer commits directamente a `main` ni a `develop`**: Todo cambio propuesto por el asistente IA debe crearse en una rama separada (`feat/*` o `fix/*`) y subirse al origen remoto para que el usuario sea el encargado de revisar y fusionar.
*   **Limpieza posterior**: Al terminar y fusionar una rama de soporte, se debe eliminar tanto localmente como en el repositorio remoto.
