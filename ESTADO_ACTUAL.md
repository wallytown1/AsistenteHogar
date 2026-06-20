# ESTADO ACTUAL — AsistenteHogar (2026-06-20)

## 🚀 PRÓXIMA SESIÓN — EMPIEZA AQUÍ

### Qué está desplegado y funcionando

| Servicio | URL | Estado |
|---------|-----|--------|
| **Backend Railway** | https://asistentehogar-production.up.railway.app | ✅ Online |
| **Admin panel Vercel** | https://admin-web-theta-pink.vercel.app | ✅ Online |
| **Admin user** | `navaroruiz2000@gmail.com` | ✅ Bootstrapped |

### Siguiente paso sin bloqueos externos

Las tareas de abajo **no requieren** cuenta Apple ni Google Play:

1. **Arte de la app** (Higgsfield MCP) — generar icono, splash y adaptive-icon definitivos
   - Icono 1024×1024 PNG → `frontend/assets/icon.png`
   - Splash 1284×2778 → `frontend/assets/splash.png`
   - Adaptive (sin fondo) → `frontend/assets/adaptive-icon.png`

2. **OWASP ZAP** (F-QA2 Bloque 6) — una pasada contra Railway, baja prioridad

3. **Gemini billing** — cambiar la API key a una con billing activo en Railway antes de usuarios reales (RGPD art. 28)

### Bloqueado por cuentas externas

| Tarea | Bloqueante |
|-------|-----------|
| EAS Build production / submit | Apple Developer ($99/año) + Google Play ($25) |
| RevenueCat gate premium real | `REVENUECAT_SECRET_KEY` (necesita productos en RC dashboard con App Store + Play) |
| In-app purchases | App Store Connect API key + Google Play service account |

---

## ✅ Sesión 2026-06-20 — Bloque A: JTI blocklist + webhook RC + admin panel + fix URL

### JTI blocklist (logout real server-side)

- **ADD** `backend/app/core/token_blocklist.py` — Redis TTL con fallback en memoria.
- **MOD** `backend/app/core/security.py` — cada token lleva `jti: uuid4()`.
- **MOD** `backend/app/api/deps.py` — `get_current_user` verifica blocklist; token revocado → 401.
- **ADD** `POST /api/v1/auth/logout` — invalida el JTI actual. Devuelve `LogoutResponse`.
- **MOD** `backend/smoke_test_auth.py` — 4 checks nuevos. Total: **16/16**.

### Webhook RevenueCat

- **ADD** `backend/app/api/routers/webhooks.py` — `POST /api/v1/webhooks/revenuecat` con firma Bearer. Invalida cache `tier:{id}` en Redis para `INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION / BILLING_ISSUE / PRODUCT_CHANGE`. Devuelve 501 sin secreto configurado.
- **MOD** `backend/app/services/premium.py` — `invalidate_tier_cache(app_user_id)`.
- **MOD** `backend/app/main.py` — webhook router registrado en `/api/v1`.

### Admin panel Vercel

- **ADD** `admin-web/nixpacks.toml` — build/start explícitos.
- Panel desplegado en https://admin-web-theta-pink.vercel.app
- **FIX** `NEXT_PUBLIC_API_URL` corregido a solo el host (el código ya añade `/api/v1`; antes duplicaba el prefijo → 404).
- CORS: `ALLOWED_ORIGINS=https://admin-web-theta-pink.vercel.app` en Railway.
- Admin bootstrapped: `navaroruiz2000@gmail.com`.

---

## ✅ Sesión 2026-06-20 — Fase 5: RevenueCat 3 tiers Free/Premium/Familia

### Backend

- **MOD** `backend/app/services/premium.py` — `TIER_FREE / TIER_PREMIUM / TIER_FAMILIA`. `is_premium()` verdadero para premium + familia. Cache Redis TTL 300 s. Dev mode (sin key) → `TIER_FAMILIA`.
- **ADD** `deps.py` → `requiere_familia` — HTTP 402 si tier < familia.
- **ADD** `GET /pantry/recetas/basicas` — catálogo estático para tier free.
- **MOD** `/pantry/plan-comidas` y `/pantry/sugerencias` → `requiere_familia`.
- **MOD** `/perfiles POST` → `requiere_familia`.

### Frontend

- **MOD** `purchasesStore.ts` — `isFamilia: boolean`; `checkEntitlements`; lógica `familia ⊃ premium`.
- **MOD** `PaywallScreen.tsx` — 3 cards (Gratis/Premium/Familia) con badge «Plan actual» y «MEJOR VALOR».
- **MOD** `DashboardScreen.tsx` — Plan de la semana con gate `!isFamilia`.
- **MOD** `PantryScreen.tsx` — bifurca fetch según tier.
- **MOD** `SettingsScreen.tsx` — upsell con lock si `!isFamilia`.

---

## ✅ Sesión 2026-06-20 — HistorialScreen + edición perfil hogar + SECURITY.md + seed Railway

### HistorialScreen

- **ADD** `screens/HistorialScreen.tsx` — FlatList con badges cocinada/rechazada + pull-to-refresh.
- **MOD** `hooks/useRecetaHistorial.ts` — extendido con `fetchHistorial()` y `loadingHistorial`.
- **MOD** `navigation/AppNavigator.tsx` — ruta `Historial` con `slide_from_right`.
- **MOD** `screens/DashboardScreen.tsx` — tarjeta Pressable «Historial de recetas».

### Edición perfil del hogar

- **MOD** `screens/SettingsScreen.tsx` — tarjeta «Perfil del hogar» con modal bottom-sheet (chip-picker comensales 1–6 + texto de gustos). Guarda con `POST /onboarding`.

### Seguridad y producción

- **ADD** `SECURITY.md` — F-QA2 Bloque 5: multi-tenant, auth, LLM, secretos.
- Seed recetario en Railway: 15 recetas mediterráneas base en `recetario_maestro`.
- `REVENUECAT_FAMILIA_ENTITLEMENT` y `REVENUECAT_WEBHOOK_SECRET` documentados en `.env.example`.

---

## ✅ Sesión 2026-06-19 (noche) — smoke_test_rechazar_ingrediente + CI completo + EAS init

- **ADD** `backend/smoke_test_rechazar_ingrediente.py` — 16/16 checks.
- **MOD** `.github/workflows/ci.yml` — CI cubre los 9 smoke tests completos.
- **EAS init** completado: `projectId: ef3addea-6e08-4e55-b096-3b81053816cd` en `app.json`. `RECORD_AUDIO` permission restaurado.
- Security: `frontend/.env.development` y `frontend/.env.production` protegidos en `.gitignore`.

---

## ✅ Sesiones anteriores (resumen)

| Fase | Descripción |
|------|------------|
| **Pivote 2 (2026-06-18)** | App exclusivamente de comida/stock/recetas. Eliminados Eventos y Tareas. |
| **Fase 3** | `perfiles_individuales` CRUD (máx. 10/hogar) + inyección en prompts LLM. |
| **Fase 4 (Bloque A)** | `rechazar-ingrediente` + inyección `recetario_maestro` en sugerencias. |
| **F6** | EAS Build: `eas.json` configurado, `eas init` completado. |
| **Animaciones UI** | `useFadeInFromBottom`, `usePulseGlow`, `FadeInView`. |
| **Onboarding hero images** | `mercado.jpg` + `cocina.jpg` en assets/onboarding/. |
| **Lista de la compra** | CRUD completo + smoke_test_lista_compra 27/27. |
| **RecipeDetailScreen** | Pasos numerados + checkmark de ingredientes + botones historial. |
| **PlanComidaScreen** | Plan semanal 7 días con AIDisclaimerBanner + regenerar. |
| **Notificaciones locales** | `expo-notifications` — alertas caducidad ≤3 días a las 9:00. |
| **F-QA2 Bloque 1-4** | `pip-audit` + `npm audit` + gitleaks + GitHub Actions CI + Schemathesis. |
| **seed_recetario.py** | 15 recetas mediterráneas base (idempotente). |
| **FlatList PantryScreen** | `ScrollView` → `FlatList` con `React.memo` (rendimiento). |
| **Auditoría UI** | Touch targets, tipografía HIG, copy post-Pivote2. |
| **Fase 2** | `prompt_templates` + `recetario_maestro` dinámicos + panel admin Next.js. |
| **F-LEGAL** | Purga GDPR, DELETE /cuenta, anonimización LLM, `AIDisclaimerBanner`. |
| **F-UI** | Rediseño visual nativo iOS/Android (StyleSheet + tokens, sin NativeWind). |
| **F4** | Freemium RevenueCat + Paywall + gate server-side. |
| **F-AUDIT2** | Hardening post-F4/F5: gate premium, Railway, Redis resiliente. |
| **F-OCR** | OCR tickets con Gemini Vision (premium). |
| **F5 Redis** | Caché + rate-limit distribuido. Railway online. |

---

## 📊 Qué hace la app ahora

### Despensa ★ (función principal)
- Inventario con stock, categoría, caducidad
- **Recetas sugeridas por IA** — mediterráneas españolas, priorizan lo que caduca
- **Plan de comidas semanal** — 7 días (comida + cena) por IA
- **Perfiles individuales** — preferencias culinarias por miembro (máx. 10)
- **RecipeDetailScreen** — pasos numerados, ingredientes con checkmark, «Marcar cocinada» / «No me gusta»
- **HistorialScreen** — FlatList de recetas cocinadas/rechazadas con badges
- **Recetas básicas** — catálogo estático sin IA para tier free
- OCR de ticket (Gemini Vision, premium)
- Añadir por audio NL (micrófono, Gemini)
- Foto de nevera (Gemini Vision, premium)
- Gestión de stock (CRUD, filtros, caducidad)
- Umbral de caducidad configurable (3/6/10/14 días)
- Alertas de caducidad (notificaciones locales ≤3 días, 9:00)

### Dashboard
- Briefing diario Gemini (o fallback estático)
- Alertas de caducidad próxima
- Accesos directos a Plan de la semana e Historial

### Lista de la compra
- CRUD completo + borrado masivo + aislamiento multi-tenant

### Autenticación
- Registro/login con JWT (30 días) + JTI blocklist (logout real)
- Token en SecureStore (cifrado nativo)
- `POST /auth/logout` — invalida el token en Redis

### Admin panel (Vercel)
- CRUD de `prompt_templates` y `recetario_maestro`
- Login con JWT de admin (separado de JWT familiar)
- URL: https://admin-web-theta-pink.vercel.app

### Premium / Familia (RevenueCat)
- **Free**: recetas básicas (catálogo estático)
- **Premium**: recetas IA + OCR + audio + foto-nevera
- **Familia**: todo Premium + plan de comidas + sugerencias + perfiles individuales

---

## 🔧 Verificación mínima antes de cambios

```bash
# Backend
cd backend
python smoke_test_auth.py               # 16/16
python smoke_test_modules.py            # must pass
python smoke_test_dashboard.py          # must pass
python smoke_test_validation.py         # 20/20
python smoke_test_legal.py              # 26/26
python smoke_test_admin.py              # must pass
python smoke_test_perfiles.py           # must pass
python smoke_test_lista_compra.py       # 27/27
python smoke_test_rechazar_ingrediente.py  # 16/16

# Frontend
cd frontend && npm run ts:check         # 0 errores
```

---

## 📁 Archivos críticos

### Backend
- `backend/.env` — JWT_SECRET_KEY, GEMINI_API_KEY, DATABASE_URL, ENVIRONMENT, ADMIN_JWT_SECRET_KEY, ADMIN_BOOTSTRAP_TOKEN
- `backend/app/main.py` — punto de entrada FastAPI
- `backend/app/services/llm.py` — Gemini (briefing, recetas, audio, foto-nevera, plan)
- `backend/app/services/premium.py` — tiers Free/Premium/Familia + cache Redis + invalidate_tier_cache
- `backend/app/core/token_blocklist.py` — JTI blocklist (Redis + fallback memoria)
- `backend/app/api/routers/` — auth, dashboard, pantry, onboarding, historial, perfiles, webhooks
- `backend/alembic/versions/` — migraciones SQL
- `backend/smoke_test_*.py` — 9 smoke tests

### Frontend
- `frontend/src/screens/` — DashboardScreen, PantryScreen, SettingsScreen, RecipeDetailScreen, HistorialScreen, PlanComidaScreen, PaywallScreen
- `frontend/src/state/authStore.ts` — Zustand (token, usuario, hogar)
- `frontend/src/state/purchasesStore.ts` — Zustand (isFamilia, isPremium)
- `frontend/src/api/api.ts` — cliente HTTP con Bearer + TIMEOUT constants

### Admin panel
- `admin-web/src/lib/api.ts` — base URL = `NEXT_PUBLIC_API_URL` (solo host, sin `/api/v1`)
- `admin-web/nixpacks.toml` — build config Vercel

### Infraestructura
- `backend/app/core/config.py` — todas las variables de entorno
- `backend/app/core/redis_client.py` — pool Redis (graceful fallback)
- `.github/workflows/ci.yml` — CI 3 jobs (backend, frontend, security)

### Documentación
- `CLAUDE.md` — guía de trabajo (comandos + arquitectura)
- `ENDPOINTS.md` — referencia completa API REST
- `CHANGELOG.md` — historial de todas las fases
- `ARCHITECTURE_MAP.md` — mapa de módulos y decisiones
- `SECURITY.md` — F-QA2 análisis de seguridad
- `ESTADO_ACTUAL.md` — este archivo

---

## 🐛 Deuda técnica conocida

| Problema | Impacto | Acción |
|----------|--------|--------|
| `GEMINI_API_KEY` free tier (Google puede usar prompts para entrenamiento) | Medio (RGPD art. 28) | Cambiar a key con billing antes de usuarios reales |
| `REVENUECAT_SECRET_KEY` no configurado | Medio: gate premium abierto en prod | Requiere RC dashboard con App Store/Play configurados |
| `REVENUECAT_WEBHOOK_SECRET` no configurado | Bajo: cache invalidation manual | Configurar cuando RC dashboard esté listo |
| Migración `drop_eventos_tareas` pendiente en Railway | Bajo (tablas vacías) | `alembic upgrade head` en próximo deploy |

---

## 🎯 Restricciones inamovibles

1. `hogar_id` SIEMPRE del JWT — nunca de cabecera o body cliente
2. Pydantic v2 `extra='forbid'` en todos los schemas
3. LLM temperature = 0 (reproducibilidad)
4. Routers devuelven schemas, no ORM models
5. Escrituras IA solo permitidas si son de bajo riesgo y reversibles con undo visible

---

## 🔐 Stack & Versiones

| Componente | Versión |
|-----------|---------|
| React Native | 0.76.9 (Expo SDK 54) |
| FastAPI | 0.115+ |
| SQLAlchemy | 2.0+ async |
| Pydantic | 2.6.0+ |
| Gemini | 2.5-flash |
| Next.js (admin) | 15+ |
| EAS projectId | ef3addea-6e08-4e55-b096-3b81053816cd |
