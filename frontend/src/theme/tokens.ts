import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * Sistema de diseño "Tierra Cálida" — paleta mediterránea: marrones tostados,
 * crema/lino y terracota. Un único punto de verdad para color, tipografía,
 * espaciado, radios y sombras. Ningún componente hardcodea valores.
 */

export const colors = {
  // Marca / acción principal — marrón arcilla español
  brand: '#8B5E3C',
  brandDark: '#6B4429',
  brandSoft: '#F6EDE3',

  // Superficies — lino cálido, no gris frío
  bg: '#FAF7F2',
  card: '#FFFDF8',
  cardAlt: '#F9F4EC',

  // Texto — marrón oscuro (no negro frío)
  ink: '#2C1C0E',
  inkMuted: '#7A6045',
  inkFaint: '#AE9B87',
  onBrand: '#FFFFFF',

  // Líneas — beige cálido
  border: '#EAE0D3',
  borderStrong: '#D9CCBC',

  // Semánticos — tonos cálidos: verde salvia, ámbar arcilla, rojo terracota
  success: '#5C8B68',
  successSoft: '#EBF4EE',
  warning: '#C8783A',
  warningSoft: '#FAF0E6',
  danger: '#B84B2D',
  dangerSoft: '#FAF0EC',
  info: '#5E7FA8',
  infoSoft: '#EEF3F8',

  // Acentos por módulo
  home: '#8B5E3C',
  homeSoft: '#F6EDE3',
  pantry: '#8B5E3C', // despensa = marrón arcilla (unificado con la marca)
  pantrySoft: '#F6EDE3',
  calendar: '#8B5E3C',
  calendarSoft: '#F6EDE3',
  tasks: '#C8783A', // tareas = ámbar terracota (urgencia cálida)
  tasksSoft: '#FAF0E6',

  // Misc
  white: '#FFFFFF',
  overlay: 'rgba(44,28,14,0.55)', // sombra de overlay marrón oscuro
  track: '#EAE0D3',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, pill: 999 } as const;

export const typography: Record<string, TextStyle> = {
  display: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  bodyStrong: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '500' },
  captionStrong: { fontSize: 13, fontWeight: '700' },
  caption: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  micro: { fontSize: 11, fontWeight: '600' },
};

export const shadow = {
  card: (Platform.select({
    ios: {
      shadowColor: '#3D2B1A',
      shadowOpacity: 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 2 },
    default: {},
  }) ?? {}) as ViewStyle,
  fab: (Platform.select({
    ios: {
      shadowColor: '#8B5E3C',
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }) ?? {}) as ViewStyle,
};
