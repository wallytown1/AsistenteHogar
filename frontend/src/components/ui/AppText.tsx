import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
import { colors, typography } from '../../theme/tokens';

export type AppTextVariant = keyof typeof typography;

export type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
};

/** Texto tipográfico del sistema. Usa la escala definida en tokens (sin tamaños ad-hoc). */
export function AppText({ variant = 'body', color = colors.ink, center, style, children, ...rest }: AppTextProps) {
  return (
    <Text {...rest} style={[typography[variant], { color }, center ? { textAlign: 'center' } : null, style]}>
      {children}
    </Text>
  );
}
