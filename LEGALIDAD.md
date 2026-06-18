# Claude Code - Implementación de Compliance Legal

## Objetivo Core
Refactorizar el código del monorepo **Asistente del Hogar IA** para implementar los requisitos técnicos del RGPD, la Ley de IA de la UE y las políticas de las tiendas de aplicaciones. Céntrate exclusivamente en escribir, modificar e integrar el código necesario. No redactes explicaciones teóricas.

## 1. Tareas de Backend (`backend/`)
Ejecuta las siguientes implementaciones en la API de FastAPI y la base de datos PostgreSQL:

*   **Purga Física (RGPD):** Crea un mecanismo (script o función programada) apoyándote en `backend/app/repositories/` que ejecute un `DELETE` físico para todos los registros (inventario, tareas, eventos) donde `is_deleted = true` y `updated_at` sea mayor a 30 días.
*   **Anonimización LLM:** Modifica la lógica en `backend/app/services/` que alimenta el endpoint `GET /api/v1/hogares/{hogar_id}/briefing`. Implementa un tokenizador que reemplace los nombres propios de los participantes por identificadores genéricos (ej. `Familiar_1`) en el prompt que va al LLM. Revierte los tokens al texto original al recibir la respuesta.
*   **Endpoint de Destrucción (App Store):** Añade la ruta `DELETE /api/v1/hogares/{hogar_id}/usuarios/cuenta` en `backend/app/api/routers/`. Debe ejecutar una eliminación física y definitiva (`ON DELETE CASCADE`) del hogar y toda su información vinculada. Actualiza `backend/app/schemas/` si es necesario.

## 2. Tareas de Frontend (`frontend/`)
Ejecuta las siguientes implementaciones en la app de Expo/React Native:

*   **Banner de Transparencia IA:** Crea un componente de advertencia en `frontend/src/components/` usando NativeWind. El texto fijo debe ser: *"Este resumen ha sido generado por IA y puede contener imprecisiones."* Inyecta este componente en la pantalla correspondiente dentro de `frontend/src/screens/` donde se renderiza el briefing diario.
*   **Flujo de Eliminación de Cuenta:** En la pantalla de ajustes/perfil, añade un botón destructivo ("Eliminar cuenta permanentemente").
*   **Integración de Estado:** Crea una acción en Zustand (`frontend/src/state/`) que conecte ese botón. Debe:
    1. Lanzar una alerta de confirmación nativa irreversible.
    2. Consumir el nuevo endpoint `DELETE` del backend.
    3. Limpiar el estado global y el almacenamiento local.
    4. Desmontar la sesión y navegar al Login.

## Reglas de Ejecución
*   Usa las herramientas `Read` y `View` para analizar la arquitectura actual antes de modificar archivos.
*   Asegúrate de que las firmas de las funciones y los tipos de TypeScript/Python coincidan con la arquitectura establecida.
*   Genera y aplica los parches de código directamente.

---

# Addendum de Cumplimiento (estado a 2026-06-15)

## Estado de los requisitos de este documento
| Requisito | Estado | Implementación real |
|---|---|---|
| Purga física RGPD (30 días) | ✅ | `app/jobs/purge.py` (scheduler 24 h + CLI); `purge_expired()` en cada repo |
| Anonimización LLM del briefing | ✅ | `app/services/privacy.py` (`AnonimizadorLLM`); clave de caché sobre prompt anonimizado |
| Endpoint de destrucción de cuenta | ✅ | `DELETE /api/v1/auth/cuenta` (cascade ORM). **Mejora sobre el brief**: `hogar_id` del JWT, no de la URL → sin IDOR |
| Banner de transparencia IA | ✅ | `frontend/src/components/AIDisclaimerBanner.tsx`, condicional a `generado_por_ia` |
| Flujo de eliminación en frontend | ✅ | `SettingsScreen.tsx` (confirmación en 2 pasos) + `authStore.deleteAccount()` |

## Requisito adicional: tier de la API de Gemini (RGPD art. 28, encargado del tratamiento)
La API **gratuita** de Google AI (`generativelanguage`) **puede usar los prompts para mejorar los productos de Google** (revisión humana / entrenamiento). Enviar datos del hogar bajo esas condiciones no es admisible.
**Acción requerida (contractual, no código):** usar una `GEMINI_API_KEY` de un proyecto con **facturación activada** (donde Google **no** entrena con los datos) o **Vertex AI** con DPA y región UE.

## Flujos de datos hacia Gemini (minimización, art. 5.1.c)

> **Pivote 2 (2026-06-18):** eliminados `/calendar/interpretar` y `/tasks/interpretar`
> — ya no existen endpoints de Calendario ni Tareas. Los flujos quedan solo a despensa y dashboard.

| Endpoint | Qué sale hacia Gemini | PII | Mitigación |
|---|---|---|---|
| `GET /dashboard` (briefing) | stock/alimentos del día | No (sin nombres tras pivote) | Anonimizador preservado en `privacy.py` para usos futuros (chat) |
| `GET /pantry/recetas` | inventario (alimentos) | No | — |
| `GET /pantry/plan-comidas` | inventario (alimentos) | No | — |
| `POST /pantry/sugerir-metadata` | nombre de un alimento | No | — |
| `POST /pantry/interpretar` | frase del usuario sobre compra | Improbable | Input voluntario del usuario para esa finalidad |
| `POST /pantry/audio` ✅ | texto transcrito de nota de voz | Posible (nombres, lugares) | Input voluntario; la transcripción ocurre en el cliente antes del envío |
| `POST /pantry/foto-nevera` ✅ | imagen JPEG de la nevera | Improbable (solo alimentos) | El cliente recorta/redimensiona antes de enviar; no se almacena la imagen en el servidor |
| `POST /onboarding` ✅ | gustos culinarios, nº comensales | No (datos NO sensibles) | Implementado solo con datos no sensibles. `extra='forbid'` rechaza intolerancias/alergias si llegan por error |
| `POST /onboarding` (datos de salud) ⏳ | intolerancias, alergias | Sí (categoría especial RGPD art. 9) | **POSPUESTO.** Cuando se implemente: base legal explícita (consentimiento art. 6.1.a + art. 9.2.a) antes de enviar a Gemini; no enviar datos de salud sin consentimiento explícito |

Notas: la clave nunca viaja en la URL (header `x-goog-api-key`); los prompts no se registran en logs; los endpoints de IA están rate-limited para contener coste y abuso.
