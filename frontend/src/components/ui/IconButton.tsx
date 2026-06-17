import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { Icon, IconName } from './Icon';
import { haptics } from '../../lib/haptics';

export type IconButtonProps = {
  name: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  bg?: string;
  diameter?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Botón circular de icono con ripple sin borde y haptics. */
export function IconButton({
  name,
  onPress,
  size = 20,
  color = colors.ink,
  bg = colors.brandSoft,
  diameter = 40,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptics.light();
              onPress();
            }
          : undefined
      }
      android_ripple={{ color: 'rgba(44,28,14,0.12)', borderless: true, radius: diameter / 2 }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: diameter,
          height: diameter,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
        },
        pressed ? { opacity: 0.85 } : null,
        style,
      ]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}
