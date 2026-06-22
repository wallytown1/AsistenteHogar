# Checklist de paso a Producción — AsistenteHogar

> Qué hay que cambiar **antes de un lanzamiento real** (con datos reales de familias
> y compras reales en las tiendas). Hoy el despliegue de Railway está en modo
> **pruebas / datos ficticios**. Última revisión: **2026-06-16**.

---

## 0. Estado actual del despliegue (Railway)

- Proyecto `nurturing-tranquility` → servicio `AsistenteHogar`, región `sfo`.
- URL: `https://asistentehogar-production.up.railway.app`
- Auto-deploy desde la rama **`main`** del repo `wallytown1/AsistenteHogar`.
- Build con **Nixpacks/Railpack**; arranque por `backend/Procfile`
  (`alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`).

> ⚠️ **Aprendizaje (2026-06-16):** Railway **no ejecuta el `Procfile`** (arranca `uvicorn`
> directamente), así que `alembic upgrade head` nunca corría y la BD de producción quedó
> **sin tablas** tras el deploy de F5. El `/health` daba 200 (solo hace `SELECT 1`), ocultando
> el problema. Resuelto ejecutando las migraciones en el arranque de la app
> (`RUN_MIGRATIONS_ON_STARTUP=true` → subproceso async en el lifespan de `main.py`). **No
> quitar esa variable** en Railway, o las nuevas migraciones no se aplicarán.

### Variables ya configuradas en Railway
| Variable | Estado | Nota |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres de Railway (el backend lo reescribe a `+asyncpg` en `database.py`). |
| `REDIS_URL` | ✅ | Redis de Railway. Confirmado conectado en logs de arranque. |
| `JWT_SECRET_KEY` | ⚠️ verificar | Confirmar que es un valor fuerte y **distinto** del `.env` de desarrollo (no visible por CLI). |
| `ENVIRONMENT` | ✅ `production` | `/docs`, `/redoc`, `/openapi.json` cerrados (404). CORS sin orígenes por defecto. |
| `RUN_MIGRATIONS_ON_STARTUP` | ✅ `true` | Aplica migraciones al arrancar. **No quitar** (Railway ignora el Procfile). |
| `GEMINI_API_KEY` | ✅ (clave de prueba, tier gratuito) | Funciona; cambiar a clave con *billing* antes de datos reales (§1). |

### Variables pendientes (modo prueba actual)
| Variable | Estado | Efecto hoy |
|---|---|---|
| `GEMINI_API_KEY` | ✅ puesta (clave de prueba, tier gratuito) | IA real funcionando. Cambiar a clave con *billing* antes de datos reales (§1). |
| `REVENUECAT_SECRET_KEY` | ❌ sin definir | Gate premium **desactivado**: endpoints de IA abiertos a cualquier usuario autenticado. |
| `REVENUECAT_ENTITLEMENT` | ❌ (default `premium`) | Solo cambiar si el entitlement en RevenueCat tiene otro id. |
| `ALLOWED_ORIGINS` | ❌ sin definir | OK para clientes nativos. **Obligatoria solo si se añade un cliente web.** |

---

## 1. 🔴 Cumplimiento RGPD — IA (bloqueante para datos reales)

- [ ] **`GEMINI_API_KEY` de un proyecto con *billing* activado** (o Vertex AI con DPA / región UE).
  - Hoy se usa una clave **personal solo con datos de prueba**. El tier gratuito permite a
    Google usar los prompts para mejorar sus productos → **inaceptable con datos personales
    del hogar**. Cambiar a clave con facturación **antes** de meter datos reales.
  - [ ] **Rotar/retirar la clave personal de prueba** una vez se ponga la definitiva.
- [ ] **Revisar el alcance de la anonimización LLM.** Hoy `services/privacy.py` anonimiza
  nombres (`Familiar_N`) **solo en el briefing**. Los endpoints `interpret_*` y
  `sugerir-metadata` envían el texto del usuario tal cual a Gemini. Decidir si eso es
  aceptable o ampliar la anonimización antes de producción con datos reales.
- [ ] Confirmar el cumplimiento legal (RGPD/AI Act) con la configuración final — ver
  `SECURITY.md §8` (retención/RGPD) y `01_CONTEXTO_Y_ARQUITECTURA_APP.md §5` (compliance).

---

## 2. 🔴 Freemium / RevenueCat (bloqueante para cobrar)

- [ ] **Backend:** definir `REVENUECAT_SECRET_KEY` (RevenueCat → API keys → *Secret key*) en
  Railway para que `requiere_premium` valide el entitlement server-side. Sin ella, el gate
  está desactivado y la IA de pago es gratis vía API directa.
- [ ] Confirmar que el id del entitlement coincide (`REVENUECAT_ENTITLEMENT`, default `premium`).
- [ ] **Frontend:** sustituir la **SDK key pública** `EXPO_PUBLIC_RC_KEY` en
  `frontend/.env.production` — hoy es `test_...` (sandbox) → debe ser `appl_...` (iOS) o
  `goog_...` (Android). Una clave `test_` **no procesa compras reales**.
- [ ] Configurar productos/offerings/entitlement en el panel de RevenueCat y enlazarlos con
  los productos IAP de App Store Connect y Google Play Console.
- [ ] Probar el flujo real: compra → webhook/estado → `isPremium` → endpoints devuelven 200;
  usuario sin suscripción → **402** en los 5 endpoints de IA.

---

## 3. 🟡 Builds nativos (F6 — tras F-PIVOT)

- [ ] `react-native-purchases` **no funciona en Expo Go**: requiere un **development build**
  (EAS) para probar, y un build de producción para publicar.
- [ ] Añadir el plugin **`expo-notifications`** en `app.json` (notificaciones de caducidad).
- [ ] Añadir permiso de **micrófono** en `app.json` para entrada por audio (`expo-av` o `expo-speech`):
  `NSMicrophoneUsageDescription` (iOS) + `RECORD_AUDIO` (Android).
- [ ] Añadir permiso de **cámara** en `app.json` para foto de nevera (`expo-image-picker`):
  `NSCameraUsageDescription` (iOS) + `CAMERA` (Android).
- [ ] Configurar EAS (`eas.json`), credenciales de firma iOS/Android.
- [ ] Etiquetas de privacidad de las tiendas (App Store Privacy / Google Play Data Safety)
  coherentes con los datos tratados: alimentos, audio, imágenes enviados a Gemini, datos de salud
  del onboarding (alergias/intolerancias — categoría especial RGPD art. 9).

---

## 4. 🟡 Infraestructura y operación

- [ ] **Backups de Postgres** activados en Railway (o export programado).
- [ ] **Redis gestionado de Railway:** confirmar política de persistencia/eviction. El
  `docker-compose.yml` (AOF, 128 MB, `allkeys-lru`) is **solo para desarrollo local**; el
  Redis de Railway se configura aparte. La app degrada a memoria si Redis cae (no se rompe).
- [ ] Revisar `ACCESS_TOKEN_EXPIRE_MINUTES` (hoy 30 días, sin refresh token). Decidir si se
  reduce o se añade refresh para producción.
- [ ] Si se añade cliente web algún día: definir `ALLOWED_ORIGINS` (en producción, sin esta
  variable, no se admite ningún origen CORS).
- [ ] Healthcheck/alertas del servicio (Railway o externo) sobre `/health`.
- [ ] Revisar límites de los rate-limiters de IA con tráfico real (coste de Gemini).

---

## 5. ✅ Ya resuelto (no tocar)

- [x] `ENVIRONMENT=production` → `/docs` y `/openapi.json` cerrados.
- [x] `Procfile` con migraciones automáticas y bind a `$PORT`.
- [x] `DATABASE_URL` se reescribe a `+asyncpg` (acepta la variable inyectada por Railway).
- [x] Gate premium server-side implementado (`requiere_premium`), solo falta la secret key.
- [x] Resiliencia Redis: reconexión perezosa + fallback en memoria.
- [x] `.env.{development,production}` desindexados de git; `.gitignore` + `.env.example`.

---

## Comandos útiles

```powershell
# Ver variables (nombres) en Railway
railway variables

# Definir variables (cada --set dispara un redeploy)
railway variables --set "GEMINI_API_KEY=<clave_con_billing>"
railway variables --set "REVENUECAT_SECRET_KEY=<secret_key>"

# Logs de arranque/runtime
railway logs

# Verificar hardening en producción
#   /health  -> 200
#   /docs    -> 404 (debe estar cerrado)
```
