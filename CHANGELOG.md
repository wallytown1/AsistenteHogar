# CHANGELOG — Asistente del Hogar IA

Formato: `[FECHA] [ÁREA] [TIPO] Descripción`
- **Tipos:** `ADD` (nuevo), `FIX` (corrección), `MOD` (modificación), `CFG` (configuración)
- **Historial anterior:** ver [`CHANGELOG_ARCHIVE.md`](CHANGELOG_ARCHIVE.md) para entradas pre-2026-06-11

---

## [2026-06-22] — Inteligencia de stock (Fase 2A): lista de la compra inteligente

Primer consumidor del ledger orientado al usuario: la lista de la compra **sugiere lo que te suele
tocar** según tu cadencia de compra, sin coste de IA (100% SQL sobre `movimientos_despensa`).

- **ADD** `GET /api/v1/lista-compra/sugerencias` → devuelve alimentos que probablemente toca reponer:
  para cada alimento con ≥2 compras, si han pasado al menos sus días de cadencia media desde la última
  compra Y no está ya en la despensa ni en la lista, se sugiere con su motivo y cantidad habitual.
- **ADD** `ListaCompraService.sugerencias` (combina hábitos del ledger + stock actual + lista actual) +
  schema `SugerenciaCompra`. Disponible en todos los tiers (sin Gemini).
- **ADD** Frontend: sección "Te suele tocar" en `ShoppingListScreen` con añadir de un toque.
- **ADD** `smoke_test_lista_inteligente.py` (cadencia + exclusiones + aislamiento) y en CI.

---

## [2026-06-21] — Inteligencia de stock (Fase 1): ledger de movimientos

Cimiento de datos para optimizar las sugerencias sabiendo **qué suele comprar/consumir el hogar**.
Hasta ahora solo se guardaba la foto actual de la despensa (`inventario_alimentos`); el consumo se
perdía. Ahora se registra el histórico de movimientos como efecto secundario de acciones que ya
ocurren (cero fricción extra).

- **ADD** Tabla `movimientos_despensa` (ledger entradas/salidas) + migración. Campos: `nombre`
  (normalizado), `tipo` (`compra`/`consumo`/`caducado`/`ajuste`), `cantidad`, `unidad`, `origen`
  (`ticket`/`manual`/`cocina`/`voz`/`foto`/`agotado`/`edicion`), `fecha`.
- **ADD** `MovimientoDespensaRepository`: `registrar` + agregados `habitos_compra` (veces, última
  compra, intervalo medio, cantidad habitual por alimento) y `ritmo_consumo` vía SQL `GROUP BY`.
- **MOD** `PantryService.add_item/update_item/remove_item` registran el movimiento correspondiente
  (best-effort: un fallo de log NO rompe la operación). `add_item` acepta `origen`.
- **MOD** Personalización: `distill_taste_memory` incorpora los hábitos de compra/consumo en la
  memoria de gustos destilada → sugerencias/plan/chat priorizan lo que el hogar suele tener.
- **ADD** `smoke_test_movimientos.py` (registro + agregados + aislamiento + cascade) y en CI.
- **RGPD**: histórico más personal (hábitos) → cascade en borrado de cuenta + retención acotada;
  al LLM solo van nombres/cantidades/fechas, nunca identificadores.

> Filosofía acordada: ningún método revela el stock real; el stock es una *hipótesis* y la
> reconciliación fiable ocurre en el punto de uso. Fases siguientes (no en esta tanda): confianza
> que decae + confirmación en el chat, lista de la compra inteligente, y las 4 mejoras del chef.

---

## [2026-06-21] — Chef amigo que te conoce: personalización profunda + chat

Mejora del LLM para que el asistente se sienta como un amigo chef cercano que conoce tus gustos
y aprende con el uso. **Sin fine-tuning**: todo es persona + memoria + contexto en inferencia.

### Persona unificada
- **ADD** `_PERSONA_CHEF` en `llm.py` — voz cálida y cercana del chef ("Marce"), inyectada de forma
  consistente en briefing, recetas, plan y chat. Antepuesta en `PromptConfigService.get_system_instruction`
  (afinable desde el panel admin) y en las ramas fallback; la filosofía mediterránea sigue como guard final.

### Memoria de gustos (lo que hace que "te conozca")
- **ADD** Tabla `memoria_gustos` (1 por hogar) + migración `d4f6a8b02c15`. Resumen NL destilado de los
  gustos y hábitos aprendidos, inyectado en sugerencias/plan/chat (`_bloque_memoria_gustos`). Acota el
  prompt (tamaño fijo) frente al historial creciente.
- **ADD** `distill_taste_memory` (`llm.py`) + `MemoriaService`/`MemoriaGustosRepository`. Se recalcula
  best-effort cuando hay feedback nuevo sin destilar (umbral 5 eventos / 7 días), disparado al registrar
  acción en el historial. Solo datos gastronómicos (RGPD).

### Feedback más rico
- **MOD** `recetas_historial`: nuevas columnas `valoracion` (`me_encanto`/`gusto`/`no_me_gusto`) y
  `categoria`. `_bloque_historial` pondera por valoración (lo que encantó refuerza el estilo; lo rechazado
  o "no me gustó" se excluye). UI: valoración al marcar cocinada (`RecipeDetailScreen`) + badge en `HistorialScreen`.

### Chef conversacional
- **ADD** `POST /api/v1/chef/chat` (premium + rate limit 30/5 min) — conversa con el chef, fundamentado en
  despensa + memoria + perfiles. `_call_gemini` ahora soporta multi-turno; input saneado anti prompt-injection.
  **Privacidad**: el servidor NO persiste el texto del chat (el cliente reenvía turnos recientes; la
  continuidad vive en la memoria destilada).
- **ADD** Frontend: pestaña **Chef** (`ChefChatScreen` + `useChefChat`) con `AIDisclaimerBanner`.
- **ADD** `smoke_test_chef.py` (chat + valoración + memoria + aislamiento) y en CI.

---

## [2026-06-21] — Segundo repaso de seguridad e integridad

Repaso post-cambios (3 agentes Explore + investigación web sobre errores comunes del código IA:
broken access control/IDOR, secretos x2, dead code, comparaciones no constantes, deps con CVEs).
Núcleo verificado **limpio** (multi-tenant, sin SQLi/eval/SSRF, sin secretos reales en árbol/historial,
Pivote 2 completo, contratos API sincronizados). Hallazgos accionables remediados:

- **FIX** (seguridad) Comparación de secretos en **tiempo constante** con `hmac.compare_digest`:
  webhook RevenueCat (`webhooks.py`) y bootstrap admin (`admin_auth.py`) — evita side-channel de timing.
- **MOD** (admin-web) **Next.js 14.2.29 → 15.5.19** — limpia 4 advisories *high* (DoS image-opt, SSRF
  WebSocket, cache poisoning RSC, bypass middleware i18n) sin parche en la línea 14.2.x. React sigue
  en 18 (Next 15.5 lo soporta). `build` + `ts:check` verdes sin breaking changes.
- **ADD** (CI) `npm audit --audit-level=high` también sobre **admin-web** (antes sin cobertura).
- **FIX** (dev) `docker-compose.yml` — contraseña de Postgres a placeholder `postgres_dev` + nota "solo dev".
- **FIX** (docs) Sincronización: `CLAUDE.md` `ADMIN_JWT_EXPIRE_MINUTES` 480 → 120; añadidas env vars
  `REVENUECAT_FAMILIA_ENTITLEMENT`, `REVENUECAT_WEBHOOK_SECRET`, `RUN_MIGRATIONS_ON_STARTUP` a la tabla
  y a `.env.example`.
- **FIX** (frontend) Eliminado import sin usar (`Screen` en `PaywallScreen.tsx`) — 0 warnings de ESLint.

---

## [2026-06-21] — Auditoría de seguridad: remediación completa

Auditoría profunda (3 agentes: backend, frontend/admin, deps/secretos). Veredicto: postura
sólida; hallazgos accionables concentrados en el panel admin. Remediación en 6 fases.

### Seguridad admin (backend)

- **ADD** `POST /api/v1/admin/auth/logout` — revoca el `jti` del token en el blocklist y borra la
  cookie. **MOD** `create_admin_token` añade claim `jti`; `get_current_admin` verifica revocación
  (paridad con el JWT de familia). **MOD** `ADMIN_JWT_EXPIRE_MINUTES` 480 → **120** (2 h).
- **ADD** Sesión admin por **cookie HttpOnly** (`admin_token`): login/bootstrap la ponen
  (`Secure; SameSite=None` en prod por ser cross-site Vercel↔Railway); `get_current_admin` lee
  cookie o `Authorization: Bearer`. Mitiga exfiltración del token por XSS.
- **ADD** Defensa **CSRF** `require_admin_csrf` (cabecera `X-Admin-Request: 1`) en las mutaciones de
  prompts y recetario → **403** sin ella.
- **FIX** Encapsulación: `routers/admin_prompts.py` ya no accede a `svc._repo` (métodos públicos
  `list_templates`/`get_template`/`upsert_template` en `PromptConfigService`).

### Admin-web (Next.js)

- **MOD** Token fuera de `localStorage`: el cliente usa la cookie HttpOnly (`credentials: 'include'`)
  + cabecera CSRF; `lib/auth.ts` solo guarda una "pista" de UX no sensible.
- **ADD** `src/middleware.ts` — protección de `/prompts` y `/recetario` en el edge.
- **MOD** Logout llama a `POST /admin/auth/logout` (revoca el token server-side) antes de redirigir.

### Hardening

- **ADD** `_sanitize_user_text` en `llm.py` — acota longitud y neutraliza delimitadores de prompt
  injection antes de Gemini (defensa en profundidad sobre `responseSchema` + temp 0).
- **MOD** `purchasesStore.ts` — `console.*` envueltos en `logDev` (solo `__DEV__`).

### Dependencias (CVEs)

- **FIX** `requirements.txt` fija **`starlette>=1.3.1`** → resuelve PYSEC-2026-161 y
  CVE-2026-48818/48817/54283/54282 (FastAPI 0.136 lo admite). `schemathesis` (test-only, constreñía
  starlette<1) movido a **`requirements-dev.txt`**. `pip-audit -r requirements.txt`: **0 vulns**.
- **MOD** `ci.yml` sin ignorelist de pip-audit; schemathesis se instala en su propio paso.

### Limpieza

- **FIX** Tokens de color muertos (`calendar/calendarSoft/tasks/tasksSoft`) eliminados de `tokens.ts`
  (módulos borrados en Pivote 2).
- **MOD** Email de contacto en páginas legales y `SECURITY.md`: `navaroruiz2000@gmail.com` →
  `soporte@fogon.app` (pendiente registrar dominio+buzón).

Verificación: 9/9 smoke tests (admin 33/33), ruff + mypy, ts:check + lint (front + admin), build
admin-web, pip-audit limpio.

---

## [2026-06-20] — EAS: primer build de Android verde (APK preview)

### Frontend (deps)

- **FIX** `frontend/package.json` — añadir `overrides: { eslint-import-resolver-typescript: "3.6.3" }`: la 3.7+ adopta `unrs-resolver` con bindings nativas opcionales por plataforma que rompían `npm ci` en el Linux de EAS (lockfile generado en Windows omitía variantes). Elimina el subárbol `@unrs/*` + `@emnapi/*`.
- **ADD** `@expo/vector-icons@^15.0.3` como dependencia explícita (phantom dep usada por `components/ui/Icon`; npm 11 dejó de hoistearla).
- **ADD** `babel-preset-expo@~54.0.10` como dependencia explícita (phantom dep usada por `babel.config.js`; rompía la fase "Bundle JavaScript").
- **MOD** `package-lock.json` regenerado con npm 11 (consistente y multiplataforma).
- Build resultante: `406f7c4c`, app v1.0.0 (code 1), **FINISHED** → APK instalable.
- Diagnóstico vía `eas build:view <id> --json` (campo `logFiles`) + reproducción local con `npx expo export --platform android`.
- **FIX** `frontend/eas.json` — añadir bloque `env` a los perfiles `preview` y `production` con `EXPO_PUBLIC_API_URL` (Railway prod). `.env.production` está gitignored y EAS no lo sube, así que el primer APK se horneó con la URL vacía (`API_BASE_URL=''` → fallo de red en runtime). Ahora las vars públicas van en `eas.json` (versionado). `EXPO_PUBLIC_RC_KEY` test en preview; la clave RC de producción queda pendiente.

### Vercel (legal)

URLs públicas confirmadas tras `vercel --prod`:
- https://admin-web-theta-pink.vercel.app/privacidad
- https://admin-web-theta-pink.vercel.app/terminos

---

## [2026-06-20] — Legal: Privacy Policy + Términos y Condiciones

### Admin-web (Vercel)

- **ADD** `admin-web/src/app/privacidad/page.tsx` — Política de Privacidad en español (RGPD: responsable, datos recogidos, Gemini billing, terceros, derechos, supresión).
- **ADD** `admin-web/src/app/terminos/page.tsx` — Términos y Condiciones (planes Free/Premium/Familia, IA, propiedad intelectual, legislación española).
- URLs públicas tras el próximo deploy de Vercel:
  - `https://admin-web-theta-pink.vercel.app/privacidad`
  - `https://admin-web-theta-pink.vercel.app/terminos`
- Ambas páginas son requisito obligatorio para App Store y Google Play Store.

---

## [2026-06-20] — UX: 9 correcciones de pantallas principales

### Frontend

- **FIX** `DashboardScreen.tsx` — eliminado botón `person-circle-outline` (logout duplicado con Ajustes) y botón "Actualizar briefing" (redundante: pull-to-refresh lo cubre).
- **FIX** `PantryScreen.tsx` — steppers `+`/`−` sin Alert de confirmación (haptics directo); barra de stock de base 5 → 10 para escala más realista; "Indefinido" → "Sin caducidad"; `colors.calendar` → `colors.brand` en FAB mic y modal audio (módulo Calendario eliminado en Pivote 2).
- **FIX** `SettingsScreen.tsx` — Alert de confirmación antes de cerrar sesión (consistencia con flujo destructivo); typo "alergias medicas" → "alergias médicas".
- **FIX** `ShoppingListScreen.tsx` — `variant="title"` → `variant="display"` en cabecera; `TouchableOpacity` + `Ionicons` reemplazados por `Pressable` + `Icon`/`IconButton` del sistema de diseño.

---

## [2026-06-20] — Bloque A: JTI blocklist + webhook RC + admin panel Vercel

### Seguridad (backend)

- **ADD** `backend/app/core/token_blocklist.py` — `revoke_token(jti, exp)` / `is_token_revoked(jti)` con Redis TTL; fallback en memoria sin Redis.
- **MOD** `backend/app/core/security.py` — `create_access_token` añade claim `jti: uuid4()` a cada token emitido.
- **MOD** `backend/app/api/deps.py` — `get_current_user` verifica el blocklist tras decodificar; tokens revocados → 401 inmediato aunque no hayan expirado.
- **ADD** `POST /api/v1/auth/logout` — invalida el JTI actual en Redis y devuelve `LogoutResponse`. Tokens de otros usuarios no se ven afectados.
- **MOD** `backend/app/schemas/schemas.py` — `LogoutResponse` añadido.
- **MOD** `backend/smoke_test_auth.py` — 4 checks nuevos: logout 200, token revocado 401, token ajeno no afectado. Total: 16/16.

### Webhook RevenueCat

- **MOD** `backend/app/core/config.py` — `REVENUECAT_WEBHOOK_SECRET` configurable.
- **MOD** `backend/app/services/premium.py` — `invalidate_tier_cache(app_user_id)` borra `tier:{id}` de Redis.
- **ADD** `backend/app/api/routers/webhooks.py` — `POST /api/v1/webhooks/revenuecat`: verifica firma Bearer, invalida cache en `INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION / BILLING_ISSUE / PRODUCT_CHANGE`; devuelve 501 sin secreto configurado.
- **MOD** `backend/app/main.py` — webhook router registrado.
- **MOD** `backend/.env.example` — `REVENUECAT_WEBHOOK_SECRET` documentado.

### Admin panel — Vercel

- **ADD** `admin-web/nixpacks.toml` — build/start explícitos para despliegue en Railway/Vercel.
- Panel desplegado en **https://admin-web-theta-pink.vercel.app** (Next.js, Vercel free tier).
- `ALLOWED_ORIGINS=https://admin-web-theta-pink.vercel.app` añadido en Railway para resolver CORS.
- Bootstrap del admin: `POST /api/v1/admin/auth/bootstrap` con `ADMIN_BOOTSTRAP_TOKEN` de Railway.

---

## [2026-06-20] — Fase 5: RevenueCat 3 tiers Free/Premium/Familia

### Backend

- **MOD** `backend/app/services/premium.py` — reescrito con sistema de tiers: `TIER_FREE / TIER_PREMIUM / TIER_FAMILIA`. `is_premium()` devuelve `True` para premium y familia. `is_familia()` solo para familia. Redis cache por `tier:{app_user_id}` TTL 300 s. Fail-open a `TIER_FAMILIA` en error de RC. Sin `REVENUECAT_SECRET_KEY` → `TIER_FAMILIA` (dev mode).
- **ADD** `deps.py` → `requiere_familia` — dependencia FastAPI que lanza HTTP 402 si el tier del usuario < familia.
- **MOD** `backend/app/core/config.py` — `REVENUECAT_FAMILIA_ENTITLEMENT` configurable (default `"familia"`).
- **MOD** `backend/app/api/routers/pantry.py` — nuevo `GET /pantry/recetas/basicas` (free, sin IA, catálogo estático); `/pantry/plan-comidas` y `/pantry/sugerencias` ahora requieren `requiere_familia`; `/pantry/recetas` mantiene `requiere_premium`.
- **MOD** `backend/app/api/routers/perfiles.py` — `POST /perfiles` ahora requiere `requiere_familia`.
- **MOD** 9 smoke tests — añadido `os.environ["REVENUECAT_SECRET_KEY"] = ""` antes de cualquier import para aislar el gate en tests.

### Frontend

- **MOD** `frontend/src/state/purchasesStore.ts` — añadido `isFamilia: boolean`; `checkPremium` → `checkEntitlements`; lógica `familia ⊃ premium` en `_computeTiers`.
- **MOD** `frontend/src/screens/PaywallScreen.tsx` — rediseño completo con 3 cards (Gratis/Premium/Familia). Badge «Plan actual» en tier activo; badge «MEJOR VALOR» en Familia; mapea `PACKAGE_TYPE.MONTHLY` → premium, `PACKAGE_TYPE.ANNUAL` → familia.
- **MOD** `frontend/src/screens/DashboardScreen.tsx` — «Plan de la semana» navega a `Paywall` si `!isFamilia`; icono `lock-closed-outline` y texto «Plan Familia · Desbloquear».
- **MOD** `frontend/src/screens/PantryScreen.tsx` — bifurca fetch: familia → `/pantry/sugerencias`, premium → `/pantry/recetas`, free → `/pantry/recetas/basicas`. Empty state con botón «Ver catálogo» para usuarios free.
- **MOD** `frontend/src/screens/SettingsScreen.tsx` — «Miembros del hogar» muestra upsell + icono lock si `!isFamilia`; botón «Añadir» solo visible con tier familia.

### Documentación

- **MOD** `CLAUDE.md` — animaciones UI, onboarding hero images, corrección estado F6, Fase 5 añadida a fases completadas.

---

## [2026-06-19] (sesión noche) — smoke test rechazar-ingrediente + CI completo + CLAUDE.md

### Tests
- **ADD** `backend/smoke_test_rechazar_ingrediente.py` — 16/16 checks: happy path fallback sin Gemini (respuesta 200, esquema completo), aislamiento multi-tenant (perfil ajeno en ambas direcciones + UUID inexistente → 404), validación de esquema (nombre vacío, ingredientes vacíos, solo espacios, campo extra, sin perfil_id → 422), sin autenticación (401). Primer test del endpoint de Fase 4b.

### CI/CD
- **MOD** `.github/workflows/ci.yml` — añadidos `smoke_test_admin`, `smoke_test_perfiles`, `smoke_test_lista_compra` y `smoke_test_rechazar_ingrediente` al job `backend`. El CI ahora cubre los 9 smoke tests completos (antes solo 5).

### Documentación
- **MOD** `CLAUDE.md` — añadidas secciones: Higgsfield MCP (assets de la app), CI/CD (jobs del workflow), Frontend screens (PlanComidaScreen, HistorialScreen, RecipeDetailScreen), TIMEOUT constants en `api.ts`, `useRecetaHistorial.ts` hook, `smoke_test_rechazar_ingrediente.py` en Commands y Verification.

---

## [2026-06-20] — HistorialScreen + edición perfil hogar + SECURITY.md + seed Railway

### Frontend (ts:check 0 errores · ESLint + Prettier OK)

**HistorialScreen**
- **MOD** `hooks/useRecetaHistorial.ts` — extendido con `fetchHistorial()` (GET `/pantry/recetas/historial`), estado `historial: RecetaHistorial[]` y `loadingHistorial: boolean`. `registrarAccion`/`isLoading` sin cambios (compatibilidad hacia atrás con `RecipeDetailScreen`).
- **ADD** `screens/HistorialScreen.tsx` — FlatList cronológico de recetas cocinadas/rechazadas. Punto de color (verde/gris), badge de acción (Cocinada/Rechazada), fecha formateada. `LoadingView` en primera carga; `EmptyState` si no hay entradas; pull-to-refresh.
- **MOD** `navigation/AppNavigator.tsx` — ruta `Historial` en `RootStackParamList` + `Stack.Screen` con `slide_from_right`. Import de `HistorialScreen`.
- **MOD** `screens/DashboardScreen.tsx` — tarjeta Pressable «Historial de recetas» (mismo patrón visual que «Plan de la semana»). `NavProp` extendido con `Historial`.

**Edición perfil del hogar desde Ajustes**
- **MOD** `screens/SettingsScreen.tsx` — nueva tarjeta «Perfil del hogar» (entre Cuenta y Sesión). Carga `GET /onboarding` al montar; muestra nº comensales + gustos culinarios actuales. Botón «Editar» abre modal bottom-sheet con chip-picker de comensales (1–6) y campo de texto para gustos (coma-separados). Guarda con `POST /onboarding` (upsert).

### Documentación y seguridad

**SECURITY.md actualizado (F-QA2 Bloque 5 — addendum post Fase 3)**
- **MOD** `SECURITY.md` — §5.3: documenta que `_bloque_perfiles_individuales()` envía apodos de miembros a Gemini (pseudónimos, no nombres legales). §8: tabla explícita de 6 tablas en el alcance RGPD (`perfiles_individuales`, `lista_compra` incluidas). §9 R9: riesgo aceptado registrado para apodos en LLM.

### Producción

**Seed del recetario maestro en Railway**
- Ejecutado `seed_recetario.py` contra Railway Postgres (proxy público `kodama.proxy.rlwy.net:59017`). 15 recetas insertadas, 0 ya existían. `_bloque_recetario` activo en producción desde esta sesión.
- Problema resuelto en el camino: `asyncpg` tenía binario roto en el venv Windows → reinstalado con `pip install --force-reinstall asyncpg`.

---

## [2026-06-19] — PlanComidaScreen + Auditoría UI + FlatList PantryScreen + seed recetario

### Frontend (ts:check 0 errores · ESLint + Prettier OK)

**Pantalla Plan de la semana**
- **ADD** `screens/PlanComidaScreen.tsx` — pantalla dedicada para el plan semanal de comidas. Muestra 7 días (comida + cena por día) en tarjetas con FlatList. `AIDisclaimerBanner` si generado por IA. Estado vacío, loading y error con reintento. Botón de regenerar en header. `timeoutMs: TIMEOUT.AI`.
- **MOD** `navigation/AppNavigator.tsx` — nueva ruta `PlanComidas` en el Stack (slide_from_right). Import de `PlanComidaScreen`.
- **MOD** `screens/DashboardScreen.tsx` — tarjeta "Plan de la semana" Pressable bajo las alertas de despensa; navega a `PlanComidas`. Import de `useNavigation`.

**Auditoría de accesibilidad y touch targets (mobile-app-design skill)**
- **FIX** `src/theme/tokens.ts` — `micro` fontSize 10 → 11pt (mínimo WCAG; 10pt era demasiado pequeño).
- **FIX** `screens/ShoppingListScreen.tsx` — variante inválida `h1` → `title`; checkbox `TouchableOpacity` 44×44pt con `accessibilityRole="checkbox"` + `accessibilityState`; trash `hitSlop` 8 → 13pt (18+26=44pt); `clearBtn` paddingVertical 4 → 12pt.
- **FIX** `screens/PantryScreen.tsx` — steppers ± `hitSlop` 6 → 9pt (26+18=44pt); añadidos `accessibilityLabel` en ambos botones.
- **FIX** `screens/SettingsScreen.tsx` — textos obsoletos post-Pivote 2 corregidos ("tareas y calendario" → "historial de recetas"); edit/delete Pressable `hitSlop` 8 → 14pt (16+28=44pt).
- **FIX** `screens/OnboardingScreen.tsx` — copy de los 3 slides actualizado a app 100% comida (eliminadas referencias a eventos/tareas); page dots `hitSlop` 8 → 19pt (6+38=44pt); `accessibilityLabel` en cada dot.
- **FIX** `screens/OnboardingProfileScreen.tsx` — "Ahora no" `hitSlop` 8 → 12pt + `paddingVertical: spacing.sm` (≥44pt); añadido `accessibilityLabel="Saltar configuración del perfil"`.

**FlatList virtualization en PantryScreen**
- **MOD** `screens/PantryScreen.tsx` — reemplazado `<Screen>+ScrollView+map()` con `FlatList` como root scrollable. `PantryItemCard` extraído como `React.memo` fuera del componente para que FlatList pueda saltarse re-renders de items no cambiados. `ListHeaderComponent` (título, métricas, filtros, acciones lote), `ListEmptyComponent`, `ListFooterComponent` (recetas IA + plan semanal). `refreshControl` directo en FlatList. Safe area manual vía `useSafeAreaInsets`. `useCallback` para hooks movidos antes de early-returns (rules of hooks). `Screen` ya no se importa en este archivo.

### Backend

**Smoke test lista de la compra**
- **ADD** `smoke_test_lista_compra.py` — 27 checks: CRUD básico (14), borrado masivo de comprados (5), aislamiento multi-tenant (4), validación de schema (7), sin autenticación (5). 27/27 en verde.
- **MOD** `CLAUDE.md` — añadido `python smoke_test_lista_compra.py` a la sección Commands y Verification.

**Seed del recetario maestro**
- **ADD** `seed_recetario.py` — script idempotente que puebla `recetario_maestro` con 15 recetas mediterráneas españolas tradicionales: Paella valenciana, Gazpacho andaluz, Cocido madrileño, Tortilla española, Lentejas con chorizo, Pisto manchego, Pollo al ajillo, Fabada asturiana, Salmorejo cordobés, Berenjenas rellenas, Sopa de ajo castellana, Arroz con leche, Judías verdes con patatas, Bacalao al pil-pil, Menestra de verduras. 9 marcadas como `aprovechamiento=True`. Activa `_bloque_recetario` en los prompts de Gemini. Ejecutar contra Railway con `DATABASE_URL` de producción para activar en prod.

---

## [2026-06-19] — Lista de la compra

### Backend (smoke tests sin regresiones)
- **ADD** Migración Alembic `c6d8f0a1b2e3` — tabla `lista_compra` (id, hogar_id FK→hogares CASCADE, nombre, cantidad, unidad, is_checked, is_deleted, timestamps). Dialect-aware SQLite/PostgreSQL.
- **ADD** `models/models.py` — modelo `ListaCompraItem` + relación `Hogar.lista_compra` (cascade `all, delete-orphan`).
- **ADD** `schemas/schemas.py` — `ListaCompraItemCreate` / `ListaCompraItemUpdate` / `ListaCompraItemResponse`. `extra='forbid'`. Validator `limpiar_nombre`.
- **ADD** `repositories/lista_compra.py` — `ListaCompraRepository`: `list_by_hogar` (pendientes primero), `create`, `get_by_id`, `update`, `delete` (soft), `delete_checked` (bulk soft delete).
- **ADD** `api/routers/lista_compra.py` — 5 endpoints bajo `/lista-compra`: `GET` (list), `POST` (add), `PATCH /{id}` (toggle/edit), `DELETE /{id}` (remove), `DELETE` (limpiar marcados). Todos protegidos por JWT.
- **MOD** `api/deps.py` — añadida `get_lista_compra_repo`.
- **MOD** `main.py` — registrado `lista_compra.router`.

### Frontend (ts:check 0 errores)
- **ADD** `types/types.ts` — interfaz `ListaCompraItem`.
- **ADD** `hooks/useListaCompra.ts` — `pendientes` / `comprados` separados; `addItem`, `toggleItem`, `deleteItem`, `clearChecked` con optimistic update local.
- **ADD** `screens/ShoppingListScreen.tsx` — pantalla completa: secciones "Por comprar" / "Comprados", checkbox tap para marcar, swipe-to-delete con Alert de confirmación, barra de input inferior para añadir ítems, "Limpiar marcados" visible solo si hay ítems comprados. Estado vacío con ícono de carrito.
- **MOD** `navigation/AppNavigator.tsx` — nueva pestaña "Compra" (icono `cart`) entre Despensa y Ajustes.

---

## [2026-06-19] — Notificaciones locales de caducidad

### Frontend
- **ADD** `src/lib/notifications.ts` — servicio de notificaciones locales: `requestNotificationPermissions()` (crea canal Android + pide permisos al SO), `programarAlertasCaducidad(alertas)` (cancela las anteriores y programa hasta 2 notificaciones para el día siguiente a las 9:00 — una para urgentes ≤3 días y otra para próximos ≤umbral). Sin red ni credenciales. Devuelve en silencio si el permiso no fue concedido.
- **MOD** `src/hooks/usePantry.ts` — llama a `programarAlertasCaducidad` tras cada fetch de despensa. Fire-and-forget (`.catch(() => {})`): no bloquea la UI si falla.
- **MOD** `App.tsx` — llama a `requestNotificationPermissions()` al montar (una sola vez). El usuario ve el diálogo del sistema en el primer arranque.

---

## [2026-06-19] — F6: EAS Build — configuración de producción

### Frontend
- **CFG** `app.json` — reescrito completo: `name`, `slug`, `version`, `orientation`, `icon`, `splash` (fondo `#6366F1`), `newArchEnabled: true`, `userInterfaceStyle: light`.
  - iOS: `bundleIdentifier: com.wallytown1.asistentehogar`, permisos `NSMicrophoneUsageDescription` y `NSCameraUsageDescription` en `infoPlist`.
  - Android: `package: com.wallytown1.asistentehogar`, `adaptiveIcon` con fondo `#6366F1`, permisos `RECORD_AUDIO` y `CAMERA`.
  - Plugins: `expo-secure-store`, `expo-notifications` (icono + color de marca), `expo-image-picker` (strings de permiso en español, sin micrófono).
  - `extra.eas.projectId`: placeholder — reemplazar con ID real tras `eas init`.
- **ADD** `eas.json` — perfiles `development` (devClient, iOS simulator), `preview` (APK interno), `production` (autoIncrement). Sección `submit.production` con placeholders para Apple y Google.
- **ADD** `assets/` — placeholders PNG (icon 1024×1024, splash 1284×2778, adaptive-icon 1024×1024, favicon 32×32, notification-icon 96×96 blanco transparente). Sustituir por assets reales antes del build de stores.

### Pendiente para stores
- Sustituir `assets/*.png` por arte real (icon 1024×1024, splash, notification icon monocromático).
- Ejecutar `eas init` en `frontend/` para obtener el `projectId` real.
- Rellenar `submit.production` en `eas.json` con Apple ID, App Store Connect App ID, Team ID y service account de Google Play.

---

## [2026-06-19] — Fase 4: Recetario en prompts + ajuste de perfil al rechazar receta

### Backend (7/7 smoke suites sin regresiones)

**4a — Inyección del recetario maestro en prompts LLM**
- **ADD** `services/llm.py` — `_bloque_recetario(recetario)`: construye el bloque de referencia del recetario maestro para el prompt. Limita a 15 recetas activas, marca `[aprovechamiento]`. Cadena vacía si el catálogo está vacío → sin impacto en comportamiento actual.
- **MOD** `services/llm.py` — `generate_recipe_suggestions` y `generate_meal_plan` aceptan nuevo parámetro opcional `recetario: list[RecetaMaestraResponse] | None`. El bloque entra en `prompt_usuario` → forma parte de la clave de caché SHA-256 (cambios en catálogo invalidan caché automáticamente).
- **ADD** `api/deps.py` — `get_recetario_repo()`: dependencia FastAPI para `RecetaMaestraRepository`.
- **MOD** `api/routers/pantry.py` — `GET /pantry/recetas`, `/plan-comidas`, `/sugerencias` inyectan `recetario_repo` y pasan el catálogo activo a las funciones LLM.

**4b — Ajuste de perfil al rechazar ingrediente**
- **ADD** `services/llm.py` — `identify_rejected_ingredients(nombre_receta, ingredientes, excluir_actuales)`: llama a Gemini con structured output para identificar el ingrediente problemático. Devuelve `[]` sin API key (graceful degradation). Sin caché (llamada barata, contexto variable). Filtra ingredientes ya excluidos para evitar duplicados.
- **ADD** `schemas/schemas.py` — `RechazarIngredienteRequest` / `RechazarIngredienteResponse`. `extra='forbid'`. Validator en `ingredientes_receta` (no vacía).
- **ADD** `api/routers/historial.py` — `POST /pantry/recetas/rechazar-ingrediente`: valida que `perfil_id` pertenece al hogar del JWT (→ 404 si no), llama al LLM, actualiza `excluir_ingredientes` del perfil si hay ingredientes nuevos. Escritura de bajo riesgo + reversible (sin rate limit propio).

### Frontend (ts:check 0 errores · ESLint + Prettier OK)
- **ADD** `hooks/usePerfiles.ts` — hook de carga única al montar; devuelve `{ perfiles, loading }`.
- **ADD** `types/types.ts` — interfaz `RechazarIngredienteResponse`.
- **MOD** `screens/RecipeDetailScreen.tsx` — `handleRechazada` extendido: si 0 perfiles → back directo; 1 perfil → ajuste automático; >1 perfiles → `Alert` selector. `enviarRechazo()` llama al nuevo endpoint y muestra Alert con "Deshacer" (PATCH `/perfiles/{id}` con lista revertida) si se guardaron ingredientes. Todo best-effort: errores silenciosos para no bloquear el flujo de rechazo.

---

## [2026-06-19] — Fase 3: Perfiles individuales de miembros del hogar

### Backend (smoke_test_perfiles.py: 20/20 · suites existentes sin regresiones)
- **ADD** Migración Alembic `a5b3c1d9e7f2` — tabla `perfiles_individuales` (id, hogar_id FK→hogares CASCADE, nombre str 100, preferencias_dieta JSON, excluir_ingredientes JSON, is_deleted bool, created_at, updated_at). Dialect-aware. Index en hogar_id.
- **ADD** `models/models.py` — modelo `PerfilIndividual` + relación `Hogar.perfiles_individuales` (cascade `all, delete-orphan`).
- **ADD** `schemas/schemas.py` — `PerfilIndividualCreate` / `PerfilIndividualUpdate` / `PerfilIndividualResponse`. Validator `limpiar_lista`: strip, dedupe, max 100 chars/item. `extra='forbid'`.
- **ADD** `repositories/perfiles_individual.py` — `PerfilIndividualRepository` con `list_by_hogar`, `get_by_id`, `create` (límite 10 por hogar → `ReglaNegocioError`), `update`, `delete` (soft). Aislamiento multi-tenant en todas las queries.
- **ADD** `api/routers/perfiles.py` — 5 endpoints bajo `/perfiles` protegidos con `get_current_user` + `get_hogar_id`.
- **MOD** `api/deps.py` — añadida `get_perfiles_repo`.
- **MOD** `services/llm.py` — helper `_bloque_perfiles_individuales(perfiles)` incluido en el prompt de `generate_recipe_suggestions` y `generate_meal_plan`.
- **MOD** `api/routers/pantry.py` — `GET /pantry/recetas`, `/plan-comidas`, `/sugerencias` consultan perfiles individuales del hogar y los inyectan al LLM.
- **MOD** `main.py` — registrado `perfiles.router`.
- **ADD** `smoke_test_perfiles.py` — 20 checks: CRUD básico (12), límite 10 (2), aislamiento multi-tenant (3), validación esquema (3), sin autenticación (2). 20/20 OK.
- **RGPD art. 9:** solo se almacenan preferencias culinarias (no alergias/intolerancias médicas).

### Frontend (ts:check 0 errores)
- **MOD** `types/types.ts` — interfaz `PerfilIndividual`.
- **MOD** `screens/SettingsScreen.tsx` — tarjeta «Miembros del hogar» con lista de perfiles + botones editar/eliminar + modal de añadir/editar (nombre, preferencias de dieta, ingredientes a evitar, separados por comas). Nota explícita: "Solo preferencias culinarias — no uses este campo para alergias medicas."

---

## [2026-06-19] — admin-web: panel Next.js para prompts y recetario maestro

### admin-web (Next.js 14, App Router, TypeScript, Tailwind — build 0 errores)
- **ADD** `app/login/page.tsx` — formulario de login con `POST /admin/auth/login`, token en localStorage.
- **ADD** `app/prompts/page.tsx` — lista todos los templates de prompt; `PromptEditor` permite editar `system_instruction` + toggle activo con badge de versión. Nota: la filosofía mediterránea se añade automáticamente server-side (no editable).
- **ADD** `app/recetario/page.tsx` — tabla de recetas maestras con filtro activa/inactiva y botón «Nueva receta» que abre `RecetaForm` en modal.
- **ADD** `app/recetario/[id]/page.tsx` — formulario de edición de receta con DELETE.
- **ADD** `components/AdminNav.tsx` — barra lateral: Prompts | Recetario | Logout.
- **ADD** `components/PromptEditor.tsx` — textarea + Guardar + badge de versión + toggle activo.
- **ADD** `components/RecetaForm.tsx` — campos nombre / ingredientes (tags) / pasos / categoría / temporada / aprovechamiento.
- **ADD** `lib/api.ts` — `adminApi` tipado: login, CRUD prompts, CRUD recetario.
- **ADD** `lib/auth.ts` — `getToken` / `setToken` / `clearToken` sobre localStorage.
- **ADD** `.gitignore` — excluye `node_modules/`, `.next/`, `.env.local`.

---

## [2026-06-19] — Mejora #7: umbral de caducidad configurable por hogar

### Frontend (ts:check 0 errores)
- **ADD** `state/pantrySettingsStore.ts` — Zustand store con `diasUmbral` (default 6 días), persistido en `expo-secure-store`. Expone `OPCIONES_UMBRAL = [3, 6, 10, 14]` y `hydrate()`.
- **MOD** `lib/caducidad.ts` — `getSemaforoCaducidad(dias, umbral = 6)` acepta umbral configurable. El borde "urgente" (≤3 días) es fijo; "Consumir pronto" empieza en `dias > 3 && dias <= umbral`.
- **MOD** `screens/PantryScreen.tsx` — lee `diasUmbral` del store y lo pasa a `getItemStatus(item, umbral)`.
- **MOD** `screens/SettingsScreen.tsx` — tarjeta «Despensa» con Chip picker 3d / 6d / 10d / 14d. El valor se persiste y se aplica inmediatamente al semáforo del inventario.
- **MOD** `navigation/AppNavigator.tsx` — `hydratePantrySettings()` en el mismo `useEffect` que `hydrate()` de auth.

---

## [2026-06-18] — Foto de nevera: UI completa en PantryScreen

### Frontend (ts:check 0 errores)
- **ADD** FAB cuaternario `camera-outline` (`colors.success`, bottom 216) en `PantryScreen` — acceso directo a la funcionalidad de foto de nevera (premium gate).
- **ADD** Handler `handleFotoNevera` — premium gate → permiso de cámara → Alert para elegir entre cámara y galería → `procesarFotoNevera`.
- **ADD** Handler `procesarFotoNevera` — llama a `POST /pantry/foto-nevera` con `imagen_base64` y `fecha_referencia`; muestra overlay de escaneo durante el análisis; mapea resultado a `OcrItem[]` y abre modal de revisión.
- **ADD** Handlers `toggleFotoItem` / `confirmarFotoItems` — misma mecánica de selección en lote que el OCR de ticket.
- **ADD** Overlay `fotoScanning` — modal fade con spinner verde ("Analizando nevera...").
- **ADD** Modal de revisión `fotoReviewVisible` — lista de ingredientes con checkboxes, sección "Recetas express posibles" cuando `sugerencias_rapidas` no está vacío, botones "Añadir seleccionados" / "Cancelar", `AIDisclaimerBanner`.

---

## [2026-06-18] — RecipeDetailScreen: pantalla de detalle de receta

### Frontend (ts:check 0 errores)
- **ADD** `screens/RecipeDetailScreen.tsx` — pantalla completa de receta con header de vuelta, badges de tiempo e ingredientes, lista de ingredientes con iconos checkmark, pasos numerados con burbuja de color marca, y footer fijo con botones "Marcar como cocinada" (primario) y "No me gusta" (ghost). Llama a `useRecetaHistorial` y navega atrás tras registrar la acción.
- **MOD** `navigation/AppNavigator.tsx` — añadida ruta `RecetaDetalle: { receta: RecetaSugerida }` al `RootStackParamList`; `Stack.Screen` con `animation: 'slide_from_right'`.
- **MOD** `screens/PantryScreen.tsx` — botón "Ver" en tarjeta de receta ahora navega a `RecetaDetalle` en lugar de mostrar un `Alert`. Los botones "Cocinada" / "No me gusta" se mantienen también en la tarjeta para acción rápida.

---

## [2026-06-18] — Fase 2: Panel admin — prompts dinámicos, recetario maestro, admin JWT

### Backend (verificado: 26/26 smoke_test_admin + 5 suites existentes en verde)
- **ADD** Migración Alembic `e1f3a5c70d84` — tablas globales (sin `hogar_id`): `admin_users`, `prompt_templates`, `recetario_maestro`. Dialect-aware (SQLite dev / PostgreSQL prod).
- **ADD** Modelos ORM `AdminUser`, `PromptTemplate`, `RecetaMaestra` en `models.py`.
- **ADD** `AdminUserRepository`, `PromptTemplateRepository`, `RecetaMaestraRepository` en `repositories/`.
- **ADD** `AdminAuthService` (`services/admin_auth.py`) — bcrypt + JWT firmado con `ADMIN_JWT_SECRET_KEY` (secreto separado del JWT de familias). Payload incluye `role: "admin"`; tokens cruzados devuelven 401.
- **ADD** `PromptConfigService` (`services/prompt_config.py`) — lee `system_instruction` de BD con caché TTL 5 min; siempre añade `_FILOSOFIA_MEDITERRANEA` al final (no-removible server-side).
- **ADD** Routers `admin_auth.py`, `admin_prompts.py`, `admin_recetario.py` bajo `/api/v1/admin/*`.
  - `POST /admin/auth/bootstrap` — crea el primer admin (501 si no hay token env; 409 si ya existe).
  - `POST /admin/auth/login` — devuelve `AdminTokenResponse`.
  - `GET/PATCH /admin/prompts` + `GET/PATCH /admin/prompts/{clave}` — CRUD de templates con invalidación de caché.
  - `GET/POST /admin/recetario` + `GET/PATCH/DELETE /admin/recetario/{id}` — CRUD recetario maestro (hard delete).
- **MOD** `core/config.py` — añadidos `ADMIN_JWT_SECRET_KEY`, `ADMIN_JWT_EXPIRE_MINUTES` (480), `ADMIN_BOOTSTRAP_TOKEN`.
- **MOD** `services/llm.py` — `generate_recipe_suggestions` y `generate_meal_plan` aceptan `prompt_config: PromptConfigService | None`; usa `TYPE_CHECKING` para evitar importación circular.
- **MOD** `api/routers/pantry.py` — los 3 endpoints de recetas/plan/sugerencias inyectan `PromptConfigService` y lo pasan a las funciones LLM.
- **ADD** `backend/.env.example` — documentadas las 3 nuevas variables de entorno.
- **ADD** `smoke_test_admin.py` — 26 checks: bootstrap, login, aislamiento JWT cruzado, CRUD prompts, guardia `_FILOSOFIA_MEDITERRANEA`, CRUD recetario.

### admin-web (Next.js 14, 0 errores TypeScript, 7 rutas compiladas)
- **ADD** `admin-web/` — panel de administración en Next.js 14 App Router + TypeScript + Tailwind CSS.
  - `login/page.tsx` — formulario de login admin → `POST /admin/auth/login`.
  - `prompts/page.tsx` — lista de templates con editor inline (textarea + badge de versión + checkbox activo). Nota: "La filosofía mediterránea se añade automáticamente".
  - `recetario/page.tsx` — tabla de recetas maestras + modal "Nueva receta".
  - `recetario/[id]/page.tsx` — formulario de edición con TagInput para ingredientes/pasos.
  - `lib/api.ts` — helpers tipados con Bearer auth; `lib/auth.ts` — gestión de token en localStorage.
  - `components/AdminNav.tsx`, `PromptEditor.tsx`, `RecetaForm.tsx`.

---

## [2026-06-18] — Pivote 2: App exclusivamente de comida, stock y recetas

### Decisión de producto
La app pasa a ser **100% comida**. Se eliminaron de raíz los módulos de **Eventos (calendario)**
y **Tareas (domésticas)**. El núcleo queda: stock real de la despensa → recetas mediterráneas
españolas de aprovechamiento. Ver `ARCHITECTURE_MAP.md` para el mapa de sistema actualizado.

Se relaja la restricción "IA pasiva": se permiten escrituras automáticas de bajo riesgo y
reversibles (descontar stock al terminar receta, ajustar perfil vía function calling) con undo
visible. Confirmación explícita sigue siendo obligatoria para acciones destructivas.

### Backend (verificado: smoke tests en verde)
- **DEL** `routers/calendar.py`, `services/calendar.py`, `repositories/calendar.py` — eliminados.
- **DEL** `routers/tasks.py`, `repositories/task.py` — eliminados.
- **DEL** Modelos `EventoCalendario`, `TareaHogar` de `models.py`; relaciones `eventos`/`tareas` de `Hogar`.
- **DEL** `EventoNotFoundError`, `TaskNotFoundError` de `repositories/exceptions.py`.
- **DEL** Schemas `Evento*`, `Tarea*`, `Conflicto*`, `CalendarAgenda*`, `InterpretarEvento*`, `InterpretarTarea*`.
- **MOD** `DashboardUnifiedContext` — quitados `eventos_hoy`, `tareas_pendientes`, `conflictos_agenda`.
- **MOD** `services/dashboard.py` — briefing solo con métricas de despensa.
- **MOD** `services/llm.py` — eliminadas `interpret_event_text`, `interpret_task_text`; briefing sin anonimizador (datos de pantry no contienen nombres).
- **MOD** `api/deps.py` — eliminadas deps de calendar/tasks; `get_dashboard_service` simplificado.
- **MOD** `jobs/purge.py` — purga solo `inventario_alimentos`.
- **MOD** `repositories/user.py` — `delete_hogar_fisico` sin selectinload de tareas/eventos.
- **ADD** Migración Alembic `d3e5f7b91a26` — `DROP TABLE eventos_calendario`, `DROP TABLE tareas_hogar` (downgrade reversible).

### Frontend (ts:check 0 errores)
- **DEL** `screens/CalendarScreen.tsx`, `screens/AgendaScreen.tsx`, `screens/TasksScreen.tsx`.
- **DEL** `hooks/useCalendar.ts`, `hooks/useTasks.ts`.
- **MOD** `navigation/AppNavigator.tsx` — tabs: **Inicio · Despensa · Ajustes** (eliminada Agenda).
- **MOD** `types/types.ts` — eliminados tipos de eventos, tareas, conflictos; `DashboardData` simplificado.
- **MOD** `screens/DashboardScreen.tsx` — solo briefing + alertas de despensa.

### Documentación
- **ADD** `ARCHITECTURE_MAP.md` — mapa de sistema Mermaid completo (sistema, ER, flujos, monetización, fases).
- **MOD** `CLAUDE.md`, `ENDPOINTS.md`, `LEGALIDAD.md`, `ESTADO_ACTUAL.md`, `DISENO_UI.md`, `MEJORAS_PENDIENTES.md`.

---

## [2026-06-18] — F-PIVOT #3: Entrada por audio NL

### Backend
- **ADD** `POST /api/v1/pantry/audio` (premium) — endpoint en `routers/pantry.py` que recibe texto transcrito y lo pasa a `interpret_pantry_text` de Gemini. Devuelve propuesta de alimentos (el usuario confirma antes de añadir). Rate limit: 20/5 min (compartido con `/interpretar`).

### Frontend
- **ADD** FAB de micrófono en `PantryScreen` — abre modal de entrada de texto con dictado nativo (teclado iOS/Android integrado, sin nuevas dependencias). El usuario habla → dicta el texto → envía al endpoint.

---

## [2026-06-18] — F-PIVOT #4: Foto de nevera (backend)

### Backend
- **ADD** `analyze_fridge_photo()` en `services/llm.py` — Gemini Vision multimodal (imagen base64), devuelve lista de alimentos detectados + sugerencias de recetas express.
- **ADD** `POST /api/v1/pantry/foto-nevera` (premium) en `routers/pantry.py` — schemas `FotoNeveraRequest` / `FotoNeveraResponse`. Rate limit: 10/h. Requiere `GEMINI_API_KEY`.
- **ADD** `foto_nevera_rate_limiter` en `core/rate_limit.py`.

### Frontend
- UI pendiente de integrar en el Home redesign (botón de cámara en `PantryScreen`). El backend está listo.

---

## [2026-06-18] — F-PIVOT #5: Historial de recetas + aprendizaje de comportamiento

### Backend (verificado: 59 smoke tests en verde, incl. 9 checks de historial)
- **ADD** Modelo `RecetaHistorial` (`models.py`) — registra acciones del hogar sobre recetas
  sugeridas (`accion`: `cocinada` | `rechazada`). Aislamiento multi-tenant vía `hogar_id` (JWT).
- **ADD** Migración Alembic `c2d4f6a80e04` — tabla `recetas_historial` compatible SQLite+Postgres.
- **ADD** `RecetaHistorialCreate` / `RecetaHistorialResponse` en `schemas.py` con `extra='forbid'`
  y validación de acción (`cocinada` | `rechazada`).
- **ADD** `RecetaHistorialRepository` (`repositories/historial.py`) — `registrar` + `get_recientes`.
- **ADD** `RecetaHistorialService` (`services/historial.py`).
- **ADD** Router `historial.py` — `POST /api/v1/pantry/recetas/historial` (201) +
  `GET /api/v1/pantry/recetas/historial` (lista últimas 20 entradas).
- **ADD** Helper `_bloque_historial` en `llm.py` — inyecta señales en el prompt de Gemini:
  cocinadas recientes (evitar repetir) + rechazadas (no sugerir nunca). Forma parte de la clave
  de caché al entrar en `prompt_usuario`.
- **MOD** `generate_recipe_suggestions` acepta `historial: list[RecetaHistorialResponse] | None`.
- **MOD** Endpoints `/pantry/recetas`, `/pantry/sugerencias` obtienen historial vía
  `RecetaHistorialService` e inyectan el contexto de comportamiento en cada llamada a Gemini.

### Frontend
- **ADD** `RecetaHistorial` interface en `types.ts`.
- **ADD** Hook `useRecetaHistorial` (`hooks/useRecetaHistorial.ts`) — `registrarAccion` +
  loading state por receta individual.
- **MOD** `PantryScreen.tsx` — botones «Cocinada» / «No me gusta» en cada tarjeta de receta;
  tras registrar la acción se recarga automáticamente la lista de sugerencias (caché invalida
  porque el historial cambia el hash del prompt).

---

## [2026-06-18] — F-PIVOT #6: Recetas personalizadas por perfil + decisión de arquitectura

### Decisión de arquitectura del motor de recetas: HÍBRIDA
- Fase 1 (en curso): generativo + personalización por perfil + aprendizaje por historial (#5).
- Fase 2: recetario base canónico (cientos de platos) como ancla de calidad.
- Fase 3: recomendador sobre catálogo + generativo. Ver `MEJORAS_PENDIENTES.md`.

### Personalización por perfil (F-PIVOT #6, verificado: 5 suites smoke en verde)
- **ADD** Helper `_bloque_perfil` en `llm.py` — inyecta `gustos_culinarios` + `num_comensales`
  en los prompts de `generate_recipe_suggestions` y `generate_meal_plan`. El bloque entra en
  `prompt_usuario` → forma parte de la clave de caché (perfiles distintos = sugerencias distintas).
- **MOD** Ambas funciones LLM aceptan `perfil: PerfilHogarResponse | None = None` (retrocompatible).
- **MOD** Router `pantry.py` — los 3 endpoints (`/pantry/recetas`, `/plan-comidas`, `/sugerencias`)
  obtienen el perfil vía `OnboardingService` (inyectado) y lo pasan a las funciones LLM.
- Sin intolerancias/alergias (datos de salud pospuestos); el perfil enviado a Gemini es no sensible.

---

## [2026-06-18] — F-PIVOT #2: Perfil de hogar + onboarding

### Backend (verificado: 5 suites smoke en verde, incl. 16 checks de onboarding)
- **ADD** Modelo `PerfilHogar` (`models.py`) — un perfil por hogar (`hogar_id` único), relación
  con cascade desde `Hogar` (el borrado de cuenta RGPD arrastra el perfil).
- **ADD** Migración Alembic `a1c3e5f70b92` — tabla `perfil_hogar` (`gustos_culinarios` JSON,
  `num_comensales` INT). Upgrade+downgrade probados en SQLite.
- **ADD** Schemas `OnboardingRequest` / `PerfilHogarResponse` (`extra='forbid'`, validación de
  `num_comensales` 1–20 y limpieza de gustos). El `extra='forbid'` bloquea que se cuelen
  alergias/intolerancias (datos de salud) por error.
- **ADD** `PerfilHogarRepository` (upsert), `OnboardingService`, router `GET`/`POST /api/v1/onboarding`
  (hogar_id siempre del JWT), cableado en `deps.py` y `main.py`.
- **Decisión RGPD:** esta iteración guarda SOLO datos no sensibles. Alergias/intolerancias
  (art. 9) se posponen a una iteración con flujo de consentimiento explícito dedicado.

### Frontend (ts:check 0 errores)
- **ADD** `OnboardingProfileScreen` — encuesta de gustos (chips mediterráneos) + nº de comensales
  (stepper), estética Tierra Cálida. Saltable ("Ahora no").
- **ADD** Hook `useOnboarding` — gate robusto sin depender de códigos de estado: flag local +
  GET /onboarding (200 → ya tiene perfil; fallo → mostrar encuesta saltable).
- **MOD** `AppNavigator` — nuevo componente `AuthedApp` que monta el gate de perfil SOLO con
  sesión activa (el GET /onboarding nunca corre sin token).
- **ADD** Tipo `PerfilHogar` en `types.ts`.

---

## [2026-06-17] — Pivote estratégico: Recetas mediterráneas españolas

### F-PIVOT #1 — Filosofía mediterránea en prompts LLM (implementado)
- **ADD** `backend/app/services/llm.py` — constante de módulo `_FILOSOFIA_MEDITERRANEA`
  (restricción no-negociable, ver `CLAUDE.md`) inyectada en `generate_recipe_suggestions`
  y `generate_meal_plan`. Cocina mediterránea española tradicional y de aprovechamiento:
  sofritos, ingredientes frescos y de temporada. Prohíbe explícitamente fusiones impropias
  (pasta con teriyaki, paella con curry, gazpacho con leche de coco).
- Fuente única compartida → ambos prompts no pueden desincronizarse. Verificado: import OK,
  `smoke_test_modules.py` 43/43.

### Rediseño visual — Sistema "Tierra Cálida Mediterránea" (implementado)
- **MOD** `frontend/src/theme/tokens.ts` — nueva paleta cálida (marrón arcilla `#8B5E3C`,
  lino `#FAF7F2`, beige, terracota), reemplaza el índigo `#6366F1`. Radios más orgánicos,
  sombras warm-tinted. Palanca única: cambia el look global sin tocar pantallas.
- **ADD** `frontend/src/lib/caducidad.ts` — `getSemaforoCaducidad`: semáforo centralizado
  de 3 niveles (fresco/pronto/urgente), umbrales alineados con backend (≤6 días) y
  notificaciones (≤3 días). Aplicado en `PantryScreen` y `DashboardScreen`.
- **FIX** Eliminados todos los colores hardcodeados residuales del sistema índigo viejo:
  hex en `CalendarScreen`/`SettingsScreen`/`DashboardScreen` → tokens semánticos; ripples
  Android índigo `rgba(99,102,241,…)` en `Button`/`Chip`/`Card`/`IconButton` → marrón cálido.
  `grep` de índigo → 0 coincidencias. `ts:check` 0 errores.
- **ADD** `DESIGN.md` — sistema de diseño documentado (síntesis Mastercard + Airbnb + Notion).
- **CFG** Skill `mobile-app-design` instalado en `~/.claude/skills/` (reglas RN nativas).

### Dirección del producto
- **MOD** Enfoque principal cambiado de "gestión del hogar generalista" a **generación de recetas
  mediterráneas españolas tradicionales y de aprovechamiento** basadas en el stock real de la despensa.
- Filosofía gastronómica: sofritos, ingredientes frescos, cocina de temporada. Sin fusiones incorrectas.
- Función secundaria: planificación semanal de menús + calendario familiar (complemento).

### Métodos de entrada planificados (F-PIVOT)
- `POST /pantry/audio` — entrada por voz en NL (micro-ajustes rápidos, IA pasiva).
- `POST /pantry/foto-nevera` — Gemini Vision analiza ingredientes visibles (IA pasiva, premium).
- `POST /onboarding` — perfil de hogar: gustos, intolerancias, alergias, nº comensales.
- Tabla `perfil_hogar` pendiente de migración Alembic.

### Documentación actualizada (rama `feat/pivote-recetas-mediterraneas`)
- **MOD** `CLAUDE.md` — nuevo overview, filosofía mediterránea en constraints LLM, fases actualizadas.
- **MOD** `01_CONTEXTO_Y_ARQUITECTURA_APP.md` — v3.0: schema `perfil_hogar`, endpoints planificados, tabla LLM.
- **MOD** `ENDPOINTS.md` — Despensa marcada como función principal; 3 endpoints planificados añadidos.
- **MOD** `ESTADO_ACTUAL.md` — nueva sección de pivote, "qué hace la app" actualizado, deuda técnica.
- **MOD** `MEJORAS_PENDIENTES.md` — backlog reescrito con prioridades F-PIVOT (#1–#8 anteriores movidos a CHANGELOG).
- **MOD** `DISENO_UI.md` — próximos componentes UI (micrófono, cámara, onboarding, receta detallada).
- **MOD** `LEGALIDAD.md` — flujos de datos nuevos (audio, foto, onboarding con datos de salud art. 9 RGPD).
- **MOD** `PRODUCCION_CHECKLIST.md` — permisos de micrófono y cámara añadidos al build nativo.

---

## [2026-06-16] — F-QA2: Auditoría y blindaje pre-producción (en curso)

### Bloque 1+2 — Auditoría de dependencias y secretos
- **ADD** `.gitleaks.toml` — allowlist de los archivos `smoke_test_*.py`. El escaneo del
  historial git (55 commits, 123 MB) reportó 12 hallazgos, todos falsos positivos:
  contraseñas de prueba (`contrasena_segura_123`) en los smoke tests. **0 secretos reales**.
- **Auditoría `pip-audit`** (`backend/requirements.txt`): única vulnerabilidad es `pip`
  en sí mismo (PYSEC-2026-196, fix 26.1.2), no una dependencia de la app. Sin riesgo prod.
- **Auditoría `npm audit`**: 19 moderate, todas en el toolchain de build de Expo/RN
  (`js-yaml`, `postcss`, `uuid` vía `@expo/*`). No afectan al runtime; el fix exige saltar
  a Expo SDK 56 (breaking). Aceptadas hasta la migración de SDK.

### Bloque 4 — Schemathesis (API schema fuzzing)
- **MOD** `backend/requirements.txt` — añadido `schemathesis>=3.27,<4`.
- **MOD** `.github/workflows/ci.yml` — nuevo step en el job `backend` tras los smoke tests:
  `schemathesis run --app=app.main:app http://localhost/openapi.json` en modo ASGI (sin servidor
  real; schemathesis inyecta requests directamente contra la app en memoria).
  Check: `not_a_server_error` — cualquier endpoint que devuelva 5xx falla la build.
  25 ejemplos por endpoint (`--hypothesis-max-examples=25`), 2 workers. Requests sin autenticar
  → 401 (correcto, no 5xx). Tiempo estimado: ~30 s extra sobre el job backend.

### Bloque 3 — Integración continua (GitHub Actions)
- **ADD** `.github/workflows/ci.yml` — pipeline en cada push/PR a `main`, 3 jobs en paralelo:
  - **backend**: Ruff (lint+formato) + Mypy strict sobre `app/` + los 5 smoke tests (122 checks).
  - **frontend**: `tsc` (0 errores) + ESLint sobre todo el proyecto.
  - **security**: `pip-audit -r requirements.txt`, `npm audit --audit-level=high`
    (solo bloquea high/critical), y `gitleaks` sobre el historial completo.
  - `concurrency` cancela ejecuciones antiguas de la misma rama. `JWT_SECRET_KEY` ficticio
    inyectado en el job backend (smoke tests usan SQLite temporal + `GEMINI_API_KEY=""`).
- El escudo de calidad deja de ser solo local (pre-commit/husky): ahora se valida en remoto.

---

## [2026-06-16] — PR #5: Bloque de mejoras de servicio #1–#8 (mergeado a main)

### Mejora #1 — Conflictos de agenda en el briefing matutino
- **MOD** `backend/app/services/llm.py` — `generate_morning_briefing()` incluye
  `conflictos_agenda` en el prompt de Gemini (título, hora y minutos de solapamiento).
  `generate_fallback_briefing()` añade sección ⚠️ con detalle de solapamiento.
  Los participantes de eventos en conflicto se anonimizan igual que el resto (RGPD).

### Mejora #2 — `ultimo_completado` visible en tareas con urgencia
- **MOD** `frontend/src/screens/TasksScreen.tsx` — badge "Última vez hace X días / Completada hoy"
  en cada card de tarea pendiente. Texto de próxima ejecución calculado de
  `ultimo_completado + frecuencia` (diaria=1d, semanal=7d, mensual=30d); urgente en naranja.
  Lista reordenada por urgencia: nunca completadas → vencidas → toca hoy → próximas → ocasionales.
  En vista "todas": pendientes primero, completadas por recencia.

### Mejora #3 — Gate premium consistente en todos los endpoints de IA
- **MOD** `backend/app/api/routers/calendar.py` — añadido `Depends(requiere_premium)` a
  `POST /calendar/interpretar`. Los 6 endpoints de IA quedan uniformemente protegidos.

### Mejora #4 — OCR de ticket: FAB dedicado y revisión en lote
- **MOD** `frontend/src/screens/PantryScreen.tsx` — segundo FAB `receipt-outline` en la
  pantalla principal de Despensa (no enterrado en el modal). Modal de revisión en lote con
  checkboxes por producto y botón "Añadir seleccionados". Estados nuevos: `ocrScanning`,
  `ocrReviewVisible`, `ocrReviewItems`, `ocrAdding`. Timeout 90 s (ahora `TIMEOUT.OCR_FULL`).

### Mejora #5 — Endpoint `/pantry/sugerencias` unificado con precarga en background
- **ADD** `backend/app/api/routers/pantry.py` — `GET /pantry/sugerencias`: lanza
  `generate_recipe_suggestions` y `generate_meal_plan` en paralelo con `asyncio.gather()`,
  reutilizando las cachés individuales de cada función LLM. Hereda ambos rate-limiters.
- **ADD** `backend/app/schemas/schemas.py` — `SugerenciasResponse { recetas, plan_comidas }`.
- **ADD** `frontend/src/types/types.ts` — interfaz `SugerenciasResponse`.
- **MOD** `frontend/src/screens/PantryScreen.tsx` — prefetch en background al montar si
  `isPremium && items.length > 0` (ref guard `autoFetchedRef` para evitar doble disparo).

### Mejora #6 — Duración del solapamiento visible en Calendario
- **MOD** `frontend/src/screens/CalendarScreen.tsx` — cada card de conflicto muestra
  "Solapamiento: X min" bajo los títulos de los eventos, usando
  `conf.duracion_solapamiento_segundos` (campo ya existente en `ConflictoDetalle`).

### Mejora #7 — Descartada (falso positivo)
- `generate_recipe_suggestions()` y `generate_meal_plan()` solo reciben nombres de alimentos
  (`InventarioAlimentoResponse`), nunca `asignado_a` ni `participantes`. No hay datos
  personales que anonimizar en esas rutas. Sin cambios de código.

### Mejora #8 — Timeouts tipados y consistentes
- **MOD** `frontend/src/api/api.ts` — exportada constante
  `TIMEOUT = { DEFAULT: 15_000, AI: 45_000, OCR: 60_000, OCR_FULL: 90_000 }`.
  El fallback interno de `apiRequest` usa `TIMEOUT.DEFAULT` en lugar del literal `15000`.
- **MOD** `frontend/src/hooks/useDashboard.ts` — `timeoutMs: TIMEOUT.AI`.
- **MOD** `frontend/src/hooks/usePantry.ts` — `timeoutMs: TIMEOUT.OCR`.
- **MOD** `frontend/src/screens/PantryScreen.tsx` — `TIMEOUT.AI` (sugerencias), `TIMEOUT.OCR_FULL` (OCR).
- **MOD** `frontend/src/screens/TasksScreen.tsx` — `timeoutMs: TIMEOUT.AI`.

---

## [2026-06-16] — Mejoras de servicio + fixes (sesión anterior, detalle)

### feat/mejoras-servicio — Mejora #1: conflictos de agenda en el briefing
- **MOD** `backend/app/services/llm.py` — `generate_morning_briefing()` ahora incluye
  `conflictos_agenda` en el prompt de Gemini (título, hora y minutos de solapamiento).
  Los participantes de los eventos en conflicto se anonomizan igual que el resto (RGPD).
  `generate_fallback_briefing()` añade sección ⚠️ con detalle de solapamiento.
  El system_instruction actualizado pide a Gemini que avise de conflictos con tono natural.

### fix/api-timeout — Regresión timeout en `apiRequest`
- **FIX** `frontend/src/api/api.ts` — el refactor de OCR cambió `AbortSignal.timeout()`
  (lanza `TimeoutError`) a `AbortController + setTimeout` (lanza `AbortError`, igual que
  cancelación intencional). Los 4 hooks capturaban `AbortError` primero y hacían `return`
  silencioso → timeouts invisibles para el usuario. Solución: flag `didTimeout` que
  convierte el abort del timer en `TimeoutError`, activando el mensaje de red en los hooks.

### Mejoras de servicio pendientes (rama feat/mejoras-servicio)
Ver `MEJORAS_PENDIENTES.md` para el backlog completo con estimaciones de esfuerzo.

---

## [2026-06-16] — OCR de tickets de compra + AgendaScreen + Rediseño Dashboard

### OCR de tickets (commit `ffaf19b`)
- **ADD** `backend/app/services/llm.py` — `process_receipt_ocr()`: multimodal Gemini Vision
  (imagen base64 inline), reutiliza `_DESPENSA_RESPONSE_SCHEMA`, timeout 30 s.
- **ADD** `backend/app/api/routers/pantry.py` — `POST /pantry/ocr-ticket` (premium + rate-limit).
- **ADD** `backend/app/schemas/schemas.py` — `TicketOcrRequest` / `TicketOcrResponse`.
- **MOD** `frontend/src/hooks/usePantry.ts` — `escanearTicketOcr()` con timeout 60 s.
- **MOD** `frontend/src/screens/PantryScreen.tsx` — flujo OCR: permiso cámara → Alert
  Cámara/Galería → `ImagePicker` → procesado → modo IA con resultados pre-cargados.
- **ADD** `frontend/package.json` — `expo-image-picker ~17.0.11`.
- **MOD** `frontend/babel.config.js` — eliminado `jsxImportSource: 'nativewind'` (limpieza).
- **ADD** `frontend/.gitignore`, `frontend/.env.example`.

### AgendaScreen — Tareas + Calendario unificados (commit `9148dfc`, Gemini)
- **ADD** `frontend/src/screens/AgendaScreen.tsx` — nueva pantalla que combina Tareas y
  Calendario en pestañas internas (`ScrollView` horizontal con `Chip` selector).
- **MOD** `frontend/src/navigation/AppNavigator.tsx` — sustituye las tabs separadas
  "Calendario" y "Tareas" por una única tab "Agenda" con `AgendaScreen`.

### Rediseño del briefing matutino (commit `ff0fa15`, Gemini)
- **MOD** `backend/app/services/llm.py` — system_instruction del briefing reescrita: tono
  de mayordomo elegante y cercano, 3 párrafos conversacionales sin Markdown, sin listas.
- **MOD** `frontend/src/screens/DashboardScreen.tsx` — ajustes de layout del card de briefing.

---

## [2026-06-16] — F-AUDIT2: Hardening post-F4/F5 (freemium server-side + Railway)

### Decisiones clave
- **Freemium aplicado en el servidor, no solo en la UI.** El gate `checkPremiumGate`
  del frontend era trivialmente evitable llamando a la API directamente. Nueva
  dependencia `requiere_premium` que valida el entitlement contra la API REST de
  RevenueCat (cache Redis 5 min, **fail-open** ante caídas del proveedor) en los
  5 endpoints de IA. Desactivada si no hay `REVENUECAT_SECRET_KEY` (dev/tests).
- **Compatibilidad con la `DATABASE_URL` inyectada por Railway.** Reescritura de
  `postgres://`/`postgresql://` → `postgresql+asyncpg://` para el engine async.
- **Resiliencia Redis.** Reconexión perezosa con cooldown (sobrevive a que el
  backend arranque antes que Redis) y `socket_timeout` 5 s → 2 s.
- **Procfile** para Nixpacks: `alembic upgrade head` + bind a `0.0.0.0:$PORT`.
- **Rate-limit:** miembro del sorted set con `uuid4` (evita colisión/subconteo).
- **Frontend:** desuscripción del listener de RevenueCat, selectores Zustand
  (menos re-renders) y loaders independientes por paquete en el Paywall.
- **Higiene:** `frontend/.gitignore` + `.env.example`; `.env.{development,production}`
  desindexados de git.

### Archivos
- `ADD` backend/app/services/premium.py — verificación de suscripción (RevenueCat REST + cache Redis).
- `ADD` backend/Procfile — release con migraciones + uvicorn a $PORT.
- `MOD` backend/app/api/deps.py — dependencia `requiere_premium`.
- `MOD` backend/app/api/routers/{pantry,tasks}.py — gate en los 5 endpoints de IA.
- `MOD` backend/app/database.py — rewrite del driver de DATABASE_URL.
- `MOD` backend/app/core/redis_client.py — reconexión perezosa + timeouts.
- `MOD` backend/app/core/rate_limit.py — miembro único (uuid4).
- `MOD` backend/app/core/config.py — REVENUECAT_SECRET_KEY / REVENUECAT_ENTITLEMENT.
- `MOD` backend/.env.example — documentadas las nuevas variables.
- `MOD` frontend/src/state/purchasesStore.ts — cleanup del listener.
- `MOD` frontend/src/navigation/AppNavigator.tsx, frontend/src/screens/{Pantry,Tasks,Paywall}Screen.tsx — selectores + loaders por paquete.
- `ADD` frontend/.gitignore, frontend/.env.example.

### Verificación: 120/120 smoke tests; 0 errores TypeScript; Ruff + Ruff-format + Mypy strict OK.
### Rama: `fix/auditoria-f4-f5` (pendiente de merge a main).

---

## [2026-06-16] — FASE F4: Freemium y RevenueCat

### Decisiones clave
- **RevenueCat SDK**: Se implementó `react-native-purchases` en el frontend para gestionar IAP (In-App Purchases) de Apple y Google.
- **Paywall Inteligente**: Se creó `PaywallScreen.tsx` (como Modal fullScreen nativo sobre las pestañas) que levanta de forma remota los paquetes configurados (Offerings) desde el panel de RevenueCat.
- **Restricción de IA**: La inteligencia artificial se ha agrupado como función "Pro". Si el estado local `isPremium` es falso, funciones como "Sugerir con IA" o "Plan de Comidas" se bloquean e invocan automáticamente el Paywall.

### Archivos
- `ADD` frontend/src/screens/PaywallScreen.tsx — interfaz del Paywall nativo.
- `ADD` frontend/src/state/purchasesStore.ts — estado Zustand para Purchases (init, login, checkPremium).
- `MOD` frontend/src/navigation/AppNavigator.tsx — envoltura de Tabs en un RootStack; inyección del modal Paywall y `configure()` de RevenueCat.
- `MOD` frontend/src/screens/PantryScreen.tsx — inyección del Paywall `checkPremiumGate` para limitar IA.
- `MOD` frontend/src/screens/TasksScreen.tsx — inyección del Paywall para limitar interpretación de IA.
- `MOD` backend/.env — Se retiró la variable pública `REVENUE_CAT` (pertenece al frontend).
- `MOD` frontend/.env.development / frontend/.env.production — Se añadió `EXPO_PUBLIC_RC_KEY`.

### Verificación: 0 errores de TypeScript en frontend; Paywall modal comprobado nativamente.

---

## [2026-06-16] — FASE F5: Migración a Redis y Despliegue en la Nube (Railway)

### Decisiones clave
- **Despliegue en Railway**: Se aprovisionó el backend en Railway usando NIXPACKS, con bases de datos PostgreSQL y Redis conectadas y variables de entorno (`JWT_SECRET_KEY`, `DATABASE_URL` asíncrona) configuradas automáticamente. El frontend apunta ahora a `https://asistentehogar-production.up.railway.app`.
- La caché TTL de IA y el rate-limit operaban en memoria (diccionarios Python). Con múltiples
  workers o réplicas, cada proceso tenía su propio estado → límites de IA ineficaces y caché
  duplicada. Migrado a **Redis** con fallback automático en memoria si Redis no está disponible
  (la app nunca se rompe por falta de Redis).
- **Rate-limit:** ventana deslizante con sorted sets de Redis (ZRANGEBYSCORE + pipeline atómico).
  Si Redis cae, degrada transparentemente al deque en memoria original.
- **Caché LLM:** `SETEX` con TTL nativo de Redis. Serialización JSON con soporte para modelos
  Pydantic (`model_dump(mode="json")`). Los TTL se mantienen: briefing 30 min, recetas 1 h,
  plan de comidas 2 h.
- **Conexión:** pool asíncrono (`redis.asyncio`) inicializado en el `lifespan` de FastAPI y
  cerrado en el shutdown. Verificación de conectividad con `PING` al arrancar.
- Docker Compose actualizado con Redis 7 Alpine (AOF, 128 MB, LRU eviction).

### Archivos
- `ADD` backend/app/core/redis_client.py — pool async, init/close, get_redis().
- `MOD` backend/app/core/rate_limit.py — estrategia dual Redis/memoria.
- `MOD` backend/app/services/llm.py — caché dual Redis/memoria (funciones ahora async).
- `MOD` backend/app/main.py — init_redis()/close_redis() en lifespan.
- `MOD` backend/app/core/config.py — nueva variable REDIS_URL.
- `MOD` backend/docker-compose.yml — servicio Redis 7 Alpine.
- `MOD` backend/.env.example — documentada REDIS_URL.
- `MOD` backend/requirements.txt — redis[hiredis]>=5.0.0.
- `CFG` .pre-commit-config.yaml — types-redis>=4.6 para mypy.

### Verificación: 122/122 smoke tests en verde (modo degradado sin Redis); ruff + mypy + ruff-format OK; 0 errores TypeScript frontend.

---

## [2026-06-11] — Reenfoque: agente personal honesto (eliminación de funciones imposibles)

### Decisiones clave
- La app NO tiene integraciones de hardware: se eliminó toda la UI que fingía tenerlas (consumo energético,
  domótica, seguridad, cámaras, clima falso, notificaciones inventadas, escáner de códigos). Alcance real:
  **comida (despensa), eventos (calendario) y tareas**, asistidos por IA pasiva.
- El "evento rápido" del calendario pasa de simulación a IA real: nuevo `POST /calendar/interpretar` con
  Gemini interpreta lenguaje natural ("cena con mis padres el viernes a las 21h") y devuelve una PROPUESTA
  con fecha/hora resueltas; el usuario siempre confirma antes de crear (IA pasiva). Sin caché (cada texto es único).
- Clima eliminado también del backend (no hay proveedor real): fuera de `DashboardUnifiedContext`, del
  briefing IA y del fallback.
- Despensa: estado de stock ahora calculado de datos reales (caducidad + cantidad), no de un mock por id;
  recomendaciones de compra derivadas del stock bajo real; fotos unsplash → emoji por categoría.
- Calendario: fecha y contadores reales en cabecera; filtros por participantes derivados de los eventos
  (iniciales, sin fotos falsas); fuera tabs Día/Semana/Mes sin función, mockupEventos, "Reprogramar" falso
  e "Integraciones" simuladas; eje horario ampliado 07:00–22:00.

### Archivos
- `ADD` backend: `interpret_event_text()` en services/llm.py (+schema estructurado, validación fin>inicio),
  `POST /calendar/interpretar` en routers/calendar.py, schemas `InterpretarEventoRequest/EventoInterpretado/InterpretarEventoResponse`.
- `MOD` backend: schemas.py y llm.py sin campos de clima.
- `MOD` frontend/src/types/types.ts — fuera clima; +EventoInterpretado, InterpretarEventoResponse.
- `MOD` frontend/src/screens/{DashboardScreen,PantryScreen,CalendarScreen}.tsx — limpieza completa descrita arriba.

### Verificación: E2E real — "viernes a las 21h" → 2026-06-12T21:00 (+1h por defecto) OK; texto sin sentido → mensaje sin evento OK; sin token → 401 OK; smoke test 12/12; `ts:check` 0 errores.
### Qué sigue: **F4 — Modelo freemium** (requiere cuenta RevenueCat).

---

## [2026-06-11] — FASE IA: Integración real de Gemini (briefing + recetas)

### Decisiones clave
- `gemini-1.5-flash` ya no existe en la API (el briefing caía siempre al fallback sin saberlo). Modelo
  actualizado a `gemini-2.5-flash`, configurable vía `GEMINI_MODEL`; `thinkingBudget=0` (menos latencia/coste).
- Caché TTL en memoria por hash de datos: briefing 30 min, recetas 1 h. Cambian los datos → se regenera.
  Deuda: migrar a Redis junto con el rate limiter si hay varias réplicas.
- Nueva función IA: `GET /pantry/recetas` — sugiere hasta 3 recetas desde el inventario real, priorizando
  caducidades (salida JSON estructurada con `responseSchema`). IA pasiva: solo sugiere.

### Archivos
- `MOD` backend/app/services/llm.py — rewrite: helper `_call_gemini`, caché, `generate_recipe_suggestions`.
- `MOD` backend/app/{core/config.py (+GEMINI_API_KEY/GEMINI_MODEL), schemas/schemas.py (+RecetaSugerida), api/routers/pantry.py (+/pantry/recetas), .env.example}.
- `MOD` frontend/src/{types/types.ts (+RecetaSugerida), screens/PantryScreen.tsx — mock de recetas hardcodeado sustituido por IA real con botón "Sugerir con IA"}.

### Verificación: E2E con API real — briefing IA OK; 3 recetas coherentes con inventario; caché 2ª llamada 7 ms; smoke test 12/12; `ts:check` 0 errores.

---

## [2026-06-11] — Auditoría: corrección de bugs y deuda técnica

### Correcciones (auditoría exhaustiva pre-producción)
- `FIX` backend/app/services/llm.py — la API key de Gemini iba como query param en la URL y se filtraba
  en logs de errores de red; movida al header `x-goog-api-key`. Eliminado "(Madrid)" hardcodeado del fallback.
- `FIX` backend/app/repositories/{exceptions.py (+TaskNotFoundError), task.py (ValueError → TaskNotFoundError), user.py (+rollback si refresh falla tras commit)}.
- `FIX` backend/app/api/routers/{tasks.py (captura TaskNotFoundError, no ValueError genérico), dashboard.py (docstring obsoleto X-Hogar-ID, clima duplicado)}.
- `FIX` backend/app/services/dashboard.py — sanitización vía `model_copy()`: ya no muta DTOs Pydantic in-place.
- `ADD` backend/app/core/utils.py — `sanitize_text` única (estaba duplicada en tasks.py y dashboard.py).
- `ADD` backend/alembic/versions/3e8f2a1b9c7d — índices: tareas_hogar(hogar_id,estado,is_deleted), eventos_calendario(hogar_id,fecha_inicio/fin).
- `MOD` backend/app/services/calendar.py — comentario de complejidad corregido (O(N²) peor caso, no O(N log N)).

### Verificación: smoke test 12/12 OK; migración de índices aplicada; imports verificados.

---

Ver [[CHANGELOG_ARCHIVE.md]] para historial de F0, F1, F2, F3 y setup inicial.

### Correcciones TypeScript (tsc --noEmit: 0 errores)
- `FIX` [frontend/src/navigation/AppNavigator.tsx](file:///p:/AsistenteHogar/frontend/src/navigation/AppNavigator.tsx) — Añadidos tipos explícitos (`RouteProp<RootTabParamList>`, `BottomTabNavigationOptions`, `{ focused: boolean }`) para resolver errores TS7031 (implicit `any`).
