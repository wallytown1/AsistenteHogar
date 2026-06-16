# Mejoras de servicio pendientes — AsistenteHogar

Backlog resultante de la auditoría de lógica de servicios y UX realizada el 2026-06-16.
Ordenadas por impacto. Las completadas se moverán al `CHANGELOG.md`.

---

## ✅ Completadas

| # | Mejora | Rama | Commit |
|---|--------|------|--------|
| 1 | Conflictos de agenda incluidos en el briefing matutino | `feat/mejoras-servicio` | `f1d0247` |

---

## 🔴 Alto impacto

### #2 — `ultimo_completado` visible en tareas
**Problema:** cada tarea tiene `ultimo_completado: datetime | None` y `frecuencia`
(diaria/semanal/mensual) en BD, pero la UI no los usa. El usuario no sabe cuándo
completó una tarea por última vez ni cuándo toca de nuevo.

**Solución:**
- Badge "hace X días" en cada item de tarea calculado desde `ultimo_completado`.
- Cálculo de "próxima ejecución esperada" en frontend (`ultimo_completado + frecuencia`).
- Ordenar lista por proximidad de siguiente ejecución (no por fecha de creación).

**Archivos:** `frontend/src/screens/AgendaScreen.tsx` (o `TasksScreen` si se desdobla),
`frontend/src/hooks/useTasks.ts`.
**Esfuerzo:** Bajo-Medio (solo frontend, datos ya están en la API).

---

### #3 — Gate premium inconsistente entre endpoints de IA
**Problema:** `/calendar/interpretar` es gratis; `/tasks/interpretar` y
`/pantry/interpretar` son premium. No hay lógica clara documentada.

**Decisión pendiente:** ¿Toda función de IA es premium? ¿Solo las que consumen más
tokens (plan, recetas, OCR)? Acordar política y aplicar uniformemente.

**Solución (propuesta):** hacer premium los 5 endpoints de IA de forma consistente,
o explicitar en la UI cuáles son gratis con un icono diferente.

**Archivos:** `backend/app/api/routers/calendar.py` (añadir o quitar `requiere_premium`),
documentar decisión en `PRODUCCION_CHECKLIST.md`.
**Esfuerzo:** Bajo (una línea de código; la decisión es lo costoso).

---

### #4 — OCR de ticket: flujo tedioso y característica poco visible
**Problema:** el OCR está enterrado 3 niveles dentro del modal de despensa. Los alimentos
detectados se confirman uno a uno en lugar de en lote.

**Solución:**
- FAB dedicado o botón destacado en la pantalla principal de Despensa (no dentro del modal).
- Pantalla/modal de "revisión en lote": lista editable de todos los alimentos detectados
  (cantidad, categoría) y un único botón "Añadir todos" al final.

**Archivos:** `frontend/src/screens/PantryScreen.tsx`, posiblemente nueva
`frontend/src/screens/OcrReviewScreen.tsx`.
**Esfuerzo:** Medio (refactor UI + gestión de estado del lote).

---

### #5 — Plan de comidas y recetas: dos llamadas separadas, sin precarga
**Problema:** `/pantry/recetas` y `/pantry/plan-comidas` son endpoints independientes
que el usuario lanza manualmente uno a uno.

**Solución:**
- Nuevo endpoint `/pantry/sugerencias` que devuelve `{recetas, plan_comidas}` en paralelo
  (`asyncio.gather()`), misma clave de caché hash.
- Precarga en background al abrir PantryScreen si `isPremium && items.length > 0`.

**Archivos:** `backend/app/api/routers/pantry.py` (nuevo endpoint),
`backend/app/services/llm.py`, `frontend/src/hooks/usePantry.ts`.
**Esfuerzo:** Medio.

---

## 🟡 Mejoras menores (pulido)

### #6 — Duración del solapamiento no mostrada en Calendario
`ConflictoDetalle.duracion_solapamiento_segundos` se calcula pero la UI solo dice
"hay conflicto". Añadir "Solapamiento: X min" en `AgendaScreen`.
**Esfuerzo:** Bajo (<10 líneas).

### #7 — Anonimización RGPD incompleta en LLM
`generate_morning_briefing()` anonimiza nombres. `generate_meal_plan()` y
`generate_recipe_suggestions()` no. Si el plan menciona participantes, sus nombres
van directos a Gemini.
**Esfuerzo:** Bajo-Medio (extender `AnonimizadorLLM` a 2 funciones más).

### #8 — Timeouts inconsistentes entre hooks
`useDashboard` → 45 s; OCR → 60 s; CRUD pantry/calendar/tasks → 15 s (default).
Debería haber una constante por categoría de operación.
**Esfuerzo:** Bajo (constantes en `api.ts` o config).

### #9 — Umbral de stock hardcodeado (`timedelta(days=6)`)
`PantryService.get_stock_metrics()` usa 6 días fijo. Algunos hogares quieren 3 días
(compra frecuente), otros 14 (congelador).
**Esfuerzo:** Medio (nueva tabla `HogarSettings` o campo en `Hogar` + migración).

---

## 📋 Notas

- Los items #2–#5 son los de mayor retorno sobre esfuerzo.
- Los items #6–#9 pueden agruparse en un único PR de pulido.
- Ninguno de estos cambios toca la arquitectura ni el modelo de datos principal
  (salvo #9, que requiere migración).
- Actualizar este archivo al completar cada mejora y mover la entrada a CHANGELOG.
