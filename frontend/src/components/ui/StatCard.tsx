import React from 'react';
import { View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Card } from './Card';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export type StatCardProps = {
  label: string;
  value: string;
  icon: IconName;
  accent?: string;
  accentSoft?: string;
  progress?: number;
  footnote?: string;
};

/** Tarjeta de métrica: etiqueta, valor grande, icono con tinte y barra opcional. */
export function StatCard({
  label,
  value,
  icon,
  accent = colors.brand,
  accentSoft = colors.brandSoft,
  progress,
  footnote,
}: StatCardProps) {
  return (
    <Card style={{ flex: 1 }} padding={spacing.lg}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <AppText variant="label" color={colors.inkFaint}>{label}</AppText>
        <View style={{ width: 30, height: 30, borderRadius: radius.pill, backgroundColor: accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={accent} />
        </View>
      </View>
      <AppText variant="title" color={colors.ink}>{value}</AppText>
      {footnote ? <AppText variant="micro" color={colors.inkMuted} style={{ marginTop: 3 }}>{footnote}</AppText> : null}
      {typeof progress === 'number' ? (
        <View style={{ height: 6, backgroundColor: colors.track, borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: accent, borderRadius: radius.pill }} />
        </View>
      ) : null}
    </Card>
  );
}
