# SECURITY.md — Asistente del Hogar IA

Documento de seguridad derivado de la revisión del código fuente (F-QA2 Bloque 5, 2026-06-18).
Actualizado 2026-06-24: Pivote 2 completo — gate freemium invertido, AhorroService (premium), parser ticket Mercadona (free).
Cubre modelo de autenticación, aislamiento multi-tenant, LLM, RGPD y riesgos aceptados.

---

## 1. Modelo de autenticación

### JWT de familia (`JWT_SECRET_KEY`)

- **Algoritmo:** HS256.
- **Claims:** `sub` (usuario UUID), `hogar_id` (UUID), `iat`, `exp`.
- **Expiración:** 30 días (sin refresh token — ver §5.1).
- **Startup guard:** `config.py` llama a `sys.exit(1)` si `JWT_SECRET_KEY` no está definida.
  La app nunca arranca sin clave.
- **Decodificación:** `security.decode_access_token()` — `PyJWT` valida firma y expiración;
  `ExpiredSignatureError` se discrimina de `PyJWTError` genérico para mensajes distintos.

### JWT de admin (`ADMIN_JWT_SECRET_KEY`)

- **Secreto independiente** del JWT familiar — tokens firmados con una clave no son válidos con la otra.
- Payload adicional: `role: "admin"`. `get_current_admin()` en `deps.py` verifica el role
  explícitamente después de la firma; un token familiar con `sub` válido devuelve 401.
- Si `ADMIN_JWT_SECRET_KEY` no está configurada, todos los endpoints `/admin/*` devuelven **503**
  (no 401): la superficie admin queda inaccesible por diseño.
- Bootstrap de un solo uso: `ADMIN_BOOTSTRAP_TOKEN` — **501** si no está definida, **409** si ya
  existe algún admin. Se recomienda borrar la variable después del primer bootstrap. La validación
  del token usa `hmac.compare_digest` (tiempo constante) para no filtrar el secreto por timing.
- **Sesión por cookie HttpOnly**: el login pone el JWT en una cookie `admin_token` HttpOnly
  (inaccesible a JS → mitiga exfiltración por XSS). En producción es cross-site (panel en Vercel,
  API en Railway) → `Secure; SameSite=None`. El token sigue admitiéndose por `Authorization: Bearer`
  (clientes API / tests). TTL corto: **2 h** (`ADMIN_JWT_EXPIRE_MINUTES`, antes 8 h).
- **Revocación / logout real**: el token admin incluye `jti`; `POST /admin/auth/logout` lo añade al
  blocklist (`token_blocklist.py`, Redis/memoria) y borra la cookie. Un token revocado da 401 aunque
  no haya expirado. `get_current_admin()` verifica el blocklist en cada petición.
- **CSRF**: como la sesión viaja en cookie, las mutaciones admin exigen la cabecera personalizada
  `X-Admin-Request: 1` (un sitio atacante no puede enviarla cross-origin sin un preflight que la
  allow-list de CORS rechaza). Sin ella → **403**.
- **Protección de rutas en el panel**: `admin-web/src/middleware.ts` redirige a `/login` en el edge
  si falta la pista de sesión, antes de renderizar contenido protegido (la seguridad real es la
  cookie HttpOnly de la API; la pista es solo UX).

### Contraseñas

- Hash bcrypt con salt aleatorio (`bcrypt.gensalt()`).
- `verify_password()` captura `ValueError` para hashes corruptos → nunca autentica.
- Longitud 8–72 chars enforced en el schema (límite nativo de bcrypt).

---

## 2. Aislamiento multi-tenant

Regla no-negociable documentada en `CLAUDE.md` y aplicada en `deps.py`:

```
hogar_id = current_user.hogar_id   ← de la BD del usuario validado por JWT
```

Nunca se acepta `hogar_id` de cabeceras ni del cuerpo de la petición. Todos los métodos de
repositorio exigen `hogar_id: UUID` como parámetro obligatorio e incluyen la cláusula `WHERE`
correspondiente. El flujo completo es:

```
Request → HTTPBearer → decode_access_token() → get_by_id(usuario_id) → .hogar_id → repositorio
```

Un token manipulado que altere el claim `hogar_id` es rechazado porque el `hogar_id` se lee de
la base de datos del usuario autenticado, no del propio token.

**Tablas globales sin `hogar_id`:** `admin_users`, `prompt_templates`, `recetario_maestro`.
Solo accesibles con JWT admin (secreto separado). No contienen datos personales de familias.

---

## 3. Validación de entrada

- Pydantic v2 con `extra='forbid'` en **todos** los schemas (`BaseSchema`). Cualquier campo
  no declarado en el contrato → HTTP 422.
- UUIDs en path parameters validados por FastAPI antes de llegar al handler.
- Validadores de negocio (`@field_validator`) en schemas: fechas no pasadas, longitudes,
  listas no vacías.
- Los exception handlers globales de `main.py` mapean excepciones de repositorio a códigos HTTP
  semánticos (404 / 400 / 422) sin exponer stack traces.

---

## 4. Rate limiting

Ventana deslizante en Redis (Sorted Sets). Degradación graceful a memoria si Redis no está disponible.

| Endpoint(s) | Límite | Compartido |
|-------------|--------|------------|
| `POST /auth/registro` | 10 / hora | por IP |
| `POST /auth/login` | 10 / 5 min | por IP |
| `DELETE /auth/cuenta` | 5 / hora | por IP |
| `GET /pantry/recetas`, `/sugerencias` | 20 / hora | por IP |
| `GET /pantry/plan-comidas` | 10 / hora | por IP |
| `POST /pantry/interpretar`, `/audio` | 20 / 5 min | compartido |
| `POST /pantry/sugerir-metadata` | 40 / 5 min | por IP |
| `POST /pantry/foto-nevera`, `/ocr-ticket` | 10 / hora | por IP |
| `POST /chef/chat` | 15 / día (free) · 60 / día (premium) | por hogar |
| `GET /ahorro/resumen` | 10 / día | por hogar (premium) |

**Nota:** los endpoints `/admin/*` no tienen rate limit propio. Están protegidos por el secreto
JWT separado y no son públicos, pero en un despliegue con red accesible se recomienda añadir
límites (ver §5.4).

---

## 5. Seguridad LLM

### 5.1. Superficie de prompt injection

Los endpoints que aceptan texto libre del usuario son:
- `POST /pantry/interpretar` — campo `texto` (**gratis** desde Pivote 2)
- `POST /pantry/audio` — campo `texto` (**gratis** desde Pivote 2)
- `POST /pantry/ocr-ticket` — imagen en base64 (**gratis** desde Pivote 2)
- `POST /pantry/foto-nevera` — imagen en base64 (**gratis** desde Pivote 2)
- `POST /pantry/ticket/pdf` — archivo PDF multipart (**gratis**; parser Mercadona)
- `POST /chef/chat` — campo `mensaje` (limitado por cupo diario free/premium)
- `GET /ahorro/resumen` — solo lectura; **gateado premium** (`requiere_premium`)

El webhook de RevenueCat (`POST /webhooks/revenuecat`) verifica el secreto compartido
(`Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`) con `hmac.compare_digest` (tiempo constante);
**501** si el secreto no está configurado, **401** si no coincide. La acción es idempotente
(invalida la caché de tier), por lo que no requiere protección anti-replay.

**Mitigación:** Gemini se llama con `responseSchema` (structured output) en todos los endpoints
de interpretación. El modelo solo puede devolver el esquema JSON definido; texto fuera de
estructura es ignorado. La temperatura es 0 en todas las llamadas. Esto no elimina el riesgo
de exfiltración de instrucciones del sistema, pero limita la capacidad de escritura arbitraria.

**Riesgo residual aceptado:** un usuario malintencionado podría intentar manipular las sugerencias
de recetas mediante texto de despensa diseñado para ello. El impacto se limita a sus propios datos
(aislamiento multi-tenant) y a la calidad de las sugerencias recibidas.

### 5.2. `_FILOSOFIA_MEDITERRANEA` — guard no-removible

La restricción de cocina mediterránea española se aplica en `PromptConfigService.get_system_instruction()`,
que añade la constante `_FILOSOFIA_MEDITERRANEA` **después** de cualquier instrucción editada
por el admin. No hay ningún path de código que permita llegar a Gemini sin esta constante.

### 5.3. Privacidad de datos hacia el LLM (RGPD art. 5.1.c)

- El briefing del dashboard solo recibe datos de despensa (nombres de alimentos, fechas de
  caducidad, métricas) — ningún nombre de persona desde el Pivote 2.
- **Fase 3 — perfiles individuales:** `_bloque_perfiles_individuales()` en `llm.py` inyecta en
  los prompts de `/recetas` y `/plan-comidas` los apodos de los miembros del hogar
  (`nombre`/apodo, `preferencias_dieta`, `excluir_ingredientes`). Los apodos son pseudónimos
  elegidos por el usuario ("Mamá", "El peque") — no son nombres legales almacenados. El usuario
  acepta este envío implícitamente al crear el perfil (UI muestra que influyen en las recetas IA).
  No se aplica `AnonimizadorLLM` sobre apodos porque no hay forma de revertirlos con garantía.
  Ver R9 en §9.
- `AnonimizadorLLM` en `services/privacy.py` está disponible para futuros flujos (chat) que
  puedan incluir nombres propios: sustituye `nombre` → `Familiar_N` antes del envío y revierte
  después. La clave de caché se calcula sobre el prompt ya anonimizado.
- La caché de respuestas LLM (Redis/memoria) almacena solo texto anonimizado.

### 5.4. Tier de Gemini (RGPD)

La `GEMINI_API_KEY` debe pertenecer a un proyecto Google AI con **billing activo** (o Vertex AI
con DPA y región UE). El tier gratuito puede usar prompts para mejorar los modelos de Google,
lo que es incompatible con el procesamiento de datos domésticos bajo RGPD.

**Estado actual:** la clave en Railway es personal/tier gratuito. Cambiar antes de procesar
datos de usuarios reales (ver `backend/PRODUCCION_CHECKLIST.md §1`).

---

## 6. CORS y superficie web

```python
# producción
origins = []         # sin orígenes por defecto; los clientes nativos no envían Origin

# desarrollo
origins = ["http://localhost:8081", "http://127.0.0.1:8081", ...]
```

`ALLOWED_ORIGINS` (env var, separada por comas) sobreescribe el comportamiento por defecto.
Los clientes iOS/Android no envían cabecera `Origin`, por lo que el CORS vacío en producción
no afecta a la app móvil.

Los docs interactivos (`/docs`, `/redoc`, `/openapi.json`) están deshabilitados con
`ENVIRONMENT=production` — reducción de superficie de información.

---

## 7. Gestión de secretos

- `.env` en `.gitignore` raíz; `.env.example` documenta las variables sin valores reales.
- `gitleaks` ejecutado sobre 55 commits en F-QA2 Bloque 1 — **0 secretos reales detectados**.
  12 falsos positivos (contraseñas de prueba en smoke tests) con allowlist en `.gitleaks.toml`.
- Las variables de entorno reales viven en el panel de Railway (no en el repositorio).
- **Escaneo de CVEs en CI:** `pip-audit` (backend, sin ignorelist) + `npm audit --audit-level=high`
  sobre **frontend y admin-web** (este último añadido en el segundo repaso; antes quedaba sin cubrir).
  El panel admin corre **Next.js 15.5.19** (subido desde 14.2.29 para resolver 4 advisories *high*
  sin parche en 14.2.x); las moderate restantes son de `postcss` (build-time, no runtime).

---

## 8. RGPD y retención de datos

| Mecanismo | Implementación | Detalle |
|-----------|---------------|---------|
| Soft delete | `is_deleted = true` | Todas las entidades de negocio |
| Purga física programada | `jobs/purge.py` | `is_deleted=true` + `updated_at > 30 días`; cada 24 h |
| Eliminación de cuenta | `DELETE /auth/cuenta` | Hard delete cascade; requiere re-auth con contraseña |
| Auditoría de borrado | tabla `registros_borrado` | Datos agregados, sin información personal |
| Timestamps | `TIMESTAMPTZ` (UTC) | Todas las tablas |

**Tablas en el alcance de purga/eliminación** (todas con soft delete + cascada en DELETE /auth/cuenta):

| Tabla | Datos personales | Notas |
|-------|-----------------|-------|
| `inventario_alimentos` | No | Alimentos del hogar |
| `recetas_historial` | No (nombres de recetas) | Purga + cascade |
| `perfiles_individuales` | Pseudónimos (apodos) | Purga + cascade; apodos pueden identificar indirectamente |
| `lista_compra` | No | Artículos de compra |
| `perfil_hogar` | No | Gustos culinarios, nº comensales |
| `memoria_gustos` | No (resumen gastronómico) | Derivada; cascade en DELETE /auth/cuenta. No soft-delete (regenerable) |
| `movimientos_despensa` | No (hábitos de compra/consumo) | Ledger de entradas/salidas; cascade en DELETE /auth/cuenta. Retención acotada (recortar > 12 meses) |
| `registros_borrado` | No | Solo conteos agregados |

**Ledger de movimientos (`movimientos_despensa`):** registra entradas/salidas de stock (compra/consumo/
caducado) para aprender los hábitos del hogar y afinar las sugerencias. Es **más personal** que el saldo
actual (revela hábitos de compra), aunque sigue siendo no-sanitario y de hogar. Mitigaciones: cascade en
`DELETE /auth/cuenta`, **retención acotada** (movimientos crudos > 12 meses se recortan), y al LLM solo viajan
nombres de alimentos + cantidades + fechas (vía la memoria destilada), nunca identificadores personales.

**Chef conversacional (`POST /chef/chat`):** el servidor **no persiste el texto del chat** — el
cliente reenvía los turnos recientes en cada petición y la continuidad de largo plazo vive en
`memoria_gustos` (resumen destilado, solo gustos gastronómicos). Minimiza el dato personal almacenado
(RGPD art. 5.1.c). Cada mensaje de usuario pasa por `_sanitize_user_text` antes de Gemini (ver R7, §5.1).

Solo existen dos paths de hard delete autorizados (RGPD art. 17). Ningún otro código puede emitir
`DELETE` físicos.

---

## 9. Riesgos aceptados (con mitigación)

| # | Riesgo | Mitigación | Prioridad |
|---|--------|-----------|-----------|
| R1 | ~~Sin revocación de tokens JWT~~ **Resuelto** | JTI + blocklist (`token_blocklist.py`) en JWT de familia y de admin; `POST /auth/logout` y `POST /admin/auth/logout` revocan. Token revocado → 401 inmediato | Resuelto |
| R2 | `REVENUECAT_SECRET_KEY` sin definir en Railway → gate premium desactivado | Rate limits por endpoint acotan el abuso | Alta — definir antes de cobrar a usuarios |
| R3 | `GEMINI_API_KEY` en tier gratuito → posible uso de datos por Google | Datos de prueba solo; cambiar a billing antes de usuarios reales | Alta — ver §5.4 |
| R4 | Fail-open en RevenueCat si su API cae | Rate limits + logging de errores | Baja — comportamiento intencional para no bloquear usuarios de pago |
| R5 | Sin rate limit en `/admin/*` | JWT admin separado + no es ruta pública | Baja — añadir si el panel se expone en red abierta |
| R6 | ~~Token admin en `localStorage`~~ **Resuelto** | Migrado a cookie HttpOnly + CSRF por cabecera + revocación + TTL 2 h (ver §1). Riesgo residual: cookies de terceros (cross-site Vercel↔Railway) pueden bloquearse en Safari ITP / Chrome futuro → si ocurre, servir el panel bajo el dominio de la API | Baja — residual cross-domain |
| R7 | Prompt injection en texto libre (`/interpretar`, `/audio`) | `_sanitize_user_text` (acota longitud + neutraliza delimitadores) + `responseSchema` + temperatura 0 + impacto limitado al propio hogar | Baja — inherente al flujo NL |
| R8 | OWASP ZAP pendiente (Bloque 6) | Schemathesis cubre fuzzing de contrato; ZAP añadiría análisis dinámico | Baja — post-lanzamiento |
| R9 | Apodos de miembros del hogar viajan a Gemini sin anonimizar (Fase 3) | Apodos son pseudónimos; el usuario los crea sabiendo que mejoran las sugerencias IA; `extra='forbid'` impide campos extra. Si se añaden nombres legales en el futuro, aplicar `AnonimizadorLLM` | Baja — inherente al flujo de personalización |

---

## 10. Contacto para reporte de vulnerabilidades

**Email:** soporte@fogon.app

Por favor, describe el vector de ataque, el impacto estimado y los pasos para reproducirlo.
No publiques la vulnerabilidad hasta recibir confirmación de lectura.
