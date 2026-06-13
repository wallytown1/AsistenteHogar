# Referencia de la API — Asistente del Hogar IA

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
y todos sus datos vinculados (usuarios, despensa, tareas, eventos — incluidos los
soft-deleted). RGPD art. 17 + App Store 5.1.1(v) / Google Play. Irreversible.
Requiere re-autenticación con la contraseña actual (un token activo no basta).
Deja evidencia agregada sin datos personales en `registros_borrado`.
Rate limit: 5 intentos/hora por IP.

**Body** (`CuentaEliminarRequest`): `{ "password": "contrasena_actual" }`
**200** → `{ "success": true, "message": "Cuenta y datos del hogar eliminados permanentemente." }` · **401** token inválido o contraseña incorrecta (la cuenta no se borra) · **422** validación · **429** rate limit.

---

## Dashboard

### `GET /api/v1/dashboard` 🔒
Estado unificado del hogar para hoy. Orquesta despensa, calendario y tareas de
forma concurrente, filtra eventos/conflictos a **hoy (UTC)** y tareas a estado
**pendiente**, y genera el briefing con Gemini (o un fallback estático sin API key).

**200** → `DashboardUnifiedContext`:
```json
{
  "fecha": "2026-06-12",
  "eventos_hoy": [ /* EventoCalendarioResponse */ ],
  "alertas_despensa": { "porcentaje_stock": 80.0, "items_disponibles": 5, "alertas_caducidad": [], "items": [] },
  "tareas_pendientes": [ /* TareaHogarOut */ ],
  "conflictos_agenda": [ /* ConflictoDetalle */ ],
  "briefing_texto": "Buenos días...",
  "briefing_generado_por_ia": false
}
```

`briefing_generado_por_ia` es `true` solo cuando el texto proviene del modelo
(obliga al cliente a mostrar el aviso de transparencia de IA); `false` con el
fallback estático. Los nombres de la familia se anonimizan (`Familiar_N`) antes
de enviarse a Gemini y se restauran en la respuesta.

---

## Despensa (Pantry)

### `GET /api/v1/pantry` 🔒
Inventario activo y métricas de stock.
**200** → `PantryStockMetrics` `{ porcentaje_stock, items_disponibles, alertas_caducidad[], items[] }`.
`alertas_caducidad` incluye los alimentos que caducan en ≤6 días.

### `GET /api/v1/pantry/recetas` 🔒
Sugerencias de recetas por IA a partir del inventario (prioriza lo que caduca).
IA pasiva: solo sugiere. Sin API key devuelve lista vacía con mensaje.
**200** → `RecetasSugeridasResponse` `{ recetas[], generado_por_ia, mensaje }`.

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

---

## Calendario

### `GET /api/v1/calendar` 🔒
Agenda activa y detección de solapamientos.
**200** → `CalendarAgendaResponse` `{ eventos[], conflictos[] }`.

### `POST /api/v1/calendar` 🔒
**Body** (`EventoCalendarioCreate`):
```json
{
  "titulo": "Reunión Escolar",  // 2-200
  "descripcion": "...",          // opcional
  "fecha_inicio": "2026-06-12T10:00:00+00:00",
  "fecha_fin": "2026-06-12T11:30:00+00:00",  // debe ser > fecha_inicio
  "participantes": ["Papá", "Mamá"]           // opcional
}
```
**201** → `EventoCalendarioResponse` · **422** validación (incl. `fecha_fin <= fecha_inicio`).

### `POST /api/v1/calendar/interpretar` 🔒
Interpreta lenguaje natural y devuelve una **propuesta** de evento (IA pasiva:
nunca lo crea; el cliente confirma y llama a `POST /calendar`).

**Body** (`InterpretarEventoRequest`):
```json
{ "texto": "dentista mañana a las 10 con papá", "fecha_referencia": "2026-06-12T08:00:00+00:00" }
```
**200** → `InterpretarEventoResponse` `{ evento, mensaje }` (`evento` es null si no se pudo interpretar o sin API key).

### `PATCH /api/v1/calendar/{evento_id}` 🔒
Actualización parcial (`EventoCalendarioUpdate`, campos opcionales).
**200** → evento actualizado · **400** sin cuerpo · **404** inexistente/ajeno · **422** validación.

### `DELETE /api/v1/calendar/{evento_id}` 🔒
Borrado lógico.
**200** → evento borrado · **404** inexistente/ajeno.

---

## Tareas

### `GET /api/v1/tasks` 🔒
**200** → `List[TareaHogarOut]` (lista directa, sin envoltura).

### `POST /api/v1/tasks` 🔒
**Body** (`TareaHogarIn`):
```json
{
  "nombre": "Sacar la basura",  // 2-200
  "asignado_a": "Ana",           // opcional, ≤100
  "frecuencia": "diaria",        // 2-50
  "prioridad": "alta",           // alta | media | baja (default: media)
  "estado": "pendiente"          // pendiente | completado (default: pendiente)
}
```
**201** → `TareaHogarOut` · **422** validación (prioridad/estado inválidos).

### `PATCH /api/v1/tasks/{tarea_id}` 🔒
Actualización parcial (`TareaHogarUpdate`). Uso típico: cambiar `estado` o `prioridad`.
**200** → tarea actualizada · **400** sin cuerpo · **404** inexistente/ajeno · **422** validación.

### `DELETE /api/v1/tasks/{tarea_id}` 🔒
Borrado lógico.
**200** → tarea borrada · **404** inexistente/ajeno.

---

## Salud (sin prefijo, sin auth)

- `GET /health` → `{ "status": "ok", ... }`
- `GET /` → mensaje de bienvenida

---

🔒 = requiere `Authorization: Bearer <token>`.
