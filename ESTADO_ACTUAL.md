# Estado Temporal y Roadmap — ESTADO_ACTUAL.md

Este documento centraliza el estado de los despliegues, las fases en curso, el roadmap del backlog y el historial simplificado de cambios del **Asistente del Hogar IA**.

---

## 1. Estado del Despliegue (Railway & Vercel)

| Servicio | URL / Host | Estado | Notas |
|---|---|---|---|
| **Backend Railway** | `https://asistentehogar-production.up.railway.app` | ✅ En línea | Despliegue automático desde `main`. Postgres y Redis conectados. Redesplegando tras merge PR #10 (`alembic upgrade head` requerido). |
| **Admin panel Vercel** | `https://admin-web-theta-pink.vercel.app` | ✅ En línea | Next.js 15. `ALLOWED_ORIGINS` configurado en Railway. |
| **Admin Bootstrap** | `navaroruiz2000@gmail.com` | ✅ Inicializado | Bootstrapped con contraseña segura. |

---

## 2. Sesiones Recientes

### ✅ Sesión 2026-06-24 — Pivote 2 (PR #10) + Auditoría NEXUS

**PR #10 mergeada a `main`**: "Pivote 2: gate freemium invertido + ticket PDF + Informe de Ahorro + 3 fixes de riesgo" (11 commits, rama `feat/gate-inversion-fase1`).

**Contenido de la PR:**

*   **Gate freemium invertido (Fase 1)**: OCR/foto/voz/texto/metadata GRATIS. Chat aumentado de 5→10 mensajes/día. Premium = Informe de Ahorro + recetas IA. Familia = plan semanal + multi-perfil.
*   **Parser de ticket PDF (Fase 2)**: Migración `b2c4d6e8f0a1` añade `precio_unitario` y `fecha_compra` a `movimientos_despensa`. Nuevo endpoint `POST /pantry/ticket/pdf` con Gemini Flash visión. Nueva pantalla `TicketImportScreen` en frontend.
*   **Informe de Ahorro (Fase 3)**: `AhorroService` cruza precios reales del ledger con recetas cocinadas. Endpoints `GET /ahorro/resumen` (premium, informe completo) y `GET /ahorro/preview` (free, cifra tentadora). Nueva `AhorroScreen` con tarjeta viral compartible (TikTok/Instagram).
*   **Fix 1 — Cadena de precio**: Precio soldado ticket→ledger→informe; verificado 2 kg × 1,80 € = 3,60 €.
*   **Fix 2 — Tope diario de IA por hogar**: Límites vision 15/día, ticket PDF 10/día, texto 60/día.
*   **Fix 3 — Pantallas legales RGPD**: Pantallas de privacidad/términos/info legal con 7 marcadores `[COMPLETAR]` para identidad jurídica del fundador.

**Auditoría NEXUS (2026-06-24):**
*   **Técnico**: 15/15 smoke tests PASS · TypeScript limpio (frontend + admin-web) · pre-commit 9/9 PASS.
*   **Mercado**: BUEN CAMINO — mercado €379 M EU, Ley 1/2025 de desperdicio alimentario, Mercadona 29,5% cuota de mercado, sin competidor directo en España para gestión doméstica con IA.
*   **Legal/TestFlight**: APTO TESTFLIGHT INTERNO. Para App Store público: 7 `[COMPLETAR]` en `LegalScreen.tsx` pendientes + `REVENUECAT_SECRET_KEY` en Railway + Apple IDs en `eas.json`.

---

### ✅ Sesión 2026-06-23 — Calidad UX: React Query, Toast y Undo del Chef

*   **React Query**: Hooks migrados a `useQuery`/`useMutation` con caché por dominio (`['pantry']`, `['lista-compra']`, `['dashboard']`, etc.).
*   **Mutaciones optimistas**: `toggleItem`/`deleteItem`/`clearChecked` en lista de la compra y `agotarItem`/`confirmarItem`/`updateQuantity` en despensa con rollback automático.
*   **Toast reutilizable**: `ToastProvider` + `useToast()` con tipos info/success/error y botón "Deshacer".
*   **Undo del Chef**: Cumple CLAUDE.md §6.2.5. El backend devuelve `consumos_detalle`; el frontend muestra "Deshacer" en la burbuja del chef que llama a `POST /pantry/{id}/restaurar`.

### ✅ Sesión 2026-06-23 — Smoke test de `/restaurar` y limpieza de deuda técnica

*   **Bloque 4 en `smoke_test_chef.py`**: 10 checks del flujo completo `POST /pantry/{id}/restaurar`: agotar → restaurar → reaparición en GET + compensación en ledger (`tipo=compra`, `origen=undo`).
*   **Deuda técnica actualizada**: Eliminados ítems obsoletos; deuda real restante documentada.

### ✅ Sesión 2026-06-23 — Optimización del Chef y auditoría de seguridad

*   **Carisma potenciado**: Directiva `PERSONA_CHEF` en `llm.py` con tono más coloquial, cercano y entusiasta.
*   **Seguridad verificada**: JWT multi-tenant (`hogar_id` extraído en `deps.py`), CORS restringido en producción, bóveda local de secretos en `agency-vault`.

### ✅ Sesión 2026-06-22 — Skeleton Screens + Design System "Tierra Cálida"

*   **Design System**: 20 archivos HTML en `design-system/` (tokens, 8 componentes, 7 mocks de pantalla, guía WCAG AA).
*   **Skeleton Screens**: 7 helpers en `Skeleton.tsx` + 5 ghost-layouts animados (Moti/nativo) para Dashboard, Pantry, ShoppingList, PlanComida e Historial.

### ✅ Sesión 2026-06-22 — Chef Proactivo (Fase 3 completada) + Voz al Chef + Briefing

*   **Chef Proactivo**: Notificaciones push locales con IA; `expo-notifications`; deep-linking a ChatScreen.
*   **Voz al Chef**: `expo-audio` hold-to-talk; `POST /chef/transcribe` base64 multimodal Gemini.
*   **Briefing Personalizado**: `_bloque_memoria_gustos` inyectado en el saludo matutino del Dashboard.

### ✅ Sesión 2026-06-22 — Chat Accionable + Cupo Freemium + Inteligencia de Stock

*   **Chat Accionable**: Sugerencias estructuradas `platos` como `RecipeChatCard`; descuento automático de stock.
*   **Cupo Freemium**: `CHEF_FREE_DAILY_LIMIT` = 5 mensajes/día; error 402 → `PaywallScreen`. *(Límite subido a 10/día en PR #10.)*
*   **Stock Fase 2B**: `ultima_confirmacion` + flag `incierto` + endpoints `agotar`/`confirmar`.
*   **Stock Fase 2A**: `GET /lista-compra/sugerencias` por cadencia, sin coste IA.

### ✅ Sesión 2026-06-21 — Ledger de movimientos + Chef amigo

*   **Ledger (Fase 1)**: Tabla `movimientos_despensa` — compras/consumos para cadencias de compra.
*   **Chef amigo**: Persona `_PERSONA_CHEF` ("Marce"), tabla `memoria_gustos`, endpoint `/chef/chat`.

### ✅ Sesión 2026-06-20 — Seguridad y tiers

*   **Logout real**: JTI blocklist en Redis (`POST /auth/logout`).
*   **Webhook RevenueCat**: Invalidación automática de caché de tier.
*   **HistorialScreen**: FlatList con badges cocinada/rechazada y valoraciones.

---

## 3. Roadmap / Próximos Pasos

### ⏳ Fase 5 — Integración Comercial y Publicación (acciones del fundador)

Las siguientes 7 acciones son bloqueantes para publicación en App Store / Google Play:

1. **`REVENUECAT_SECRET_KEY` en Railway** — cierra el gate premium en producción (actualmente abierto sin la key).
2. **Rellenar 7 `[COMPLETAR]` en `frontend/src/screens/LegalScreen.tsx`** — razón social, NIF, domicilio, email, fecha de actualización, DPA confirmado.
3. **Apple IDs en `eas.json` L34–36** — sustituir `REEMPLAZAR_CON_APPLE_ID` y valores análogos.
4. **Crear productos de suscripción** en App Store Connect + Google Play Console + RevenueCat (offerings premium y familia).
5. **`eas build --profile production`** + EAS Submit para iOS y Android.
6. **Sustituir RC key `test_BSy...`** por clave de producción en `eas.json` L21.
7. **Confirmar DPA con Google Cloud** (RGPD art. 28) — Gemini billing activo garantiza que los datos de prompts no se usen para entrenamiento.

### ⏳ RGPD & Hardening Pendiente

*   **Gemini Billing**: Migrar la API key de Railway a clave con facturación activa (Google no recopila prompts en el tier de pago — RGPD art. 28).

---

## 4. Historial de Cambios (Changelog Simplificado)

*   **v1.8.0 (2026-06-24)**: **Pivote 2** — Gate freemium invertido (OCR/foto/voz GRATIS, chat 10/día), parser de ticket PDF Mercadona (`precio_unitario` + `fecha_compra` en ledger), `AhorroService` + `AhorroScreen` con tarjeta viral, 3 fixes de riesgo (cadena precio, topes IA, pantallas legales RGPD). PR #10.
*   **v1.7.0 (2026-06-23)**: React Query + mutaciones optimistas + Toast reutilizable + Undo del Chef (`POST /pantry/{id}/restaurar`).
*   **v1.6.0 (2026-06-22)**: Skeleton Screens — ghost-layouts animados (Moti/nativo) para 5 pantallas principales. Design System "Tierra Cálida" — 20 archivos HTML de referencia canónica.
*   **v1.5.0 (2026-06-22)**: Chef Proactivo (Fase 3) + Voz al Chef + Briefing personalizado + Cupo freemium + Chat accionable con descuento automático de stock.
*   **v1.4.0 (2026-06-21)**: Chef Amigo — persona "Marce", memoria destilada de gustos, chat multi-turno, valoraciones en historial.
*   **v1.3.0 (2026-06-20)**: Seguridad y Tiers — JTI Blocklist Redis, HttpOnly cookie + CSRF en panel admin, webhook RevenueCat.
*   **v1.2.0 (2026-06-19)**: Onboarding y Feedback — `RecipeDetailScreen`, edición de gustos, notificaciones locales de caducidad.
*   **v1.1.0 (2026-06-18)**: **Pivote estratégico 1** — foco exclusivo en comida/stock/recetas; eliminación de Calendario y Tareas; onboarding de comensales y gustos.
*   **v1.0.0 (2026-06-16)**: Versión inicial estable — FastAPI + SQLAlchemy, React Native Expo, OCR de tickets con Gemini Vision, purga GDPR, smoke tests.
