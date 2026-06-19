# Mejoras pendientes — AsistenteHogar

Backlog actualizado tras el **pivote estratégico (2026-06-17)** a recetas mediterráneas españolas.
Ordenadas por prioridad. Las completadas se registran en `CHANGELOG.md`.

> **Arquitectura del motor de recetas (decidida 2026-06-18): HÍBRIDA.**
> Fase 1 (en curso): generativo (Gemini) + personalización por perfil (#6 ✅) + aprendizaje por
> historial de comportamiento (#5). Fase 2: sembrar un recetario base canónico (cientos de platos
> tradicionales) como ancla de calidad. Fase 3: recomendador sobre ambos. Objetivo: experiencia
> totalmente personalizada que aprende del comportamiento del hogar. Sourcing del catálogo (Fase 2)
> es un proyecto de datos aparte (licencia/calidad), no solo código.

---

## 🔴 F-PIVOT — Alta prioridad (bloquean el nuevo enfoque)

### #1 — Filosofía mediterránea española en prompts LLM ✅ COMPLETADO (2026-06-17)
`backend/app/services/llm.py` — constante `_FILOSOFIA_MEDITERRANEA` inyectada en
`generate_recipe_suggestions` y `generate_meal_plan`. Fuente única para que ambos prompts
no se desincronicen y la restricción sobreviva refactorizaciones. Ver `CHANGELOG.md`.

### #2 — Perfil de hogar (onboarding) ✅ COMPLETADO (2026-06-18)
Tabla `perfil_hogar` (migración `a1c3e5f70b92`) + `GET`/`POST /api/v1/onboarding` (upsert,
hogar_id del JWT) + `OnboardingProfileScreen` con gate en `AppNavigator`. **Solo datos NO
sensibles** (`gustos_culinarios`, `num_comensales`); las alergias/intolerancias (datos de
salud, RGPD art. 9) se posponen a una iteración con consentimiento explícito. Ver `CHANGELOG.md`.
La integración del perfil en los prompts de recetas es el #6. **Pendiente de aplicar la
migración en Railway** (`alembic upgrade head`) antes del próximo deploy.

### #3 — Entrada por audio NL ✅ COMPLETADO (2026-06-18)
`POST /api/v1/pantry/audio` (premium): backend implementado. UI: FAB de micrófono en
`PantryScreen` abre modal con teclado nativo (dictado iOS/Android integrado), envía texto a
Gemini, devuelve propuesta que el usuario confirma. Sin dependencias nuevas.

### #4 — Foto de nevera ✅ COMPLETADO (2026-06-18)
`POST /api/v1/pantry/foto-nevera` (premium): Gemini Vision analiza imagen JPEG en base64,
identifica ingredientes visibles, devuelve propuesta de alimentos + recetas express posibles.
Backend implementado con `analyze_fridge_photo`, rate limit 10/h. Ver `CHANGELOG.md`.

---

## 🟡 Mejoras de producto (segunda iteración)

### #5 — Historial de recetas cocinadas ✅ COMPLETADO (2026-06-18)
Tabla `recetas_historial` (migración `c2d4f6a80e04`) + `POST`/`GET /api/v1/pantry/recetas/historial`.
Acciones `cocinada` / `rechazada`. Helper `_bloque_historial` inyecta el contexto en el prompt
de Gemini. Botones en `PantryScreen` recargan sugerencias automáticamente. Ver `CHANGELOG.md`.

### #6 — Integrar perfil de hogar en los prompts de recetas ✅ COMPLETADO (2026-06-18)
Helper `_bloque_perfil` en `llm.py` inyecta `gustos_culinarios` + `num_comensales` en los
prompts de `generate_recipe_suggestions` y `generate_meal_plan`. El bloque entra en
`prompt_usuario`, por lo que forma parte de la clave de caché (perfiles distintos → sugerencias
distintas). Los 3 endpoints (`/pantry/recetas`, `/plan-comidas`, `/sugerencias`) obtienen el
perfil vía `OnboardingService` y lo pasan. (Sin intolerancias/alergias: datos de salud pospuestos.)

### #7 — Umbral de caducidad configurable por hogar ✅ COMPLETADO (2026-06-19)
`state/pantrySettingsStore.ts` — Zustand store con `diasUmbral` (default 6 días), persistido
en `expo-secure-store`. Opciones: 3/6/10/14 días (Chip picker en SettingsScreen «Despensa»).
`lib/caducidad.ts` — `getSemaforoCaducidad(dias, umbral)` acepta umbral configurable; borde
«urgente» (≤3 días) siempre fijo. Ver `CHANGELOG.md`.

### #8 — Pantalla de receta detallada ✅ COMPLETADO (2026-06-18)
`screens/RecipeDetailScreen.tsx` — pasos numerados, lista de ingredientes con checkmark,
badges de tiempo e ingredientes, footer fijo con «Marcar como cocinada» / «No me gusta».
Navega con `slide_from_right` desde la tarjeta de receta en `PantryScreen`. Ver `CHANGELOG.md`.

---

## 📋 Notas

- Las mejoras #1–#8 del backlog anterior (conflictos en briefing, `ultimo_completado`,
  gate premium, OCR en lote, plan unificado, solapamiento visible, timeouts) están
  **completadas** — ver `CHANGELOG.md` PR #5.
- El bloque F-QA2 (Schemathesis, CI) está **completado** — ver `CHANGELOG.md` 2026-06-16.
- Rama activa para F-PIVOT: `feat/pivote-recetas-mediterraneas`.
- **Fase 3** (perfiles individuales de miembros del hogar) **completada** — 2026-06-19. Ver `CHANGELOG.md`.
