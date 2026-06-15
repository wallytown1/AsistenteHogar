import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * Sistema de diseño "Hogar" — lenguaje visual con color, pensado para sentirse
 * nativo y premium en iOS y Android. Un único punto de verdad para color,
 * tipografía, espaciado, radios y sombras. Ningún componente hardcodea valores.
 */

export const colors = {
  // Marca / acción principal
  brand: '#6366F1',
  brandDark: '#4F46E5',
  brandSoft: '#EEF2FF',

  // Superficies
  bg: '#F5F6FA',
  card: '#FFFFFF',
  cardAlt: '#FAFBFD',

  // Texto
  ink: '#111827',
  inkMuted: '#6B7280',
  inkFaint: '#9CA3AF',
  onBrand: '#FFFFFF',

  // Líneas
  border: '#ECEEF3',
  borderStrong: '#E2E5EC',

  // Semánticos + su tinte suave
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',

  // Acentos por módulo (categorización visual)
  home: '#6366F1',
  homeSoft: '#EEF2FF',
  pantry: '#059669',
  pantrySoft: '#ECFDF5',
  calendar: '#6366F1',
  calendarSoft: '#EEF2FF',
  tasks: '#F59E0B',
  tasksSoft: '#FFFBEB',

  // Misc
  white: '#FFFFFF',
  overlay: 'rgba(17,24,39,0.55)',
  track: '#EDEFF4',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, pill: 999 } as const;

export const typography: Record<string, TextStyle> = {
  display: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  bodyStrong: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '500' },
  captionStrong: { fontSize: 13, fontWeight: '700' },
  caption: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  micro: { fontSize: 10, fontWeight: '600' },
};

export const shadow = {
  card: (Platform.select({
    ios: { shadowColor: '#1E2A4A', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 2 },
    default: {},
  }) ?? {}) as ViewStyle,
  fab: (Platform.select({
    ios: { shadowColor: '#4F46E5', shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 6 },
    default: {},
  }) ?? {}) as ViewStyle,
};
