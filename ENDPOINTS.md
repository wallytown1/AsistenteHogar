# Referencia de la API — Asistente del Hogar IA

> **Pivote 2 (2026-06-18):** la app es **exclusivamente comida, stock y recetas mediterráneas españolas**.
> Los módulos Eventos (calendario) y Tareas (domésticas) fueron **eliminados por completo**.
> Ver `01_CONTEXTO_Y_ARQUITECTURA_APP.md`.

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

### `POST /api/v1/auth/logout` 🔒
Invalida el token actual en el servidor (JTI blocklist en Redis, TTL = tiempo restante del token).
El cliente debe descartar el token localmente. Cualquier petición posterior con ese token devuelve 401
aunque el token no haya expirado. Los tokens de otros dispositivos no se ven afectados.
**200** → `LogoutResponse` `{ "success": true, "message": "Sesión cerrada correctamente." }` · **401** token ya revocado o inválido.

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

### `GET /api/v1/pantry/recetas/basicas` 🔒 `[FREE]`
Catálogo estático de recetas del recetario maestro, sin IA. Disponible en todos los tiers.
**200** → `RecetasSugeridasResponse` `{ recetas[], generado_por_ia: false, mensaje }`.

### `GET /api/v1/pantry/recetas` 🔒 `[PREMIUM+]`
Sugerencias de recetas por IA a partir del inventario (prioriza lo que caduca).
IA pasiva: solo sugiere. Sin API key devuelve lista vacía con mensaje.
**200** → `RecetasSugeridasResponse` `{ recetas[], generado_por_ia, mensaje }`.
Rate limit: 20/hora por IP (**429** al exceder). Cacheado 1 h.
**402** si el tier del usuario es `free`.

### `GET /api/v1/pantry/plan-comidas` 🔒 `[FAMILIA]`
Plan de comidas semanal (comida + cena, 7 días) por IA a partir de la despensa,
priorizando lo que caduca. IA pasiva: solo sugiere.
**200** → `PlanComidasResponse` `{ dias[] {dia, comida, cena}, generado_por_ia, mensaje }`.
Rate limit: 10/hora por IP. Cacheado 2 h.
**402** si el tier del usuario es `free` o `premium`.

### `GET /api/v1/pantry/sugerencias` 🔒 `[FAMILIA]`
Combo: recetas IA + plan de comidas en una sola llamada (`asyncio.gather`). Devuelve ambos.
**200** → `SugerenciasResponse` `{ recetas: RecetasSugeridasResponse, plan_comidas: PlanComidasResponse }`.
Rate limit: comparte límites de `/pantry/recetas` (20/h) y `/pantry/plan-comidas` (10/h).
**402** si el tier del usuario es `free` o `premium`.

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

### `POST /api/v1/pantry/{alimento_id}/agotar` 🔒
"Se acabó" de un toque: borrado lógico + movimiento `consumo` con origen `agotado` en el ledger.
**200** → item borrado · **404** inexistente/ajeno.

### `POST /api/v1/pantry/{alimento_id}/confirmar` 🔒
"Sigo teniéndolo": resetea `ultima_confirmacion` a ahora → renueva la confianza y el alimento deja de
estar `incierto`. **200** → item actualizado · **404** inexistente/ajeno.

### `POST /api/v1/pantry/{alimento_id}/restaurar` 🔒
Undo de un agotado o descuento del chef: reactiva el alimento (`is_deleted = false`) y registra un
movimiento de compensación (`tipo='compra'`, `origen='undo'`) en el ledger. Requiere que el ítem esté
en estado soft-deleted y pertenezca al hogar.
**200** → `InventarioAlimentoResponse` · **404** ítem no encontrado en soft-deleted de este hogar.

> **Stock como hipótesis:** `InventarioAlimentoResponse` incluye `incierto: bool` (calculado en
> `GET /pantry`): true cuando el alimento tiene cadencia de compra conocida (≥2 compras en el ledger) y
> han pasado ≥ sus días de cadencia media desde `ultima_confirmacion` (probablemente ya se consumió).

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

## Perfiles individuales de miembros del hogar (Fase 3)

> Preferencias culinarias por persona dentro del hogar. Las recetas y el plan de comidas las tienen en
> cuenta automáticamente. **No almacenar datos de salud** (alergias/intolerancias médicas son
> datos especiales RGPD art. 9 y se rechazan por `extra='forbid'`).
> Límite: 10 perfiles por hogar. Soft delete. `hogar_id` siempre del JWT.

### `GET /api/v1/perfiles` 🔒
Lista los perfiles activos del hogar ordenados por fecha de creación.
**200** → `list[PerfilIndividualResponse]` (vacío si no hay perfiles).

### `POST /api/v1/perfiles` 🔒 `[FAMILIA]`
Crea un nuevo perfil individual. Requiere tier Familia (402 si premium o free).

**Body** (`PerfilIndividualCreate`):
```json
{
  "nombre": "Mamá",                        // 1-100 caracteres, requerido
  "preferencias_dieta": ["vegetariana"],   // lista de strings, max 100 chars/item
  "excluir_ingredientes": ["cilantro"]     // lista de strings, max 100 chars/item
}
```
**201** → `PerfilIndividualResponse` · **422** nombre vacío / item >100 chars / campo extra / límite 10 alcanzado.

### `GET /api/v1/perfiles/{perfil_id}` 🔒
**200** → `PerfilIndividualResponse` · **404** inexistente o de otro hogar · **422** ID no-UUID.

### `PATCH /api/v1/perfiles/{perfil_id}` 🔒
Actualización parcial (todos los campos opcionales).

**Body** (`PerfilIndividualUpdate`): mismos campos que `Create`, todos opcionales.
**200** → `PerfilIndividualResponse` · **404** inexistente o ajeno · **422** validación.

### `DELETE /api/v1/perfiles/{perfil_id}` 🔒
Borrado lógico (`is_deleted = true`). Las preferencias dejan de influir en las recetas.
**204** sin cuerpo · **404** inexistente o ajeno.

---

## Ajuste de perfil al rechazar ingrediente (Fase 4b)

### `POST /api/v1/pantry/recetas/rechazar-ingrediente` 🔒
Identifica los ingredientes problemáticos de una receta rechazada (vía Gemini structured output)
y los añade a `excluir_ingredientes` del perfil individual indicado.
Escritura de **bajo riesgo y reversible**: el frontend ofrece undo visible.
`perfil_id` debe pertenecer al hogar del JWT (→ **404** si no).
Sin API key, devuelve respuesta vacía (`ingredientes_anadidos=[]`, `generado_por_ia=false`) sin error.

**Body** (`RechazarIngredienteRequest`):
```json
{
  "nombre_receta": "Tortilla de bacalao",
  "ingredientes_receta": ["bacalao", "huevos", "patatas"],
  "perfil_id": "uuid-del-perfil"
}
```
**200** → `RechazarIngredienteResponse`:
```json
{
  "perfil_id": "uuid-del-perfil",
  "nombre_perfil": "Ana",
  "ingredientes_anadidos": ["bacalao"],
  "excluir_ingredientes_actualizado": ["cilantro", "bacalao"],
  "generado_por_ia": true,
  "mensaje": null
}
```
Si la IA no identifica ingredientes: `ingredientes_anadidos=[]`, `generado_por_ia=false`, `mensaje="No se identificaron ingredientes problemáticos."`. No escribe en BD.
**404** perfil inexistente o de otro hogar · **422** validación.

> **Historial con valoración:** `POST /api/v1/pantry/recetas/historial` acepta además
> `valoracion` (`me_encanto`|`gusto`|`no_me_gusto`, opcional) y `categoria` (opcional). La valoración
> alimenta la memoria de gustos y pondera el aprendizaje (lo que encantó refuerza el estilo; lo
> rechazado o "no me gustó" se excluye).

---

## Chef conversacional 🔒

### `POST /api/v1/chef/chat` 🔒 `[PREMIUM+]`
Conversa con el chef del hogar ("Marce"). Responde con voz cálida y cercana, fundamentado en la
despensa real + memoria de gustos destilada + perfiles del hogar. Rate limit 30/5 min.

**Privacidad:** el servidor **NO persiste el texto del chat**. El cliente reenvía los turnos
recientes en cada petición; la continuidad de largo plazo vive en la memoria de gustos (solo datos
gastronómicos). Cada mensaje de usuario se sanea (anti prompt-injection) antes de ir a Gemini.

**Body** (`ChefChatRequest`) — el último mensaje debe ser del usuario:
```json
{
  "mensajes": [
    { "rol": "usuario", "texto": "tengo huevos y patatas" },
    { "rol": "chef", "texto": "podríamos hacer una tortilla" },
    { "rol": "usuario", "texto": "algo más rápido?" }
  ]
}
```
**200** → `ChefChatResponse`:
```json
{ "respuesta": "Te propongo unos huevos rotos...", "generado_por_ia": true, "mensaje": null }
```
Sin `GEMINI_API_KEY`: `respuesta=""`, `generado_por_ia=false`, `mensaje` de contingencia.
**422** validación (mensajes vacíos, último no-usuario, rol inválido, texto > 1000 chars) · **403** sin tier premium · **429** rate limit.

---

## Lista de la Compra 🔒

### `GET /api/v1/lista-compra` 🔒
Devuelve todos los ítems de la lista del hogar (no eliminados). Orden: pendientes primero, luego comprados; dentro de cada grupo por `created_at` ascendente.

**200** → `list[ListaCompraItemResponse]`

### `GET /api/v1/lista-compra/sugerencias` 🔒
Sugerencias inteligentes de reposición a partir del **ledger de movimientos** (`movimientos_despensa`):
para cada alimento con ≥2 compras, si han pasado al menos sus días de cadencia media desde la última
compra y NO está ya en la despensa ni en la lista, se sugiere. 100% SQL (sin IA), todos los tiers.

**200** → `list[SugerenciaCompra]`:
```json
[
  { "nombre": "leche", "cantidad_habitual": 2.0, "unidad": "litro",
    "motivo": "Sueles comprarla cada ~5 días (hace 7)." }
]
```
Lista vacía si no hay histórico suficiente.

### `POST /api/v1/lista-compra` 🔒
Añade un ítem a la lista.

**Body** (`ListaCompraItemCreate`):
```json
{ "nombre": "Aceite de oliva virgen extra", "cantidad": 1, "unidad": "botella" }
```
`cantidad` y `unidad` son opcionales. **201** → `ListaCompraItemResponse` · **422** validación.

### `PATCH /api/v1/lista-compra/{item_id}` 🔒
Actualiza un ítem: marcar/desmarcar como comprado o editar nombre/cantidad.

**Body** (`ListaCompraItemUpdate`, todos opcionales):
```json
{ "is_checked": true }
```
**200** → `ListaCompraItemResponse` · **404** ítem inexistente o de otro hogar.

### `DELETE /api/v1/lista-compra/{item_id}` 🔒
Elimina un ítem (soft delete). **204** · **404** ítem inexistente o de otro hogar.

### `DELETE /api/v1/lista-compra` 🔒
Elimina en bloque todos los ítems marcados como comprados (`is_checked=true`) del hogar. **204**.

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
Inicia sesión con las credenciales del admin. Además del token en el cuerpo (compatibilidad con
clientes API / tests por `Authorization: Bearer`), pone una **cookie `admin_token` HttpOnly** (en
producción `Secure; SameSite=None` por ser cross-site Vercel↔Railway) que el panel usa como sesión.

**Body** (`AdminLoginRequest`): `{ "email": "...", "password": "..." }`
**200** → `AdminTokenResponse` (+ `Set-Cookie`) · **401** credenciales incorrectas · **503** `ADMIN_JWT_SECRET_KEY` no configurada.

#### `POST /api/v1/admin/auth/logout` 🔑
Cierra la sesión de admin: revoca el `jti` del token en el blocklist (un token revocado da 401 en
cualquier ruta admin aunque no haya expirado) y borra la cookie HttpOnly.
**200** → `LogoutResponse`.

---

### Prompts dinámicos 🔑

> Las **mutaciones** admin (`PATCH /admin/prompts/*`, `POST|PATCH|DELETE /admin/recetario/*`) exigen
> la cabecera CSRF `X-Admin-Request: 1` (defensa double-submit por cabecera personalizada, dado que
> la sesión viaja en cookie). Sin ella → **403**.

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

## Webhooks

### `POST /api/v1/webhooks/revenuecat` (sin auth de usuario)
Recibe eventos de suscripción de RevenueCat e invalida el cache de tier en Redis para que
la siguiente petición del usuario re-consulte el tier real (sin esperar el TTL de 5 min).
Autenticación: `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`.
Sin `REVENUECAT_WEBHOOK_SECRET` configurado → **501**.
Firma incorrecta → **401**.
Eventos procesados: `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION`,
`EXPIRATION`, `BILLING_ISSUE`, `SUBSCRIBER_ALIAS`. Otros eventos → ignorados (200 `action: ignored`).
**200** → `{ "ok": true, "action": "cache_invalidated", "event_type": "RENEWAL" }`.
Configurar en RC: Integrations → Webhooks → URL: `https://asistentehogar-production.up.railway.app/api/v1/webhooks/revenuecat`.

---

## Salud (sin prefijo, sin auth)

- `GET /health` → `{ "status": "ok", ... }`
- `GET /` → mensaje de bienvenida

---

🔒 = requiere `Authorization: Bearer <token>` (JWT de familia).
🔑 = requiere `Authorization: Bearer <admin_token>` (JWT de admin, secreto independiente).
