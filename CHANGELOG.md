# CHANGELOG — Asistente del Hogar IA

Formato: `[FECHA] [ÁREA] [TIPO] Descripción`
- **Tipos:** `ADD` (nuevo), `FIX` (corrección), `MOD` (modificación), `CFG` (configuración)
- **Historial anterior:** ver [`CHANGELOG_ARCHIVE.md`](CHANGELOG_ARCHIVE.md) para entradas pre-2026-06-11

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
