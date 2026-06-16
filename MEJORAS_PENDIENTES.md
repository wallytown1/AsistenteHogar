# Mejoras de servicio pendientes — AsistenteHogar

Backlog resultante de la auditoría de lógica de servicios y UX realizada el 2026-06-16.
Ordenadas por impacto. Las completadas se moverán al `CHANGELOG.md`.

---

## ✅ Completadas

| # | Mejora | Rama | Commit |
|---|--------|------|--------|
| 1 | Conflictos de agenda incluidos en el briefing matutino | `feat/mejoras-servicio` | `f1d0247` |
| 2 | `ultimo_completado` visible en tareas: badge, próxima ejecución, orden por urgencia | `feat/mejoras-servicio` | `9a591f5` |
| 3 | Gate premium consistente: `requiere_premium` añadido a `/calendar/interpretar` | `feat/mejoras-servicio` | `e7ed746` |
| 4 | OCR de ticket: FAB dedicado + modal de revisión en lote con checkboxes | `feat/mejoras-servicio` | `b81ee99` |
| 5 | Endpoint `/pantry/sugerencias` unificado (`asyncio.gather`) + precarga en background | `feat/mejoras-servicio` | `9b938dd` |
| 6 | Duración del solapamiento visible en Calendario: "Solapamiento: X min" | `feat/mejoras-servicio` | pendiente |
| 7 | Anonimización RGPD en `generate_recipe_suggestions`/`generate_meal_plan` | N/A | — |
| 8 | Timeouts consistentes: constante `TIMEOUT` exportada desde `api.ts` | `feat/mejoras-servicio` | pendiente |

> **Nota #7:** Falso positivo. `generate_recipe_suggestions()` y `generate_meal_plan()` solo reciben
> `InventarioAlimentoResponse` (nombres de alimentos como "leche", "manzanas"), nunca `asignado_a`
> ni `participantes`. No hay datos personales que anonimizar en esas rutas.

---

## 🟡 Pendiente

### #9 — Umbral de stock hardcodeado (`timedelta(days=6)`)
`PantryService.get_stock_metrics()` usa 6 días fijo. Algunos hogares quieren 3 días
(compra frecuente), otros 14 (congelador).
**Esfuerzo:** Medio (nueva tabla `HogarSettings` o campo en `Hogar` + migración Alembic).
**Decisión:** Diferido a F6 o fase posterior; requiere diseño del modelo de configuración por hogar.

---

## 📋 Notas

- El bloque de pulido (#6–#9) queda cerrado salvo #9 que requiere migración.
- Rama `feat/mejoras-servicio` lista para PR → `main` una vez validado.
- Actualizar este archivo al completar cada mejora y mover la entrada a CHANGELOG.
