# Sistema de Diseño UI — AsistenteHogar

> **Rama:** `redesign/native-ui` (aún no fusionada a `main`).
> Rediseño visual completo del frontend con un lenguaje nuevo (con color), orientado a
> que la app se sienta **nativa en iOS y Android**. La lógica de negocio se preservó al 100%;
> solo cambió la capa de presentación.

---

## 1. Objetivo

Eliminar los rasgos que delataban una app "de prototipo" y subir el listón a calidad nativa,
manteniendo una identidad de marca coherente en ambas plataformas (estilo Notion/Linear/Revolut).

| Antes (`main`) | Ahora (`redesign/native-ui`) |
|---|---|
| Iconos emoji (🏠🥫🗑️…) | Iconos vectoriales (`@expo/vector-icons`) |
| `paddingTop: 56` hardcodeado | Safe areas reales (`useSafeAreaInsets`) |
| Mismo aspecto plano en iOS/Android | Ripple Material, `Switch` nativo, sombras por plataforma |
| Sin feedback táctil | Haptics en acciones clave |
| Tamaños/pesos ad-hoc por pantalla | Escala tipográfica única |
| Estilos con NativeWind `className` | StyleSheet + tokens tipados |
| Blanco/negro | Paleta con color y acentos por módulo |

---

## 2. Tokens — `src/theme/tokens.ts`

Única fuente de verdad. Ningún componente o pantalla hardcodea valores.

- **Color**
  - Marca: `brand #6366F1`, `brandDark #4F46E5`, `brandSoft #EEF2FF`.
  - Superficies: `bg #F5F6FA`, `card #FFFFFF`, `cardAlt #FAFBFD`.
  - Texto: `ink`, `inkMuted`, `inkFaint`.
  - Semánticos (+ tinte `*Soft`): `success`, `warning`, `danger`, `info`.
  - Acentos por módulo: **despensa** verde (`pantry`), **calendario** índigo (`calendar`), **tareas** ámbar (`tasks`), **inicio** marca.
- **Tipografía** (`typography`): `display`, `title`, `h2`, `bodyStrong`, `body`, `captionStrong`, `caption`, `label`, `micro`.
- **Espaciado** (`spacing`): xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32.
- **Radios** (`radius`): sm 10 · md 14 · lg 18 · xl 22 · xxl 28 · pill 999.
- **Sombras** (`shadow`): `card` y `fab`, con `Platform.select` (sombra iOS / elevación Android).

---

## 3. Componentes — `src/components/ui/`

Barrel de exportación en `src/components/ui/index.ts`.

| Componente | Rol |
|---|---|
| `Screen` | Contenedor de pantalla con safe areas + pull-to-refresh nativo |
| `Card` | Superficie blanca redondeada con sombra (opcionalmente pulsable) |
| `Button` | Botón con variantes (primary/secondary/ghost/danger), tamaños, loading, icono, ripple + haptics |
| `IconButton` | Botón circular de icono con ripple sin borde |
| `Chip` | Pastilla de filtro/selección con estado activo |
| `StatCard` | Tarjeta de métrica (valor + icono con tinte + barra opcional) |
| `SectionHeader` | Título de sección + acción a la derecha |
| `Fab` | Botón de acción flotante sobre la tab bar (respeta safe area) |
| `Badge` | Etiqueta de estado compacta con tinte |
| `EmptyState` | Estado vacío (icono + mensaje) |
| `Field` | Campo de texto con etiqueta |
| `AppText` | Texto tipográfico (usa la escala de tokens) |
| `Icon` / `FoodIcon` | Ionicons / MaterialCommunityIcons (comida) |
| `LoadingView` / `ErrorView` | Estados de carga y error a pantalla completa |

Utilidades: `src/lib/haptics.ts` (wrapper seguro de `expo-haptics`, no-op en web) y
`src/lib/categoria.ts` (icono culinario por categoría de alimento).

---

## 4. Toques nativos por plataforma

- **Iconos**: vectoriales coherentes; la tab bar alterna icono relleno/contorno según pestaña activa.
- **Safe areas**: todo el contenido respeta notch / Dynamic Island / barra de estado; el FAB y la tab bar respetan el inset inferior.
- **Android**: `android_ripple` en pulsables, `Switch` Material, elevación.
- **iOS**: sombras suaves, `Switch` estilo iOS, toggles redondeados.
- **Haptics**: ligero al pulsar, medio en el FAB, success/warning/error en resultados.
- **Pull-to-refresh** nativo en Dashboard, Despensa, Calendario y Tareas.

---

## 5. Decisión técnica: fuera NativeWind `className`

La UI pasó de NativeWind `className` a **StyleSheet + tokens** por tipado robusto y control fino
(evita la fragilidad de las cadenas de clases dinámicas). NativeWind sigue instalado (babel preset
+ `global.css`) pero ya **no se usa para estilar**. Regla: no reintroducir `className` en pantallas.

---

## 6. Verificación

- `npm run ts:check` → **0 errores** (los nombres de icono se validan contra el glyphmap en tiempo de tipos).
- **0** referencias a `className` en `src/`.
- Dependencia añadida: `expo-haptics` (vía `npx expo install`).
- Pendiente: validación visual en dispositivo antes de fusionar a `main`.

---

## 7. Cómo comparar / fusionar

```bash
# Ver diferencias contra main
git diff main..redesign/native-ui -- frontend/

# Probar el rediseño
git checkout redesign/native-ui
cd frontend && npm install && npm start

# Cuando convenza, fusionar
git checkout main && git merge redesign/native-ui
```
