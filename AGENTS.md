## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Git Workflow para Asistentes IA

El proyecto usa **ramas por feature/fix**, no por agente. Así se evitan conflictos cuando dos agentes
tocan los mismos archivos y el historial queda semánticamente limpio.

### Reglas

- **Una tarea = una rama.** Nombrar `feat/<descripcion>`, `fix/<descripcion>` o `chore/<descripcion>`.
- **Partir siempre de `main` actualizado** (`git checkout main && git pull && git checkout -b feat/mi-tarea`).
- **No commitear directamente a `main`** salvo que el usuario lo ordene explícitamente para un merge/PR.
- **Hacer push de la rama** al terminar; el usuario decide cuándo integrar a `main`.
- **Antes de empezar**, revisar qué ramas hay abiertas para no solaparse en los mismos archivos.
- **Repartir por área** cuando sea posible (backend vs. frontend) para minimizar conflictos.
- **Mergear a `main` con frecuencia** — ciclos cortos evitan divergencias largas.

### Ramas activas (2026-06-16)

| Rama | Agente | Contenido |
|------|--------|-----------|
| `feat/admin-web` | Gemini | Panel de administración god-mode (React + Vite) |
| `feat/mejoras-servicio` | Claude | Mejoras UX de servicios (auditoría 2026-06-16) |
| `fix/api-timeout` | Claude | Fix regresión timeout en `api.ts` |
