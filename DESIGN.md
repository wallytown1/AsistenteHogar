# DESIGN.md — Asistente del Hogar IA
## Estética "Tierra Cálida Mediterránea"

> Síntesis de referentes reales: **Mastercard** (warm cream canvas) + **Airbnb** (photography-led, soft shapes) + **Notion** (warm minimalism, editorial). No recrear: adaptar el espíritu a una app de cocina española familiar.

---

## Filosofía visual

- **Cálido, nunca estéril.** Crema en lugar de blanco frío. Marrón oscuro en lugar de negro puro.
- **La comida es protagonista.** Tipografía e iconografía en silencio; imágenes y colores de ingredientes al frente.
- **Editorial, no SaaS.** Espaciado generoso, sin grids rígidos de dashboard corporativo.
- **Un solo acento.** El color `brand` aparece solo en acciones primarias (botones, FAB, tabs activos). No decorar con él.
- **Sin sombras duras.** Elevación suave (spread ≥ 14px, opacidad ≤ 8%). El 90 % de las superficies son planas.

---

## Paleta de color

### React Native tokens (`src/theme/tokens.ts`)

| Token | Hex | Referente | Uso |
|-------|-----|-----------|-----|
| `brand` | `#8B5E3C` | Clay Brown (Mastercard) | Botones primarios, FAB, tabs activos |
| `brandDark` | `#6B4429` | — | Estado pressed |
| `brandSoft` | `#F6EDE3` | — | Fondos de chips, banners suaves |
| `bg` | `#FAF7F2` | Canvas Cream `#F3F0EE` (Mastercard) | Fondo de pantalla |
| `card` | `#FFFDF8` | Lifted Cream `#FCFBFA` (Mastercard) | Superficies elevadas |
| `cardAlt` | `#F9F4EC` | Surface `#f6f5f4` (Notion) | Tarjetas secundarias |
| `ink` | `#2C1C0E` | Ink Black `#141413` (Mastercard) | Texto principal |
| `inkMuted` | `#7A6045` | Charcoal `#37352f` (Notion) | Texto secundario |
| `inkFaint` | `#AE9B87` | Dust Taupe `#D1CDC7` (Mastercard) | Placeholders, labels |
| `border` | `#EAE0D3` | Hairline `#dddddd` (Airbnb) | Separadores |
| `pantry` | `#8B5E3C` | Clay Brown (Mastercard) | Módulo despensa (unificado con la marca) |
| `tasks` | `#C8783A` | Signal Orange `#CF4500` (Mastercard) | Tareas (terracota apagado, único acento diferenciado) |
| `success` | `#5C8B68` | — | Verde salvia: SOLO en semáforo "fresco" |
| `danger` | `#B84B2D` | Error `#c13515` (Airbnb) | Caducados, errores |

### Regla de caducidad (semáforo)

```ts
// lib/caducidad.ts
> 6 días  → colors.success  '#5C8B68'  (verde salvia)
4–6 días  → colors.warning  '#C8783A'  (ámbar arcilla)
≤ 3 días  → colors.danger   '#B84B2D'  (rojo terracota)
caducado  → colors.danger   '#B84B2D'  etiqueta "Caducado"
```

---

## Tipografía

Stack: `System` (SF Pro en iOS, Roboto en Android). No Inter, no Space Grotesk (sobreutilizados por IA).

| Token | Tamaño | Peso | Uso |
|-------|--------|------|-----|
| `display` | 28 / 800 | Héroe de pantalla (nombre del plato) |
| `title` | 22 / 800 | Título de sección |
| `h2` | 17 / 700 | Subtítulos de tarjeta |
| `body` | 15 / 500 | Texto corriente |
| `label` | 11 / 800 + uppercase | Eyebrows, categorías |

Regla: máximo 4 tamaños visibles en pantalla. Nunca 3 pesos distintos en la misma vista.

---

## Radios (`radius`)

Inspirado en Mastercard (soft, oversized): sin esquinas duras en ningún elemento interactivo.

| Token | px | Uso |
|-------|----|-----|
| `sm` | 12 | Inputs, badges pequeños |
| `md` | 16 | Tarjetas estándar |
| `lg` | 20 | Tarjetas hero, modales |
| `xl` | 24 | Banners grandes |
| `pill` | 999 | Chips, botones de filtro |

---

## Sombras

Siempre warm-tinted (marrón, nunca azul frío):
- **card**: `shadowColor: '#3D2B1A'`, opacity `0.07`, radius `14`, offset `{0, 6}`
- **fab**: `shadowColor: '#8B5E3C'` (brand), opacity `0.28`, radius `12`, offset `{0, 8}`
- Android: elevation 2 (card) / 6 (fab)

---

## Iconografía

- Vectoriales via `@expo/vector-icons` (Ionicons + MaterialCommunityIcons)
- FoodIcon para ingredientes (`src/components/ui/Icon.tsx`)
- **Sin emoji en la UI**
- Tamaño mínimo de área táctil: 44×44 pt (iOS) / 48×48 dp (Android)

---

## Anti-patrones (prohibido)

❌ Gradientes púrpura / azul / genéricos
❌ Sombras azul-frío (`shadowColor: '#1E2A4A'`)
❌ Fondo `#FFFFFF` puro o `#F5F6FA` gris frío
❌ Texto negro `#000000` o `#111827` frío
❌ Fuentes Inter / Roboto hardcodeadas
❌ `className` de NativeWind/Tailwind (eliminadas del stack)
❌ Más de 1 color de acento por pantalla
❌ Radios de 4–8px en elementos interactivos

---

## Skill de diseño activo

`~/.claude/skills/mobile-app-design/` — reglas nativas RN (touch targets, contraste WCAG, `design-system-config.ts`).

```
Antes de cualquier trabajo de UI:
1. Consultar este DESIGN.md
2. Respetar tokens.ts como única fuente de verdad
3. Verificar touch targets con el skill (44pt / 48dp)
4. No hardcodear ningún valor en componentes
```
