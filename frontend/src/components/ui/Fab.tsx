import React from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../../theme/tokens';
import { Icon, IconName } from './Icon';
import { haptics } from '../../lib/haptics';

export type FabProps = {
  icon?: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  color?: string;
};

/**
 * Botón de acción flotante. Se posiciona sobre la barra de pestañas respetando
 * la safe area inferior. Elevación + ripple le dan sabor Material en Android.
 */
export function Fab({ icon = 'add', onPress, accessibilityLabel, color = colors.brand }: FabProps) {
  const insets = useSafeAreaInsets();
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
          bottom: insets.bottom + 78,
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
