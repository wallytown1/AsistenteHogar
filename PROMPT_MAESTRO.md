# PROMPT_MAESTRO — Asistente del Hogar IA

Objetivo final: app publicada en App Store y Google Play con modelo freemium.
Fuente de verdad de arquitectura: `01_CONTEXTO_Y_ARQUITECTURA_APP.md`.
Progreso por fases: `CHANGELOG.md` (cada fase completada añade una entrada).

## Restricciones inamovibles
- **Multi-tenancy:** ningún cambio puede debilitar el aislamiento entre hogares.
- **IA pasiva:** la IA nunca ejecuta acciones automáticas; solo informa y sugiere.
- Temperatura LLM = 0. Pydantic v2 con `extra='forbid'`. Mensajes de error en español.

## Roadmap de fases hacia producción

| Fase | Descripción | Estado |
|------|-------------|--------|
| F0 | MVP funcional (backend FastAPI + frontend Expo, multi-tenant por cabecera) | ✅ Completada |
| F1 | Autenticación JWT: usuarios, registro/login, hogar derivado del token (no de cabecera) | ✅ Completada |
| F2 | Frontend auth: pantallas login/registro, token en SecureStore, gating de navegación | ✅ Completada |
| F3 | Hardening producción: eliminar semillado MVP, rate limiting, logs estructurados, CORS estricto, secrets fuera del repo | ✅ Completada |
| F-IA | IA real con Gemini: briefing del dashboard + sugerencias de recetas desde despensa, caché TTL, modelo configurable | ✅ Completada |
| F4 | Modelo freemium: entitlements en backend, integración RevenueCat (IAP iOS/Android), límites free vs premium | Pendiente |
| F5 | Infraestructura: deploy backend (Railway/Render) con PostgreSQL gestionado, migraciones automáticas, dominio + HTTPS | Pendiente |
| F6 | Build de tiendas: EAS Build, app.json/eas.json, iconos, splash, políticas de privacidad | Pendiente |
| F7 | Publicación: App Store Connect + Google Play Console, revisión y lanzamiento | Pendiente |

## Credenciales necesarias por fase
- F1–F3: ninguna externa (JWT_SECRET_KEY se genera localmente).
- F4: cuenta RevenueCat (https://app.revenuecat.com) + productos IAP en las consolas de las tiendas.
- F5: cuenta de hosting (https://railway.app o https://render.com). GEMINI_API_KEY ✅ ya configurada en backend/.env (recordar añadirla como variable de entorno del hosting al desplegar).
- F6–F7: Apple Developer Program (https://developer.apple.com/programs/, 99 €/año) y Google Play Console (https://play.google.com/console, 25 $ una vez) + cuenta Expo/EAS (https://expo.dev).

## Reglas de sesión
1. Identificar siguiente fase pendiente, ejecutarla completa, documentar en CHANGELOG.md (máx. 20 líneas) y parar.
2. Deuda técnica detectada fuera de la fase actual → anotar en CHANGELOG.md, no desviarse.
3. Verificación mínima por fase: backend arranca y responde; `npm run ts:check` limpio en frontend.
