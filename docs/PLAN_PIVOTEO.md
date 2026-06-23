# Plan de Pivoteo — AsistenteHogar
> Versión 1.0 · 2026-06-23 · Aprobado por el fundador

## Nuevo propósito
**De:** "App de cocina familiar con recetas mediterráneas"
**A:** "Deja de tirar comida. Ahorra dinero. Marce cocina con lo que tienes."

La cocina es el mecanismo. El ahorro real en euros es el producto.

---

## Decisiones de producto aprobadas

| Decisión | Antes | Después |
|---|---|---|
| OCR de ticket | Premium | **Gratis** |
| Foto-nevera | Premium | **Gratis** |
| Voz al chef (`/pantry/audio`) | Premium | **Gratis** |
| Interpretar texto (`/pantry/interpretar`) | Premium | **Gratis** |
| Chef Marce chat (free) | 5/día | **10/día** |
| Informe de Ahorro mensual | No existía | **Premium** (North Star) |
| Plan semanal 7 días | Premium | Premium (sin cambio) |
| Multi-perfil familia | Premium | Premium (sin cambio) |
| B2B supermercados | — | Post-lanzamiento |

**North Star Metric:** € ahorrados / mes por hogar activo
**Cálculo:** Precio real (tickets parseados) × ingredientes usados en recetas cocinadas

---

## Fases

### FASE 0 — Legal (paralelo a todo, semana 1)
*Acciones del fundador, no de código*

- [ ] **B1 CRÍTICO**: Activar billing en Google Cloud / Vertex AI. Aceptar el Cloud DPA.
  - URL: console.cloud.google.com → Billing → Link a proyecto Gemini
  - Sin esto no se puede lanzar legalmente.
- [ ] **B4**: Añadir en T&S: "Servicio dirigido a mayores de 14 años."
- [ ] **B5**: Redactar Política de Privacidad (art. 13 RGPD).
- [ ] **B6**: Redactar Términos de Servicio con info precontractual LGDCU.
- [ ] **B7**: Actualizar PaywallScreen con precio+IVA, renovación automática, checkbox desistimiento.
- [ ] **B8**: Añadir sección "Información Legal" en la app (LSSI art. 10: nombre, NIF, domicilio).
- [ ] **B2**: Iniciar documento DPIA (plantilla disponible en AEPD.es).
- [ ] **B3**: Implementar consentimientos granulares en onboarding (código — ver Fase 1).

---

### FASE 1 — Inversión del gate (semana 1, ~3 días)
*El cambio estructural más importante. Bajo riesgo, alto impacto.*

**Backend (`backend/app/`):**
- Eliminar `Depends(requiere_premium)` de:
  - `POST /pantry/ocr-ticket`
  - `POST /pantry/foto-nevera`
  - `POST /pantry/audio`
  - `POST /pantry/interpretar`
  - `POST /pantry/sugerir-metadata`
- Cambiar `CHEF_FREE_DAILY_LIMIT` de `5` a `10` en `core/config.py`
- Mantener gateados: `/pantry/recetas` (IA avanzada), `/pantry/plan-comidas`

**Frontend (`frontend/src/`):**
- Eliminar navegación a `PaywallScreen` en flujos de OCR, foto, voz
- Actualizar `PaywallScreen`: nueva propuesta de valor premium
  - "Marce sin límites · Plan semanal · Informe de Ahorro mensual · Multi-perfil"
- Actualizar onboarding: nuevo copy anti-desperdicio
- Actualizar `DashboardScreen`: nuevo briefing orientado a ahorro/caducidades

**Criterio de aceptación:** `ts:check` 0 errores · 13/13 smoke tests · flujos OCR/foto/voz funcionan sin suscripción.

---

### FASE 2 — Parser de ticket Mercadona PDF (semanas 2-3, ~5 días)
*El mayor vector de onboarding sin fricción. Cubre 27% del mercado español.*

**Flujo UX:**
```
Usuario recibe email de Mercadona → reenvía a tickets@asistente-hogar.app
  O bien: abre la app → "Importar ticket" → selecciona PDF desde galería/Files
→ Backend parsea PDF → extrae: nombre producto, cantidad, precio unitario, fecha
→ Propone lista de alimentos para añadir a la despensa (pantalla de confirmación)
→ Usuario confirma/ajusta → stock poblado + precios guardados en ledger
```

**Backend:**
- Nuevo endpoint `POST /pantry/ticket/pdf` (multipart/form-data, archivo PDF)
- Nuevo servicio `TicketParserService`:
  - Gemini Flash (visión) para extraer tabla de productos del PDF
  - Normalización: nombre → categoría, unidad estándar
  - Output: lista de `{nombre, cantidad, unidad, precio_unitario, fecha_compra}`
- Migración Alembic: añadir `precio_unitario` (Numeric, nullable) y `fecha_compra` a `movimientos_despensa`
- Sin gate premium (es el motor de retención free)

**Frontend:**
- Nuevo botón "Importar ticket" en `PantryScreen` (junto a "Añadir" y "Foto-nevera")
- `TicketImportScreen`: selección de PDF + pantalla de confirmación de productos detectados
- Estado de carga con skeleton mientras Gemini procesa

**Criterio de aceptación:** PDF real de Mercadona → ≥80% de productos reconocidos correctamente · precio unitario capturado en ≥70% de líneas.

---

### FASE 3 — AhorroService + Informe de Ahorro (semanas 3-5, ~6 días)
*La nueva North Star feature. La razón por la que la gente paga premium.*

**Lógica de cálculo:**
```
Ahorro real del mes =
  Σ (recetas_cocinadas_con_stock_existente × coste_medio_ingredientes_del_hogar)

  Donde coste_medio_ingrediente =
    precio promedio de las últimas N compras de ese ingrediente
    (de los tickets parseados en movimientos_despensa)

  vs. "media española de desperdicio" =
    referencia: 31 kg/persona/año (dato oficial MAPA 2024)
    → calculado como % de reducción respecto a esa media
```

**Backend:**
- Nuevo servicio `AhorroService`:
  - `calcular_ahorro_mes(hogar_id, mes)` → `AhorroResumenSchema`
  - `AhorroResumenSchema`: tickets analizados, gasto total, ahorro calculado (€), kg desperdicio evitado, % vs. media española
- Nuevo endpoint `GET /ahorro/resumen` (query param `?mes=YYYY-MM`) — **gateado premium**
- Nuevo endpoint `GET /ahorro/resumen/preview` (último mes, sin detalle) — **gratis**, para motivar upsell

**Frontend:**
- Nueva pestaña "Ahorro" en la navegación principal (o sección en Dashboard para free con preview)
- `AhorroScreen` (premium): informe completo con gráfico mensual
- `AhorroPreviewCard` (free, en Dashboard): "Este mes has ahorrado ~X€ estimado · Ver informe completo →"
- Tarjeta sharable para TikTok/Instagram (extiende el patrón `ShareRecipeCard`)

**Criterio de aceptación:** Con ≥3 tickets importados y ≥5 recetas cocinadas, el cálculo es coherente y no produce valores negativos ni absurdos.

---

### FASE 4 — Reposicionamiento de onboarding y copy (semana 4-5, ~2 días)
*Cambio de narrativa. Sin tocar arquitectura.*

**Cambios:**
- `OnboardingScreen`: nuevo mensaje de bienvenida
  - Antes: "Tu asistente de cocina familiar"
  - Después: "Deja de tirar comida. Marce cocina con lo que tienes y te dice cuánto ahorras."
- `DashboardScreen` briefing: priorizar alertas de caducidad + "hoy puedes cocinar con X ingredientes que caducan pronto"
- `PaywallScreen`: nueva propuesta de valor centrada en el Informe de Ahorro €
- App Store / Play Store metadata (ASO): nuevas keywords y descripción orientadas a ahorro y anti-desperdicio
- Screenshot de stores: mostrar el Informe de Ahorro como primera captura

---

### FASE 5 — Stock probabilístico (semana 5-6, mejora continua)
*Evita que el inventario "se pudra" sin mantenimiento del usuario.*

**Concepto:** El stock nunca está "mal". Está "estimado con confianza". Cuando la confianza baja, Marce pregunta.

**Backend:**
- Evolucionar el modelo de `incierto` y `ultima_confirmacion` (ya implementados):
  - Calcular `confianza_stock` (0-100) por alimento = función de días desde última confirmación, cadencia media de consumo del hogar (del ledger), y señales de actividad reciente
  - Nuevo job en `purge.py`: degradación diaria de confianza para alimentos sin movimiento
- Nuevo trigger en `/chef/chat`: cuando Marce va a sugerir una receta con ingredientes de baja confianza, devuelve micro-pregunta: `{"confirmar_stock": ["calabacín", "tomate"]}` antes de la receta
- Frontend: `ConfirmarStockCard` en el chat (respuesta rápida Sí/No/Ya no tengo)

---

## Timeline estimado

```
SEMANA 1    Fase 0 (legal, fundador) + Fase 1 (gate inversion, código)
SEMANA 2    Fase 2 — Backend parser PDF
SEMANA 3    Fase 2 — Frontend import ticket + Fase 2 integración
SEMANA 4    Fase 3 — AhorroService backend
SEMANA 5    Fase 3 — AhorroScreen frontend + Fase 4 copy
SEMANA 6    Fase 5 + QA completo + beta TestFlight/Play Beta
SEMANA 7+   Lanzamiento público + campaña TikTok
```

## Archivos clave a modificar

| Fase | Archivo | Cambio |
|---|---|---|
| 1 | `backend/app/api/routers/pantry.py` | Eliminar 5 `Depends(requiere_premium)` |
| 1 | `backend/app/core/config.py` | `CHEF_FREE_DAILY_LIMIT` 5→10 |
| 1 | `frontend/src/screens/PaywallScreen.tsx` | Nueva propuesta de valor |
| 2 | `backend/app/api/routers/pantry.py` | Nuevo endpoint `/pantry/ticket/pdf` |
| 2 | `backend/app/services/ticket_parser.py` | Nuevo servicio (Gemini PDF) |
| 2 | `backend/alembic/versions/` | Migración `precio_unitario` en ledger |
| 3 | `backend/app/services/ahorro.py` | Nuevo `AhorroService` |
| 3 | `backend/app/api/routers/ahorro.py` | Nuevo router |
| 3 | `frontend/src/screens/AhorroScreen.tsx` | Nueva pantalla premium |
| 4 | `frontend/src/screens/OnboardingScreen.tsx` | Nuevo copy |
| 4 | `frontend/src/screens/DashboardScreen.tsx` | Briefing anti-desperdicio |
