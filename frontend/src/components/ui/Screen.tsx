import React from 'react';
import { View, ScrollView, RefreshControl, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';

export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bg?: string;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Espacio extra al fondo (p. ej. para que el FAB no tape contenido). */
  bottomExtra?: number;
};

/**
 * Contenedor de pantalla consciente de las safe areas (notch, Dynamic Island,
 * barra de estado Android). Reemplaza los paddingTop hardcodeados. Incluye
 * pull-to-refresh nativo cuando se pasa onRefresh.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  bg = colors.bg,
  contentStyle,
  refreshing,
  onRefresh,
  bottomExtra = 0,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: insets.top + spacing.sm,
    paddingHorizontal: padded ? spacing.xl : 0,
    paddingBottom: spacing.xxxl + bottomExtra,
  };

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: bg }, pad, contentStyle]}>{children}</View>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={[pad, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
