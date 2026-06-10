# CHANGELOG — Asistente del Hogar IA

Formato: `[FECHA] [ÁREA] [TIPO] Descripción`
- **Tipos:** `ADD` (nuevo), `FIX` (corrección), `MOD` (modificación), `CFG` (configuración)

---

## [2026-06-10] — FASE 3: Hardening de producción (Backend)

### Decisiones clave
- Eliminado el semillado MVP de `main.py` (hogar huérfano pre-auth); cada hogar nace vacío al registrarse.
- Rate limiting en memoria por IP en `/auth/login` (10/5min) y `/auth/registro` (10/h) contra fuerza bruta.
- `/docs`, `/redoc` y `/openapi.json` deshabilitados cuando `ENVIRONMENT=production`; CORS sin orígenes
  por defecto en producción (los clientes nativos no envían Origin).

### Archivos
- `ADD` backend/app/core/{rate_limit.py, logging_config.py} — limitador ventana deslizante; logs `fecha | nivel | logger | msg`.
- `ADD` backend/.env.example — plantilla de secrets; `ADD` .gitignore raíz (excluye backend/.env, *.db, .venv, node_modules).
- `MOD` backend/app/main.py — sin semillado, middleware de log de acceso (método, ruta, status, ms), CORS por entorno.
- `MOD` backend/app/{api/routers/auth.py (+rate limit), core/config.py (+ENVIRONMENT), models/models.py (fix `datetime.utcnow` deprecado → `datetime.now(timezone.utc)`)}.
- `MOD` backend/.env (+ENVIRONMENT=development); `DEL` frontend/src/state/hogarStore.ts (huérfano, vacío).

### Verificación: smoke test 12/12 OK (incl. 429); docs_url=None con ENVIRONMENT=production; `ts:check` 0 errores.
### Deuda técnica: rate limiting en memoria → migrar a Redis si el backend escala a varias réplicas.
### Qué sigue: **F4 — Modelo freemium** (requiere cuenta RevenueCat: https://app.revenuecat.com).

---

## [2026-06-10] — FASE 2: Autenticación en el cliente móvil (Frontend)

### Decisión clave
La app ya no envía `X-Hogar-ID` ni usa `DEFAULT_HOGAR_ID`: la sesión JWT se persiste en
`expo-secure-store` (almacenamiento cifrado nativo) y `apiRequest` inyecta `Authorization: Bearer`.
Un 401 en cualquier endpoint (salvo `/auth/*`) cierra la sesión local y devuelve a la pantalla de acceso.

### Archivos
- `ADD` frontend/src/state/authStore.ts — Zustand: token/usuario/hogar, hidratación desde SecureStore, setSession, logout.
- `ADD` frontend/src/screens/AuthScreen.tsx — Login y "Crear hogar" (registro) con validación local y estilo de la app.
- `MOD` frontend/src/api/api.ts — Bearer token en vez de X-Hogar-ID; logout automático en 401.
- `MOD` frontend/src/navigation/AppNavigator.tsx — Gating: spinner durante hidratación → AuthScreen sin token → tabs.
- `MOD` frontend/src/screens/DashboardScreen.tsx — Saludo con nombre real del usuario; botón 👤 = cerrar sesión.
- `MOD` frontend/src/{types/types.ts (+Usuario,Hogar,TokenResponse), config/config.ts (eliminado DEFAULT_HOGAR_ID)}.
- `MOD` frontend/{.env.development,.env.production} — Eliminada EXPO_PUBLIC_DEFAULT_HOGAR_ID; package.json +expo-secure-store.

### Verificación: `npm run ts:check` → 0 errores.
### Qué sigue: **F3 — Hardening de producción** (eliminar semillado MVP, CORS estricto, logs, secrets).

---

## [2026-06-10] — FASE 1: Autenticación JWT y aislamiento multi-tenant real (Backend)

### Decisión clave
La cabecera `X-Hogar-ID` permitía a cualquier cliente acceder a datos de cualquier hogar. Ahora el
`hogar_id` se deriva exclusivamente del token JWT firmado: `deps.get_hogar_id` valida el Bearer token
y consulta el usuario en BD, asegurando los 4 routers existentes sin modificarlos.

### Archivos
- `ADD` backend/app/core/{config.py,security.py} — JWT_SECRET_KEY obligatorio (HS256, 30 días), bcrypt.
- `ADD` backend/app/{repositories/user.py, services/auth.py, api/routers/auth.py} — registro (crea Hogar+Usuario atómico), login, /auth/me. Mensaje único en credenciales inválidas (anti-enumeración).
- `ADD` backend/alembic/versions/f2c91d7a5b40_add_usuarios_table.py — tabla `usuarios` (email único).
- `ADD` backend/smoke_test_auth.py — 11 pruebas (BD temporal): registro, login, 401s, aislamiento entre hogares.
- `MOD` backend/app/{models/models.py, schemas/schemas.py, api/deps.py, main.py, requirements.txt(+pyjwt,bcrypt,aiosqlite,email-validator)}, backend/.env (+JWT_SECRET_KEY).
- `FIX` user.py — orden de refresh: `cascade="all"` en Hogar.usuarios incluye refresh-expire → MissingGreenlet.

### Verificación: `alembic upgrade head` OK; smoke test 11/11 OK.
### Deuda técnica: semillado MVP en main.py quedó huérfano (hogar sin usuario) → eliminar en F3.
### Qué sigue: **F2 — frontend auth** (la app móvil no funcionará hasta completarla: aún envía X-Hogar-ID).

---

## [2026-06-09 15:07] — Fix: Error de dependencias "react-native-reanimated" y "react-native-worklets" para SDK 54 / NativeWind v4

### Causa
NativeWind v4 depende de `react-native-reanimated`. En Reanimated v4 (correspondiente a SDK 54 / RN 0.81.x), las funcionalidades de worklets se extrajeron a la dependencia separada `react-native-worklets` y el plugin de Babel pasó a ser `react-native-worklets/plugin` en lugar de `react-native-reanimated/plugin`. Ninguno de los dos paquetes estaba instalado ni configurado correctamente.

### Solución
1. Se instalaron `react-native-reanimated` y `react-native-worklets`.
2. Se reemplazó el plugin de Babel por `'react-native-worklets/plugin'` en `babel.config.js`.

### Archivos modificados
- `ADD` [frontend/package.json](file:///p:/AsistenteHogar/frontend/package.json) — Añadidos `react-native-reanimated` y `react-native-worklets`.
- `MOD` [frontend/babel.config.js](file:///p:/AsistenteHogar/frontend/babel.config.js) — Configurado el plugin `'react-native-worklets/plugin'`.

---

## [2026-06-09 15:01] — Fix: Error Babel "Cannot find react-native-worklets/plugin"

### Causa
`babel.config.js` incluía `'nativewind/babel'` como preset. En NativeWind v4 este preset requiere `react-native-worklets/plugin` internamente, paquete que no es una dependencia directa y no estaba instalado.

### Solución
En NativeWind v4 la transformación CSS la realiza **Metro** (via `withNativeWind` en `metro.config.js`). Babel solo necesita `jsxImportSource: 'nativewind'` para que los componentes acepten la prop `className`. El preset `nativewind/babel` no es necesario y fue eliminado.

### Archivos modificados
- `FIX` [frontend/babel.config.js](file:///p:/AsistenteHogar/frontend/babel.config.js) — Eliminado preset `'nativewind/babel'`. Configuración final: solo `['babel-preset-expo', { jsxImportSource: 'nativewind' }]`.

---

## [2026-06-09 14:57] — Corrección de errores IDE y tipos FlatList

### Causa
Dos grupos de errores independientes:
1. **IDE falsos positivos "Cannot find module"** — El tsserver del IDE resolvía módulos desde la raíz del workspace (`p:\AsistenteHogar\`) en lugar de `frontend/node_modules/`.
2. **Implicit `any` en FlatList** — Callbacks `keyExtractor` y `renderItem` sin tipo explícito.

### Archivos modificados
- `FIX` [.vscode/settings.json](file:///p:/AsistenteHogar/.vscode/settings.json) — Añadido `"typescript.tsdk": "frontend/node_modules/typescript/lib"` para que el IDE resuelva módulos desde la carpeta correcta.
- `FIX` [frontend/src/screens/PantryScreen.tsx](file:///p:/AsistenteHogar/frontend/src/screens/PantryScreen.tsx) — `FlatList<AlimentoItem>`, `keyExtractor: (item: AlimentoItem)`, `renderItem: ({ item }: { item: AlimentoItem })`.
- `FIX` [frontend/src/screens/CalendarScreen.tsx](file:///p:/AsistenteHogar/frontend/src/screens/CalendarScreen.tsx) — `FlatList<EventoItem>`, `keyExtractor: (item: EventoItem)`, `renderItem: ({ item }: { item: EventoItem })`, `.map((p: string))`.

### Verificación
- `tsc --noEmit` → **0 errores**
- IDE: **0 subrayados rojos** en todos los archivos abiertos.

---

## [2026-06-09 14:52] — Migración Expo SDK 51 → SDK 54

### Causa
Expo Go en iPhone detectó incompatibilidad: el dispositivo tiene SDK 54 y el proyecto tenía SDK 51.

### Archivos modificados
- `MOD` [frontend/package.json](file:///p:/AsistenteHogar/frontend/package.json) — Actualizado: `expo ~54.0.0`, `react 18.3.1`, `react-native 0.76.9`, `expo-status-bar ~2.2.3`, `react-navigation ^7.3.0`, `nativewind ^4.1.23`, `zustand ^5.0.5`, `typescript ~5.8.3`.
- `MOD` [frontend/babel.config.js](file:///p:/AsistenteHogar/frontend/babel.config.js) — NativeWind v4: reemplazado plugin v2 por `jsxImportSource: 'nativewind'` + preset `nativewind/babel`.
- `MOD` [frontend/tailwind.config.js](file:///p:/AsistenteHogar/frontend/tailwind.config.js) — NativeWind v4: añadido `presets: [require('nativewind/preset')]`.
- `ADD` [frontend/metro.config.js](file:///p:/AsistenteHogar/frontend/metro.config.js) — Nuevo archivo requerido por NativeWind v4 (`withNativeWind` + `getDefaultConfig`).
- `ADD` [frontend/global.css](file:///p:/AsistenteHogar/frontend/global.css) — Punto de entrada CSS (`@tailwind base/components/utilities`) para NativeWind v4.
- `MOD` [frontend/App.tsx](file:///p:/AsistenteHogar/frontend/App.tsx) — Añadido `import './global.css'` requerido por NativeWind v4.

### Verificación
- `tsc --noEmit` → **0 errores** tras actualizar TypeScript de `~5.3.3` a `~5.8.3` (requisito de SDK 54).
- 802 paquetes instalados limpiamente (`npm install --legacy-peer-deps`).

---



### Causa
El IDE (**Antigravity IDE**) vació el contenido de 4 archivos al abrirlos simultáneamente durante una sesión de edición.

### Archivos restaurados
- `FIX` [frontend/src/utils/types.ts](file:///p:/AsistenteHogar/frontend/src/utils/types.ts) — Restauradas interfaces `AlimentoItem`, `EventoItem`, `BriefingData`, `ConflictoEvento`.
- `FIX` [frontend/src/hooks/useDashboard.ts](file:///p:/AsistenteHogar/frontend/src/hooks/useDashboard.ts) — Restaurado hook con datos mock y simulación de latencia.
- `FIX` [frontend/src/hooks/usePantry.ts](file:///p:/AsistenteHogar/frontend/src/hooks/usePantry.ts) — Restaurado hook con tipos explícitos en todos los callbacks (`AlimentoItem`).
- `FIX` [frontend/src/hooks/useCalendar.ts](file:///p:/AsistenteHogar/frontend/src/hooks/useCalendar.ts) — Restaurado hook con tipos explícitos en callbacks (`EventoItem`).

### Errores TypeScript corregidos (tsc --noEmit: 0 errores)
- `FIX` [frontend/src/screens/PantryScreen.tsx](file:///p:/AsistenteHogar/frontend/src/screens/PantryScreen.tsx) — TS7006: Añadidos tipos explícitos en `.filter((i: AlimentoItem))` y `.map((i: AlimentoItem))`.
- `FIX` [frontend/src/screens/CalendarScreen.tsx](file:///p:/AsistenteHogar/frontend/src/screens/CalendarScreen.tsx) — TS7006: Añadidos tipos explícitos en `.map((p: string))`, `.flatMap((c: ConflictoEvento))` y `.map((c: ConflictoEvento, i: number))`.

---

- **Tipos:** `ADD` (nuevo), `FIX` (corrección), `MOD` (modificación), `CFG` (configuración)

---

## [2026-06-09] — Inicialización del Proyecto

### Documentación y Arquitectura
- `ADD` [01_CONTEXTO_Y_ARQUITECTURA_APP.md](file:///p:/AsistenteHogar/01_CONTEXTO_Y_ARQUITECTURA_APP.md) — Contrato de arquitectura: esquema de las 4 tablas de la base de datos (PostgreSQL), estructura de directorios del monorepo y contratos de los endpoints REST del MVP (Dashboard, Despensa y Calendario).

### Reglas de Agentes
- `ADD` [.agents/rules/projectmaster.md](file:///p:/AsistenteHogar/.agents/rules/projectmaster.md) — Blueprint general del proyecto: visión, stack tecnológico, módulos core del MVP y líneas rojas de seguridad (IA pasiva, temperatura=0, Pydantic, sanitización, XML).
- `ADD` [.agents/rules/DB-Architect.md](file:///p:/AsistenteHogar/.agents/rules/DB-Architect.md) — Reglas del agente de Base de Datos: SQLAlchemy 2.0, índices, patrón repositorio, bloqueo de fila (`FOR UPDATE`), soft deletes y pre-análisis obligatorio (`<analisis_previo>`).
- `ADD` [.agents/rules/Pydantic-Enforcer.md](file:///p:/AsistenteHogar/.agents/rules/Pydantic-Enforcer.md) — Reglas del agente de API: Pydantic v2 con `extra='forbid'`, mensajes de error en español, temperatura LLM = 0, prohibición de retornar modelos ORM directos.
- `ADD` [.agents/rules/Tailwind-Stylist.md](file:///p:/AsistenteHogar/.agents/rules/Tailwind-Stylist.md) — Reglas del agente de Frontend: separación TSX / hooks, NativeWind, Zustand para estado global, sin lógica inline en componentes.

### Configuración del IDE
- `ADD` [.vscode/settings.json](file:///p:/AsistenteHogar/.vscode/settings.json) — Configuración del intérprete de Python, rutas de análisis de Pylance y exclusión de `node_modules` para evitar bloqueos de la extensión PET.
- `FIX` Desinstalación de `ms-python.vscode-python-envs` en Antigravity IDE → solución definitiva del error "PET failed after 3 restart attempts".

---

## [2026-06-09] — Andamiaje Backend (FastAPI)

### Archivos Creados
- `ADD` [backend/requirements.txt](file:///p:/AsistenteHogar/backend/requirements.txt) — Dependencias: `fastapi`, `uvicorn`, `pydantic>=2.6.0`, `sqlalchemy>=2.0.28`, `asyncpg`, `psycopg2-binary`, `alembic`, `python-dotenv`, `httpx`.
- `ADD` [backend/app/main.py](file:///p:/AsistenteHogar/backend/app/main.py) — Punto de entrada FastAPI con middleware CORS, endpoints `/` y `/health`.
- `ADD` [backend/app/__init__.py](file:///p:/AsistenteHogar/backend/app/__init__.py)
- `ADD` [backend/app/api/__init__.py](file:///p:/AsistenteHogar/backend/app/api/__init__.py)
- `ADD` [backend/app/api/routers/__init__.py](file:///p:/AsistenteHogar/backend/app/api/routers/__init__.py)
- `ADD` [backend/app/schemas/__init__.py](file:///p:/AsistenteHogar/backend/app/schemas/__init__.py)
- `ADD` [backend/app/models/__init__.py](file:///p:/AsistenteHogar/backend/app/models/__init__.py)
- `ADD` [backend/app/repositories/__init__.py](file:///p:/AsistenteHogar/backend/app/repositories/__init__.py)
- `ADD` [backend/app/services/__init__.py](file:///p:/AsistenteHogar/backend/app/services/__init__.py)

### Entorno Python
- `CFG` Instalación de Python 3.12.13 vía `uv` (aislado, sin Microsoft Store).
- `CFG` Creación de entorno virtual `backend/.venv` con `uv venv`.
- `CFG` Instalación de 25 dependencias en el entorno virtual con `uv pip install`.
- `FIX` [backend/app/main.py](file:///p:/AsistenteHogar/backend/app/main.py) — Restauración de la línea `allow_methods=["*"]` que fue editada accidentalmente.

---

## [2026-06-09] — Andamiaje Frontend (React Native + Expo + NativeWind)

### Archivos Creados
- `ADD` [frontend/package.json](file:///p:/AsistenteHogar/frontend/package.json) — Dependencias: Expo 51, React Native, NativeWind, Zustand, React Navigation.
- `ADD` [frontend/tailwind.config.js](file:///p:/AsistenteHogar/frontend/tailwind.config.js) — Configuración de Tailwind para NativeWind con paleta de colores del proyecto.
- `ADD` [frontend/babel.config.js](file:///p:/AsistenteHogar/frontend/babel.config.js) — Plugin `nativewind/babel` para compilar clases Tailwind.
- `ADD` [frontend/tsconfig.json](file:///p:/AsistenteHogar/frontend/tsconfig.json) — TypeScript con `strict: true` basado en `expo/tsconfig.base`.
- `ADD` [frontend/nativewind-env.d.ts](file:///p:/AsistenteHogar/frontend/nativewind-env.d.ts) — Referencia de tipos para soportar `className` en componentes React Native.

---

## [2026-06-09] — Implementación Frontend MVP (Agente: Tailwind-Stylist)

### Estado Global
- `ADD` [frontend/src/state/hogarStore.ts](file:///p:/AsistenteHogar/frontend/src/state/hogarStore.ts) — Zustand store con `hogar_id` y `hogar_nombre` compartidos entre pantallas.

### Tipos Compartidos
- `ADD` [frontend/src/utils/types.ts](file:///p:/AsistenteHogar/frontend/src/utils/types.ts) — Interfaces TypeScript: `AlimentoItem`, `EventoItem`, `BriefingData`, `ConflictoEvento`.

### Custom Hooks (Lógica Aislada)
- `ADD` [frontend/src/hooks/useDashboard.ts](file:///p:/AsistenteHogar/frontend/src/hooks/useDashboard.ts) — Obtención del briefing diario con datos mock y simulación de latencia de red.
- `ADD` [frontend/src/hooks/usePantry.ts](file:///p:/AsistenteHogar/frontend/src/hooks/usePantry.ts) — Gestión de inventario con borrado lógico, `addItem`, `updateQuantity`, y función `getDiasParaCaducar`.
- `ADD` [frontend/src/hooks/useCalendar.ts](file:///p:/AsistenteHogar/frontend/src/hooks/useCalendar.ts) — Gestión de eventos con algoritmo de detección de solapamientos de horarios en tiempo real.

### Pantallas (TSX puro, sin lógica de negocio)
- `ADD` [frontend/src/screens/DashboardScreen.tsx](file:///p:/AsistenteHogar/frontend/src/screens/DashboardScreen.tsx) — Pantalla principal: briefing de texto, chips de resumen (caducidades, conflictos, eventos) y botón de refresco.
- `ADD` [frontend/src/screens/PantryScreen.tsx](file:///p:/AsistenteHogar/frontend/src/screens/PantryScreen.tsx) — Inventario con tarjetas color-coded (rojo/ámbar/verde según días para caducar), banner de alertas y modal de añadir producto.
- `ADD` [frontend/src/screens/CalendarScreen.tsx](file:///p:/AsistenteHogar/frontend/src/screens/CalendarScreen.tsx) — Agenda familiar con eventos, badge "CONFLICTO" por solapamiento, banner de advertencia y diálogo de confirmación de conflicto.

### Navegación y Punto de Entrada
- `ADD` [frontend/src/navigation/AppNavigator.tsx](file:///p:/AsistenteHogar/frontend/src/navigation/AppNavigator.tsx) — Bottom Tab Navigator tipado (`RootTabParamList`) con iconos emoji y estilo dark mode.
- `MOD` [frontend/App.tsx](file:///p:/AsistenteHogar/frontend/App.tsx) — Punto de entrada envuelto en `SafeAreaProvider` + `NavigationContainer`.

### Correcciones TypeScript (tsc --noEmit: 0 errores)
- `FIX` [frontend/src/navigation/AppNavigator.tsx](file:///p:/AsistenteHogar/frontend/src/navigation/AppNavigator.tsx) — Añadidos tipos explícitos (`RouteProp<RootTabParamList>`, `BottomTabNavigationOptions`, `{ focused: boolean }`) para resolver errores TS7031 (implicit `any`).
