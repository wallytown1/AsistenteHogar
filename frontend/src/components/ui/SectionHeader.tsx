import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { AppText } from './AppText';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Cabecera de sección: título (+ subtítulo) y acción opcional a la derecha. */
export function SectionHeader({ title, subtitle, right, style }: SectionHeaderProps) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }, style]}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <AppText variant="h2">{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}
