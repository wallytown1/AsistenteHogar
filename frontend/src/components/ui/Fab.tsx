import React from 'react';
import { Pressable } from 'react-native';
import { colors, radius, spacing, shadow } from '../../theme/tokens';
import { Icon, IconName } from './Icon';
import { haptics } from '../../lib/haptics';

export type FabProps = {
  icon?: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  color?: string;
  /** Distancia al borde inferior del área de contenido. Por defecto flota justo
   *  encima de la barra de pestañas (el área de la pantalla ya excluye la tab bar
   *  y su safe-area, así que NO hay que sumar insets aquí). */
  bottom?: number;
};

/**
 * Botón de acción flotante. Elevación + ripple le dan sabor Material en Android.
 */
export function Fab({ icon = 'add', onPress, accessibilityLabel, color = colors.brand, bottom = spacing.xl }: FabProps) {
  return (
    <Pressable
      onPress={() => { haptics.medium(); onPress(); }}
      android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: true, radius: 30 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: 20,
          bottom,
          width: 58,
          height: 58,
          borderRadius: radius.pill,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.fab,
        },
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <Icon name={icon} size={28} color={colors.white} />
    </Pressable>
  );
}
