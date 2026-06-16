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

El proyecto utiliza un flujo de trabajo basado en ramas separadas para evitar colisiones entre distintos asistentes de Inteligencia Artificial.

Reglas:
- **Claude**: Debes trabajar única y exclusivamente en la rama `claude`. Asegúrate de estar en esta rama y hacer `git push origin claude` tras tus cambios.
- **Gemini / Antigravity**: Debes trabajar única y exclusivamente en la rama `gemini`. Asegúrate de estar en esta rama y hacer `git push origin gemini` tras tus cambios.
- **No commitear a `main`**: Ningún agente debe hacer push directo a `main` a menos que se le ordene explícitamente realizar una Pull Request o un merge de una funcionalidad finalizada.
