import React from 'react';
import { View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  subtitle?: string;
  accent?: string;
  accentSoft?: string;
};

/** Estado vacío reutilizable: icono en círculo + mensaje. */
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  subtitle,
  accent = colors.brand,
  accentSoft = colors.brandSoft,
}: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
      <View style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
        <Icon name={icon} size={26} color={accent} />
      </View>
      <AppText variant="bodyStrong" center>{title}</AppText>
      {subtitle ? (
        <AppText variant="caption" color={colors.inkMuted} center style={{ marginTop: 4, paddingHorizontal: spacing.xl, lineHeight: 18 }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
