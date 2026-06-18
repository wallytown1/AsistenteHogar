# Referencia de la API — Asistente del Hogar IA

> **Pivote 2 (2026-06-18):** la app es **exclusivamente comida, stock y recetas mediterráneas españolas**.
> Los módulos Eventos (calendario) y Tareas (domésticas) fueron **eliminados por completo**.
> Ver `ARCHITECTURE_MAP.md`.

Contrato de los endpoints REST del backend, derivado del código real
(`backend/app/api/routers/` y `backend/app/schemas/schemas.py`).

- **Prefijo global:** `/api/v1` (excepto `GET /health` y `GET /`).
- **Autenticación:** Bearer JWT en la cabecera `Authorization: Bearer <token>`.
  Todos los endpoints de negocio derivan el `hogar_id` del token (aislamiento
  multi-tenant); nunca se acepta de cabeceras ni del cuerpo.
- **Validación:** Pydantic v2 con `extra='forbid'` (los campos no declarados
  provocan 422).

## Tabla de códigos de respuesta comunes

| Código | Significado en esta API |
|--------|-------------------------|
| 200 | OK |
| 201 | Recurso creado |
| 400 | Cuerpo de actualización ausente en un PATCH |
| 401 | Falta el token, es inválido o expiró |
| 404 | Recurso inexistente o de otro hogar (cross-tenant) |
| 409 | Conflicto (email ya registrado) |
| 422 | Error de validación (tipo inválido, campo extra, ID no-UUID, regla de negocio) |
| 402 | Función de pago — requiere suscripción premium activa (`requiere_premium`) |
| 429 | Límite de peticiones superado (rate limiting) |

---

## Autenticación

### `POST /api/v1/auth/registro`
Crea un hogar nuevo con su primer usuario y devuelve la sesión iniciada.
Rate limit: 10 registros/hora por IP.

**Body** (`RegistroRequest`):
```json
{
  "nombre_hogar": "Familia Navarro",   // 2-100 caracteres
  "nombre": "Ana",                      // 2-100 caracteres
  "email": "ana@ejemplo.com",           // email válido, ≤255
  "password": "contrasena_segura"       // 8-72 caracteres y ≤72 bytes
}
```
**201** → `TokenResponse` (token + usuario + hogar). · **409** email duplicado · **422** validación · **429** rate limit.

### `POST /api/v1/auth/login`
Inicia sesión con email y contraseña. Rate limit: 10 intentos/5 min por IP.
El mensaje de error no distingue entre email inexistente y contraseña errónea
(anti-enumeración de usuarios).

**Body** (`LoginRequest`): `{ "email": "...", "password": "..." }`
**200** → `TokenResponse` · **401** credenciales incorrectas · **429** rate limit.

### `GET /api/v1/auth/me` 🔒
Devuelve el perfil del usuario autenticado.
**200** → `UsuarioResponse` · **401** sin token.

### `DELETE /api/v1/auth/cuenta` 🔒
Destrucción **física y definitiva** de la cuenta: elimina el hogar derivado del JWT
y todos sus datos vinculados (usuarios, inventario — incluidos los soft-deleted).
RGPD art. 17 + App Store 5.1.1(v) / Google Play. Irreversible.
Requiere re-autenticación con la contraseña actual (un token activo no basta).
Deja evidencia agregada sin datos personales en `registros_borrado`.
Rate limit: 5 intentos/hora por IP.

**Body** (`CuentaEliminarRequest`): `{ "password": "contrasena_actual" }`
**200** → `{ "success": true, "message": "Cuenta y datos del hogar eliminados permanentemente." }` · **401** token inválido o contraseña incorrecta (la cuenta no se borra) · **422** validación · **429** rate limit.

---

## Dashboard

### `GET /api/v1/dashboard` 🔒
Estado de la despensa para hoy + briefing generado por Gemini (o fallback estático sin API key).

**200** → `DashboardUnifiedContext`:
```json
{
  "fecha": "2026-06-18",
  "alertas_despensa": { "porcentaje_stock": 80.0, "items_disponibles": 5, "alertas_caducidad": [], "items": [] },
  "briefing_texto": "Buenos días...",
  "briefing_generado_por_ia": false
}
```

`briefing_generado_por_ia` es `true` solo cuando el texto proviene del modelo
(obliga al cliente a mostrar el aviso de transparencia de IA `AIDisclaimerBanner`); `false` con el
fallback estático.

---

## Despensa ★ (función principal del producto)

> Las recetas y el plan de comidas son el núcleo del producto. Filosofía: cocina mediterránea española
> tradicional y de aprovechamiento. Todos los endpoints de IA son **IA pasiva**: solo sugieren,
> el usuario confirma antes de cualquier escritura.

### `GET /api/v1/pantry` 🔒
Inventario activo y métricas de stock.
**200** → `PantryStockMetrics` `{ porcentaje_stock, items_disponibles, alertas_caducidad[], items[] }`.
`alertas_caducidad` incluye los alimentos que caducan en ≤6 días.

### `GET /api/v1/pantry/recetas` 🔒
Sugerencias de recetas por IA a partir del inventario (prioriza lo que caduca).
IA pasiva: solo sugiere. Sin API key devuelve lista vacía con mensaje.
**200** → `RecetasSugeridasResponse` `{ recetas[], generado_por_ia, mensaje }`.
Rate limit: 20/hora por IP (**429** al exceder). Cacheado 1 h.

### `GET /api/v1/pantry/plan-comidas` 🔒
Plan de comidas semanal (comida + cena, 7 días) por IA a partir de la despensa,
priorizando lo que caduca. IA pasiva: solo sugiere.
**200** → `PlanComidasResponse` `{ dias[] {dia, comida, cena}, generado_por_ia, mensaje }`.
Rate limit: 10/hora por IP. Cacheado 2 h.

### `POST /api/v1/pantry/interpretar` 🔒
Interpreta lenguaje natural y devuelve **propuestas** de uno o varios productos
(IA pasiva: nunca los añade; el cliente confirma y llama a `POST /pantry` por cada uno).
**Body** (`InterpretarDespensaRequest`):
```json
{ "texto": "compré 6 huevos y leche que caduca el viernes", "fecha_referencia": "2026-06-14" }
```
**200** → `InterpretarDespensaResponse` `{ alimentos[], mensaje }` (`alimentos` vacío si no se pudo interpretar o sin API key).
Rate limit: 20/5 min por IP (compartido con los demás `/interpretar`).

### `POST /api/v1/pantry/sugerir-metadata` 🔒
Sugiere categoría y caducidad estimada para un alimento dado su nombre (ayuda de formulario).
**Body** (`SugerirMetadataRequest`):
```json
{ "nombre": "Yogur natural", "fecha_referencia": "2026-06-14" }
```
**200** → `SugerenciaMetadataResponse` `{ categoria, dias_estimados, fecha_caducidad_estimada, generado_por_ia, mensaje }`.
Rate limit: 40/5 min por IP.

### `POST /api/v1/pantry/ocr-ticket` 🔒 ⭐ Premium
Escanea una imagen de ticket de compra con Gemini Vision y extrae los alimentos detectados como propuesta (IA pasiva — el usuario confirma antes de añadir).
**Body** (`TicketOcrRequest`):
```json
{ "imagen_base64": "<JPEG en base64>", "fecha_referencia": "2026-06-16" }
```
**200** → `TicketOcrResponse` `{ alimentos[], mensaje }` — lista de `AlimentoInterpretado` con nombre, cantidad, unidad, categoría y caducidad estimada.
Rate limit: 20/5 min por IP (compartido con `/interpretar`). Requiere `GEMINI_API_KEY`.
**402** si el usuario no tiene suscripción premium activa.

### `POST /api/v1/pantry` 🔒
**Body** (`InventarioAlimentoCreate`):
```json
{
  "nombre": "Leche",            // 1-150
  "cantidad": 2.0,              // > 0
  "unidad": "litros",           // 1-30
  "fecha_caducidad": "2026-06-20", // opcional, no puede ser pasada
  "categoria": "Lácteos"        // 1-50
}
```
**201** → `InventarioAlimentoResponse` · **422** validación.

### `PATCH /api/v1/pantry/{alimento_id}` 🔒
Actualización parcial (`InventarioAlimentoUpdate`, todos los campos opcionales).
**200** → item actualizado · **400** sin cuerpo · **404** inexistente/ajeno · **422** ID no-UUID o validación.

### `DELETE /api/v1/pantry/{alimento_id}` 🔒
Borrado lógico (`is_deleted = true`).
**200** → item borrado · **404** inexistente/ajeno.

### `POST /api/v1/pantry/audio` 🔒 ⭐ Premium ✅ Implementado
Interpreta texto transcrito de una nota de voz y devuelve propuesta de alimentos (IA pasiva — usuario confirma).
Gemini procesa el texto igual que `/pantry/interpretar` pero optimizado para micro-ajustes
rápidos ("Apunta que he gastado dos huevos"). UI: FAB micrófono con dictado nativo.
**Body** (`InterpretarDespensaRequest`): igual que `/pantry/interpretar`.
**200** → `InterpretarDespensaResponse`. Rate limit: 20/5 min por IP (compartido con `/interpretar`).
**402** sin premium.

### `POST /api/v1/pantry/foto-nevera` 🔒 ⭐ Premium ✅ Implementado (backend)
Gemini Vision analiza una foto de la nevera e identifica ingredientes visibles. Devuelve propuesta
de alimentos detectados + sugerencias de recetas express (IA pasiva — usuario confirma antes de guardar).
**Body** (`FotoNeveraRequest`): `{ "imagen_base64": "<JPEG en base64>", "fecha_referencia": "..." }`
**200** → `FotoNeveraResponse` `{ alimentos[], recetas_sugeridas[], mensaje }`.
Rate limit: 10/hora por IP. Requiere `GEMINI_API_KEY`. **402** sin premium.

### `GET /api/v1/onboarding` 🔒 ✅ Implementado
Devuelve el perfil del hogar. **404** si aún no ha completado el onboarding.
**200** → `PerfilHogarResponse`.

### `POST /api/v1/onboarding` 🔒 ✅ Implementado
Guarda (upsert) el perfil inicial del hogar para personalizar las recetas. `hogar_id` del JWT.
**Body** (`OnboardingRequest`):
```json
{
  "gustos_culinarios": ["Arroces", "Pescado"],
  "num_comensales": 4
}
```
**200** → `PerfilHogarResponse`. Idempotente (upsert), `extra='forbid'`.
**Nota RGPD:** esta iteración guarda SOLO datos no sensibles. Las intolerancias/alergias
(datos de salud, art. 9) se posponen a una iteración con consentimiento explícito dedicado;
el `extra='forbid'` rechaza esos campos si llegan por error.

---

---

## Panel de Administración (Fase 2)

> Rutas exclusivas del super-admin. Usan un JWT firmado con **`ADMIN_JWT_SECRET_KEY`**, secreto
> independiente del JWT de familias. Los tokens de familia NO sirven aquí (→ 401) y viceversa.
> Autenticación: Bearer JWT admin en cabecera `Authorization: Bearer <admin_token>`.

### Bootstrap y Login

#### `POST /api/v1/admin/auth/bootstrap`
Crea el **primer** usuario administrador. Solo funciona si `ADMIN_BOOTSTRAP_TOKEN` está definido en
el servidor y no existe todavía ningún admin.

**Body** (`AdminBootstrapRequest`):
```json
{
  "email": "admin@ejemplo.com",
  "password": "min_8_caracteres",
  "nombre": "Admin",
  "bootstrap_token": "<ADMIN_BOOTSTRAP_TOKEN del servidor>"
}
```
**200** → `AdminTokenResponse` (token + info admin) · **401** token incorrecto · **409** ya existe un admin · **501** variable de entorno no configurada.

#### `POST /api/v1/admin/auth/login`
Inicia sesión con las credenciales del admin.

**Body** (`AdminLoginRequest`): `{ "email": "...", "password": "..." }`
**200** → `AdminTokenResponse` · **401** credenciales incorrectas · **503** `ADMIN_JWT_SECRET_KEY` no configurada.

---

### Prompts dinámicos 🔑

> La `system_instruction` editada por el admin **nunca** puede suprimir `_FILOSOFIA_MEDITERRANEA`;
> el servidor la añade siempre al final (guard no-removible en `PromptConfigService`).
> Los cambios activos se aplican en ≤ 5 minutos (caché TTL).

#### `GET /api/v1/admin/prompts` 🔑
Lista todos los templates de prompt guardados en BD.
**200** → `list[PromptTemplateResponse]`.

#### `GET /api/v1/admin/prompts/{clave}` 🔑
Devuelve el template identificado por su clave (p.ej. `"recetas"`, `"plan_comidas"`).
**200** → `PromptTemplateResponse` · **404** clave inexistente.

#### `PATCH /api/v1/admin/prompts/{clave}` 🔑
Upsert (crea o actualiza) un template. Incrementa `version` en cada PATCH e invalida la caché.

**Body** (`PromptTemplateUpdate`, al menos un campo requerido):
```json
{
  "system_instruction": "Eres el chef asistente...",  // mín. 10 caracteres
  "activo": true
}
```
**200** → `PromptTemplateResponse` actualizado · **400** cuerpo vacío · **401** sin token admin.

**Claves usadas por el sistema:** `recetas`, `plan_comidas`.

---

### Recetario Maestro 🔑

> Catálogo global de recetas de referencia (sin `hogar_id`). Hard delete (no hay datos personales).

#### `GET /api/v1/admin/recetario` 🔑
Lista recetas maestras. Parámetro opcional: `activa_only=true`.
**200** → `list[RecetaMaestraResponse]`.

#### `POST /api/v1/admin/recetario` 🔑
Crea una nueva receta maestra.

**Body** (`RecetaMaestraCreate`):
```json
{
  "nombre": "Paella valenciana",       // 2-200, único
  "ingredientes": ["arroz", "pollo"],  // lista no vacía
  "pasos": ["Sofreír...", "Añadir..."],// lista no vacía
  "categoria": "Arroces",              // 2-50
  "temporada": "verano",               // opcional
  "aprovechamiento": false
}
```
**201** → `RecetaMaestraResponse` · **422** validación.

#### `GET /api/v1/admin/recetario/{receta_id}` 🔑
**200** → `RecetaMaestraResponse` · **404** no encontrada.

#### `PATCH /api/v1/admin/recetario/{receta_id}` 🔑
Actualización parcial (`RecetaMaestraUpdate`, todos los campos opcionales).
**200** → `RecetaMaestraResponse` actualizado · **400** cuerpo vacío · **404** no encontrada.

#### `DELETE /api/v1/admin/recetario/{receta_id}` 🔑
Elimina la receta de forma definitiva (hard delete — sin datos personales).
**200** → `{ "success": true }` · **404** no encontrada.

---

## Salud (sin prefijo, sin auth)

- `GET /health` → `{ "status": "ok", ... }`
- `GET /` → mensaje de bienvenida

---

🔒 = requiere `Authorization: Bearer <token>` (JWT de familia).
🔑 = requiere `Authorization: Bearer <admin_token>` (JWT de admin, secreto independiente).
