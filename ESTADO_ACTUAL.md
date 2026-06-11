# ESTADO ACTUAL — AsistenteHogar (2026-06-11)

## ✅ Completado

| Fase | Descrición | Archivos principales |
|------|-----------|----------------------|
| F0 | MVP base (endpoints, BD, UI mock) | backend/app/main.py, frontend/App.tsx |
| F1 | JWT + multi-tenant (hogar_id del token) | backend/app/{core/security.py, services/auth.py, api/routers/auth.py} |
| F2 | Frontend auth (login/registro/SecureStore) | frontend/src/{state/authStore.ts, screens/AuthScreen.tsx} |
| F3 | Hardening (rate limiting, CORS, logs) | backend/app/core/{rate_limit.py, logging_config.py} |
| F-IA | Gemini real (briefing + recetas + caché) | backend/app/services/llm.py, backend/app/api/routers/pantry.py |
| F-HONESTA | Reenfoque agente personal (sin UI falsa) | frontend/src/screens/{DashboardScreen, PantryScreen, CalendarScreen}.tsx |

## 🚀 Próximo paso: F4 — Freemium

**Descripción:** Integración RevenueCat (IAP iOS/Android) + límites free vs premium en backend.

**Requiere:** Cuenta en https://app.revenuecat.com

**No iniciado aún.** Esperar instrucción del usuario.

---

## 📊 Qué hace la app ahora

### Dashboard
- Briefing diario generado por Gemini
- Eventos de hoy
- Tareas pendientes
- Alertas de alimentos próximos a caducar

### Despensa
- Inventario real con stock, categoría, caducidad
- Recetas sugeridas por IA (max 3)
- Filtros por categoría y stock bajo
- Añadir/editar productos

### Calendario
- Agenda familiar con eje horario 07:00–22:00
- Conflictos de horario detectados automáticamente
- **Quick-add en lenguaje natural** → Gemini interpreta y propone evento → usuario confirma
- Filtros por participantes (derivados de eventos reales)

### Autenticación
- Registro/login con JWT (30 días)
- Token en SecureStore (cifrado nativo)
- Aislamiento multi-tenant garantizado

---

## 🔧 Verificación mínima antes de cambios

```bash
# Backend
cd backend
python smoke_test_auth.py  # Debe pasar 12/12

# Frontend
cd frontend
npm run ts:check  # Debe retornar 0 errores
```

---

## 📁 Archivos críticos

### Backend
- `backend/.env` — JWT_SECRET_KEY, GEMINI_API_KEY, DATABASE_URL, ENVIRONMENT
- `backend/app/main.py` — punto de entrada FastAPI
- `backend/app/services/llm.py` — Gemini (briefing, recetas, interpretar)
- `backend/app/api/routers/` — endpoints auth, dashboard, pantry, calendar, tasks
- `backend/alembic/versions/` — migraciones SQL

### Frontend
- `frontend/src/screens/` — DashboardScreen, PantryScreen, CalendarScreen (UI principal)
- `frontend/src/state/authStore.ts` — Zustand (token, usuario, hogar)
- `frontend/src/api/api.ts` — httpx client con Bearer token
- `frontend/tailwind.config.js` — Tailwind config para NativeWind

### Documentación
- `PROMPT_MAESTRO.md` — roadmap oficial + restricciones
- `CHANGELOG.md` — historial de todas las fases
- `01_CONTEXTO_Y_ARQUITECTURA_APP.md` — schema BD, endpoints, arquitectura
- `ESTADO_ACTUAL.md` — este archivo

---

## 🐛 Deuda técnica conocida

| Problema | Ubicación | Impacto | Solución |
|----------|-----------|--------|----------|
| Caché en memoria | backend/app/services/llm.py | Medium si escala | Migrar a Redis (F5) |
| Rate limit en memoria | backend/app/core/rate_limit.py | Medium si escala | Migrar a Redis (F5) |
| react-native-svg sin usar | frontend/package.json | Bajo (+50KB) | npm uninstall |
| Fotos unsplash de URLs | frontend/src/screens/ | Bajo (RN cachea) | Mover a assets/ |

Ver [[technical_debt]] en memoria para detalles.

---

## 🎯 Restricciones inamovibles

1. **Multi-tenant:** `hogar_id` SIEMPRE del JWT, NUNCA de cabecera cliente
2. **IA pasiva:** IA solo sugiere, usuario siempre confirma
3. **Temperatura LLM = 0:** Reproducibilidad, no creatividad
4. **Pydantic v2:** `extra='forbid'` en todos los schemas
5. **Sin modelos ORM:** Routers retornan schemas, no models

---

## 🔐 Stack & Versiones

| Componente | Versión | Notas |
|-----------|---------|-------|
| React Native | 0.76.9 (SDK 54) | Expo Go compatible |
| NativeWind | v4.1.23 | Tailwind para RN |
| FastAPI | 0.115+ | Python 3.12 |
| SQLAlchemy | 2.0.28+ | async + asyncpg |
| Pydantic | 2.6.0+ | `extra='forbid'` |
| Gemini | 2.5-flash | Configurable en .env |

---

## 📝 Notas últimas sesiones

- **2026-06-11:** Eliminadas funciones falsas (domótica, energía, clima, cámaras). App enfocada en agente personal honesto.
- **2026-06-11:** Implementado `POST /calendar/interpretar` con Gemini real (lenguaje natural → evento propuesto).
- **2026-06-11:** Refactorizado frontend (Dashboard, Pantry, Calendar) sin UI engañosa.
- **2026-06-11:** Creado sistema de memoria del proyecto (MEMORY.md + archivos).

---

## 👤 Contacto & Credenciales

- **Usuario GitHub:** navarroru
- **Email:** navaroruiz2000@gmail.com
- **Próximas cuentas necesarias:** RevenueCat (F4), hosting (F5), App Store + Google Play (F6/F7)
