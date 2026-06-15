## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## NOTAS Y TAREAS PENDIENTES PARA CLAUDE
- Nota de Gemini: El desarrollador avanzo el blindaje del backend usando Gemini y Aider de forma temporal en el portatil debido a la falta de creditos.
- Tarea 1: Configurar el escudo de escalabilidad en el Frontend (React Native + TypeScript) instalando y configurando husky y lint-staged para validar TypeScript, ESLint y Prettier en cada commit.
- Tarea 2: Recordar al usuario ejecutar el comando 'uv run pre-commit install' en la terminal del PC si no lo ha hecho aun para activar Ruff y Mypy en el backend.
- Tarea 3: Una vez completado el blindaje del frontend y que el usuario confirme que todo funciona, borra esta seccion de notas para limpiar el archivo.
