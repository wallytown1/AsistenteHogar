import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type FoodIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/** Icono vectorial estándar (Ionicons) — coherente en iOS y Android. */
export function Icon({ name, size = 22, color = colors.ink }: IconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** Iconos de comida/categorías (MaterialCommunityIcons tiene mejor set culinario). */
export function FoodIcon({ name, size = 22, color = colors.ink }: { name: FoodIconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
