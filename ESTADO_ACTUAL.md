# Estado Temporal y Roadmap — ESTADO_ACTUAL.md

Este documento centraliza el estado de los despliegues, las fases en curso, el roadmap del backlog y el historial simplificado de cambios del **Asistente del Hogar IA**.

---

## 1. Estado del Despliegue (Railway & Vercel)

| Servicio | URL / Host | Estado | Notas |
|---|---|---|---|
| **Backend Railway** | `https://asistentehogar-production.up.railway.app` | ✅ En línea | Despliegue automático desde rama `main`. Postgres y Redis conectados. |
| **Admin panel Vercel** | `https://admin-web-theta-pink.vercel.app` | ✅ En línea | Next.js 15. `ALLOWED_ORIGINS` configurado en Railway. |
| **Admin Bootstrap** | `navaroruiz2000@gmail.com` | ✅ Inicializado | Bootstrapped con contraseña segura. |

---

## 2. Sesiones Recientes

### ✅ Sesión 2026-06-23 (Parte 3) — Optimización del Carisma del Chef (Marce)
*   **Carisma potenciado**: Modificada la directiva `PERSONA_CHEF` en `llm.py` para dotar a Marce de un tono más coloquial, cercano, informal y entusiasta ("tío cocinillas/amigo de la familia"), utilizando expresiones cotidianas y cálidas españolas, e invitaciones apasionadas al aprovechamiento gastronómico sin perder rigor.
*   **Verificación**: Ejecutada la suite de 13 pruebas de humo del backend (SQLite).

### ✅ Sesión 2026-06-22 (Parte 9) — Skeleton Screens (Adopción Design System)
*   **Skeleton helpers**: Extendido `Skeleton.tsx` con 7 helpers de composición (`SkeletonText`, `SkeletonCard`, `SkeletonImage`, `SkeletonChip`, `SkeletonStatCard`, `SkeletonRecipeRow`, `SkeletonSteps`). Todos animan en hilo nativo vía Moti.
*   **5 skeleton screens**: Creados en `frontend/src/components/skeletons/` — `DashboardSkeleton`, `PantrySkeleton`, `ShoppingListSkeleton`, `PlanComidaSkeleton`, `HistorialSkeleton`. Ghost-layouts que simulan la estructura real del contenido.
*   **Integración en pantallas**: Reemplazados todos los `ActivityIndicator`/`LoadingView` de pantalla completa en las 5 pantallas principales.
*   **Token `shadow.small`**: Añadido nivel de sombra pequeño para inputs/chips.
*   **Verificación**: `ts:check` 0 errores · `lint` 0 errores · 3 warnings pre-existentes sin relación.

### ✅ Sesión 2026-06-22 (Parte 8) — Sistema de Diseño "Tierra Cálida"
*   **Design System completo**: 20 archivos HTML en `design-system/` importados desde claude.ai Design. Incluye tokens (colores, tipografía, espaciado), 8 componentes base (button, input, toggle, card, badge-chip, modal, toast, skeleton-loader) y 7 mocks de pantalla (dashboard, despensa, chat, recipe-detail, shopping-list, plan-comida, paywall).
*   **Guía de diseño**: `DESIGN_GUIDE.html` documenta la filosofía "Tierra Cálida", anti-patrones, sombras nativas RN, micro-animaciones (spring physics, haptics, shared transitions) y checklist WCAG AA.
*   **Verificación**: Backend (smoke tests auth/modules/chef/dashboard/movimientos/legal), Frontend TypeScript y Admin-web TypeScript: todos limpios. ESLint frontend: 0 errores, 3 warnings pre-existentes irrelevantes.

### ✅ Sesión 2026-06-22 (Parte 6) — Inicialización Automática de Prompts IA
*   **Siembra Idempotente**: Implementado el método `seed_default_templates` en `PromptConfigService` para poblar automáticamente los prompts por defecto (`"recetas"` y `"plan_comidas"`) si están ausentes de la BD.
*   **Lógica Concurrente Lifespan**: Integrado el sembrado en el hook `lifespan` de FastAPI durante el arranque. Diseñado para atrapar errores de integridad (`IntegrityError`) y prevenir caídas en despliegues con contenedores concurrentes (clusters de Railway).
*   **Seed Manual**: Actualizado el script `seed_recetario.py` para incluir el sembrado síncrono de los prompts iniciales.
*   **Suite de Humo**: Adaptado `smoke_test_admin.py` para sincronizar las aserciones de la versión del prompt (v1 sembrado ➔ v2/v3 tras modificaciones). Todas las 13 suites de smoke tests pasaron con éxito.

### ✅ Sesión 2026-06-22 — Inteligencia de stock (Fases 2A & 2B) + Fix SQLite Migración
*   **Confianza de Stock (Fase 2B)**: Campo `ultima_confirmacion` en alimentos + flag `incierto` calculado en metrics si transcurren los días de cadencia media sin confirmarse. Endpoints `POST /pantry/{id}/agotar` y `/confirmar`.
*   **Lista inteligente (Fase 2A)**: Sugerencias en `ShoppingListScreen` según el ledger de compras (100% SQL, sin coste IA).
*   **Fix SQLite**: Se reparó la migración `f3b8d2e6a1c9` para evitar fallos locales con defaults no constantes en SQLite `ALTER TABLE`.

### ✅ Sesión 2026-06-21 — Ledger de movimientos + Chef amigo
*   **Ledger (Fase 1)**: Tabla `movimientos_despensa` que registra compras/consumos para calcular cadencias medias de compra.
*   **Chef amigo**: Persona `_PERSONA_CHEF` ("Marce"), tabla `memoria_gustos` y endpoint `/chef/chat` multi-turno.

### ✅ Sesión 2026-06-20 — Webhooks, JTI blocklist e Historial
*   **Logout real**: JTI blocklist en Redis para invalidar tokens en `POST /auth/logout`.
*   **Suscripción**: Webhook de RevenueCat para invalidación automática de caché de tier.
*   **HistorialScreen**: FlatList en frontend con badges de cocinada/rechazada y valoraciones.

### ✅ Sesión 2026-06-22 (Parte 2) — Chat Accionable y Cupo Freemium
*   **Chat Accionable**: El Chef "Marce" ahora devuelve sugerencias de platos estructuradas que se renderizan como `RecipeChatCard` interactivas dentro de la burbuja del chat.
*   **Descuento Automático**: La IA extrae los ingredientes consumidos según el chat y el backend actualiza la despensa automáticamente, mostrando badges verdes de confirmación.
*   **Cupo Freemium**: Límite de 5 mensajes diarios por hogar para cuentas gratuitas (`CHEF_FREE_DAILY_LIMIT`), validado mediante Redis (o fallback en memoria). Superado el límite, se devuelve un error 402 que navega automáticamente a la pasarela de pago (`PaywallScreen`).

### ✅ Sesión 2026-06-22 (Parte 3) — Briefing Personalizado
*   **Briefing Personalizado**: El saludo matutino del Chef ahora inyecta el `_bloque_memoria_gustos`, logrando que las sugerencias de aprovechamiento en el Dashboard suenen hiper-personalizadas al recordar los gustos y hábitos del hogar.

### ✅ Sesión 2026-06-22 (Parte 4) — Voz al Chef
*   **Voz al Chef**: Integrado `expo-audio` nativo para permitir mantener presionado el botón del micrófono y dictar por voz al Chef. El audio se procesa vía Base64 usando el modelo multimodal de Gemini (`/chef/transcribe`) enviándolo directamente al chat.

### ✅ Sesión 2026-06-22 (Parte 7) — Purga Acotada e Integración del Anonimizador LLM
*   **Purga Acotada de Movimientos**: Implementado el recorte físico automático del ledger de `movimientos_despensa` para registros con antigüedad mayor a 12 meses en el job de mantenimiento `purge.py`.
*   **Anonimización Activa en LLM**: Integrado `AnonimizadorLLM` en todos los flujos de Gemini que manejan apodos o preferencias familiares (`distill_taste_memory`, `generate_recipe_suggestions`, `generate_meal_plan`, `chef_chat`). Los nombres reales/apodos son sustituidos por tokens `Familiar_N` en las peticiones y revertidos en las respuestas, garantizando el cumplimiento del RGPD (art. 5.1.c).
*   **Verificación Completa**: Ampliado `smoke_test_legal.py` para validar de forma hermética la eliminación de movimientos antiguos y el mantenimiento de auditoría. La suite de pruebas de humo del backend pasó al 100%.

### ✅ Sesión 2026-06-22 (Parte 5) — Chef Proactivo (Fase 3 Completada)
*   **Chef Proactivo**: Implementadas notificaciones push locales con IA. Al cargar el Dashboard, el LLM calcula silenciosamente una notificación de caducidad en la voz de Marce. El frontend la programa para el día siguiente usando `expo-notifications`, y si el usuario la toca (deep-link), abre automáticamente la pantalla de Chat con un saludo contextual.

### ✅ Sesión 2026-06-23 (Parte 2) — Smoke test de `/restaurar` y limpieza de deuda técnica
*   **Bloque 4 en `smoke_test_chef.py`**: 10 checks nuevos que cubren el flujo completo de `POST /pantry/{id}/restaurar`: agotar → restaurar → reaparición en GET /pantry + 404 en ítem activo + 404 en ítem ajeno + compensación en ledger (`tipo=compra`, `origen=undo`) verificada vía sesión async directa.
*   **Deuda técnica actualizada**: eliminados ítems obsoletos (caché Redis y rate-limit ya implementados en código; react-native-svg y Unsplash no existen en el proyecto). Deuda real restante: `REDIS_URL` en Railway, billing Gemini, y ruta del hook pre-commit backend.

### ✅ Sesión 2026-06-23 — Calidad UX: React Query, Toast y Undo del Chef
*   **React Query**: Hooks de datos migrados a `useQuery`/`useMutation` con caché compartida por dominio (`['pantry']`, `['lista-compra']`, `['dashboard']`, etc.). El Dashboard IA ya no se regenera al cambiar de pestaña mientras el caché esté fresco.
*   **Mutaciones optimistas**: `toggleItem`/`deleteItem`/`clearChecked` en lista de la compra y `agotarItem`/`confirmarItem`/`updateQuantity` en despensa actualizan la UI al instante con rollback automático si falla la red.
*   **Toast reutilizable**: Componente `ToastProvider` + `useToast()` con tipos info/success/error y botón de acción "Deshacer". Todos los errores de mutación se notifican visualmente.
*   **Undo del Chef**: Cumple CLAUDE.md §6.2.5 (escrituras IA reversibles). El backend devuelve `consumos_detalle` estructurado por cada descuento aplicado; el frontend muestra botón "Deshacer" en la burbuja del chef que llama a `POST /pantry/{id}/restaurar` (reactiva soft-deleted + compensa ledger).

### ✅ Sesión 2026-06-23 — Auditoría de Calidad y Seguridad de la Agencia (Clean Slate)
*   **Reality Checker (QA)**:
    *   **TypeScript check**: Verificados `frontend/` y `admin-web/` mediante `npm run ts:check`. Resultado: **0 errores de compilación**.
    *   **Backend Smoke Tests**: Ejecutada la suite completa de 13 pruebas de humo en el backend de FastAPI. Resultado: **100% de éxito**. Todos los tests (auth, pantry, chef, legal, admin, perfiles, etc.) pasaron correctamente sobre SQLite.
*   **Application Security Engineer (Seguridad)**:
    *   **JWT Multi-tenant isolation**: Verificado en `deps.py`. El `hogar_id` se extrae de forma hermética a nivel de base de datos a partir del token firmado, anulando cualquier intento de manipulación IDOR/BOLA por headers o cuerpo de petición del cliente.
    *   **CORS**: Verificado en `main.py`. Restringido en producción a la lista explícita de `ALLOWED_ORIGINS` (evitando orígenes por defecto y mitigando ataques CSRF/Cross-site).
    *   **Bóveda local de secretos**: Inicializado el almacenamiento externo seguro en `C:\Users\navar\.gemini\agency-vault\AsistenteHogar\.env`, aislando las claves y tokens sensibles del control de Git y eliminando riesgos de fuga en repositorios remotos.

---

## 3. Roadmap / Próximos Pasos (Backlog)

### ⏳ Fase 5 — Integración Comercial y Publicación
*   Definición de `REVENUECAT_SECRET_KEY` en producción (Railway) para cerrar el gate premium.
*   Creación de productos y offerings en App Store Connect, Google Play Console y RevenueCat.
*   Builds nativos finales de producción y EAS Submit.

### ⏳ RGPD & Hardening Pendiente
*   **Gemini Billing**: Migrar la clave del backend de Railway a una API key con facturación activa para garantizar que Google no recopile los datos de los prompts familiares (RGPD art. 28).

---

## 4. Historial de Cambios (Changelog Simplificado)

*   **v1.7.0 (2026-06-22)**: Skeleton Screens — ghost-layouts animados (Moti/nativo) para Dashboard, Pantry, ShoppingList, PlanComida e Historial. Reemplaza `ActivityIndicator`/`LoadingView` de pantalla completa.
*   **v1.6.0 (2026-06-22)**: Design System "Tierra Cálida" — 20 archivos HTML de referencia canónica en `design-system/` (tokens, 8 componentes, 7 mocks de pantalla, guía WCAG AA y animaciones RN).
*   **v1.5.0 (2026-06-22)**: Inteligencia de stock predictiva (Ledger de movimientos, lista de compra inteligente sin IA, confianza de stock decaída y "¿Te queda?" UI).
*   **v1.4.0 (2026-06-21)**: Chef Amigo (Voz cálida Marce, memoria destilada de gustos del hogar, valoraciones del historial e inyección de contexto en sugerencias).
*   **v1.3.0 (2026-06-20)**: Seguridad y Tiers (JTI Blocklist en Redis, HttpOnly cookie + CSRF en panel admin, webhook de RevenueCat para sincronizar caché de tier, y primera build APK de desarrollo exitosa).
*   **v1.2.0 (2026-06-19)**: Onboarding y Feedback (Pantalla detallada de recetas `RecipeDetailScreen`, edición de gustos de hogar en ajustes, y notificaciones locales de caducidad).
*   **v1.1.0 (2026-06-18)**: **Pivote estratégico 2** (Foco exclusivo en comida, stock y recetas de aprovechamiento; remoción de Calendario y Tareas; onboarding de perfil de comensales y gustos).
*   **v1.0.0 (2026-06-16)**: Versión inicial estable (FastAPI + SQLAlchemy, React Native Expo UI, OCR de tickets con Gemini Vision, purga GDPR y smoke tests del backend).
