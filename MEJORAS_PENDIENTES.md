# Mejoras pendientes — AsistenteHogar

Backlog actualizado tras el **pivote estratégico (2026-06-17)** a recetas mediterráneas españolas.
Ordenadas por prioridad. Las completadas se registran en `CHANGELOG.md`.

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

### #3 — Entrada por audio NL
`POST /api/v1/pantry/audio` (premium): recibe texto transcrito por el cliente (expo-av o
expo-speech), Gemini interpreta igual que `/pantry/interpretar`. Botón de micrófono en
`PantryScreen` con animación de grabación. IA pasiva: devuelve propuesta, usuario confirma.
**Esfuerzo:** Medio (endpoint backend simple + UI de micrófono).

### #4 — Foto de nevera
`POST /api/v1/pantry/foto-nevera` (premium): Gemini Vision analiza imagen JPEG en base64,
identifica ingredientes visibles, devuelve propuesta de alimentos + recetas express posibles.
Botón de cámara en `PantryScreen`. Modal de revisión con checkboxes (mismo patrón que OCR ticket).
**Esfuerzo:** Medio-alto (Gemini Vision + UI de cámara).

---

## 🟡 Mejoras de producto (segunda iteración)

### #5 — Historial de recetas cocinadas
Nueva tabla `recetas_historial` (`hogar_id`, `nombre_receta`, `cocinada_en`, `valoracion`).
Al confirmar una receta sugerida, el usuario puede marcarla como "cocinada". Esto alimenta
el contexto de futuras sugerencias ("no repetir en X días").
**Esfuerzo:** Medio (tabla + endpoint + UI de confirmación extendida).

### #6 — Integrar perfil de hogar en los prompts de recetas
Una vez implementado #2, pasar `gustos`, `intolerancias`, `alergias` y `num_comensales`
al prompt de `generate_recipe_suggestions` y `generate_meal_plan`.
**Esfuerzo:** Bajo (depende de #2).

### #7 — Umbral de caducidad configurable por hogar
`PantryService.get_stock_metrics()` usa 6 días fijo. Algunos hogares prefieren 3 (compra
frecuente) o 14 (congelador). Requiere campo en `perfil_hogar` (depende de #2) o tabla
`HogarSettings`.
**Esfuerzo:** Bajo una vez existe `perfil_hogar`.

### #8 — Pantalla de receta detallada
Hoy las recetas son solo un título + descripción en `PantryScreen`. Crear
`RecipeDetailScreen` con pasos numerados, lista de ingredientes con cantidades,
tiempo estimado y botón "Marcar como cocinada" (depende de #5).
**Esfuerzo:** Medio (nueva pantalla + navegación).

---

## 📋 Notas

- Las mejoras #1–#8 del backlog anterior (conflictos en briefing, `ultimo_completado`,
  gate premium, OCR en lote, plan unificado, solapamiento visible, timeouts) están
  **completadas** — ver `CHANGELOG.md` PR #5.
- El bloque F-QA2 (Schemathesis, CI) está **completado** — ver `CHANGELOG.md` 2026-06-16.
- Rama activa para F-PIVOT: `feat/pivote-recetas-mediterraneas`.
