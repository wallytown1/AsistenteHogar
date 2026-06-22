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

---

## 3. Roadmap / Próximos Pasos (Backlog)

### ⏳ Fase 3 — 4 Mejoras del Chef (Siguiente Tanda)
1.  **Chat Accionable + Cupo Freemium** (Prioridad 1):
    *   Soporte para structured output `platos: RecetaSugerida[]` en `/chef/chat` para renderizar tarjetas interactivas que naveguen a `RecipeDetailScreen` con botón de "Añadir ingredientes faltantes a la compra".
    *   Límite de mensajes diarios en plan free (`CHEF_FREE_DAILY_LIMIT=5`) persistido en Redis/memoria por hogar. Al superarlo → HTTP 402 → `PaywallScreen`.
    *   Descuento automático de stock estimado al cocinar por texto/voz con confirmación y *Deshacer* visible.
2.  **Briefing Personal**:
    *   Inyectar el contexto de `memoria_gustos` en `generate_morning_briefing` en el backend.
3.  **Voz al Chef**:
    *   Integración de audio dictado directamente al Chef: `expo-audio` + `POST /chef/transcribe` (Gemini audio→texto). requiere build nativo EAS.
4.  **Chef Proactivo**:
    *   Notificaciones locales de caducidad personalizadas en la voz de Marce con deep-linking al Chat.

### ⏳ Fase 5 — Integración Comercial y Publicación
*   Definición de `REVENUECAT_SECRET_KEY` en producción (Railway) para cerrar el gate premium.
*   Creación de productos y offerings en App Store Connect, Google Play Console y RevenueCat.
*   Builds nativos finales de producción y EAS Submit.

### ⏳ RGPD & Hardening Pendiente
*   **Retención Acotada**: Programar en `jobs/purge.py` el recorte automático de registros históricos de `movimientos_despensa` con antigüedad mayor a 12 meses.
*   **Gemini Billing**: Migrar la clave del backend de Railway a una API key con facturación activa para garantizar que Google no recopile los datos de los prompts familiares (RGPD art. 28).

---

## 4. Historial de Cambios (Changelog Simplificado)

*   **v1.5.0 (2026-06-22)**: Inteligencia de stock predictiva (Ledger de movimientos, lista de compra inteligente sin IA, confianza de stock decaída y "¿Te queda?" UI).
*   **v1.4.0 (2026-06-21)**: Chef Amigo (Voz cálida Marce, memoria destilada de gustos del hogar, valoraciones del historial e inyección de contexto en sugerencias).
*   **v1.3.0 (2026-06-20)**: Seguridad y Tiers (JTI Blocklist en Redis, HttpOnly cookie + CSRF en panel admin, webhook de RevenueCat para sincronizar caché de tier, y primera build APK de desarrollo exitosa).
*   **v1.2.0 (2026-06-19)**: Onboarding y Feedback (Pantalla detallada de recetas `RecipeDetailScreen`, edición de gustos de hogar en ajustes, y notificaciones locales de caducidad).
*   **v1.1.0 (2026-06-18)**: **Pivote estratégico 2** (Foco exclusivo en comida, stock y recetas de aprovechamiento; remoción de Calendario y Tareas; onboarding de perfil de comensales y gustos).
*   **v1.0.0 (2026-06-16)**: Versión inicial estable (FastAPI + SQLAlchemy, React Native Expo UI, OCR de tickets con Gemini Vision, purga GDPR y smoke tests del backend).
