import React from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadow } from '../../theme/tokens';
import { haptics } from '../../lib/haptics';

export type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  onPress?: () => void;
  tint?: string;
  borderColor?: string;
};

/** Tarjeta base: superficie blanca redondeada con sombra suave nativa. */
export function Card({
  children,
  style,
  padding = spacing.xl,
  onPress,
  tint = colors.card,
  borderColor = colors.border,
}: CardProps) {
  const base: ViewStyle = {
    backgroundColor: tint,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor,
    padding,
    ...shadow.card,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          haptics.light();
          onPress();
        }}
        android_ripple={{ color: 'rgba(139,94,60,0.10)' }}
        style={({ pressed }) => [base, pressed ? { opacity: 0.96 } : null, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
