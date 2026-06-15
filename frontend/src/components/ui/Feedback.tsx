import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

/** Estado de carga a pantalla completa. */
export function LoadingView({ message }: { message?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
      <ActivityIndicator size="large" color={colors.brand} />
      {message ? <AppText variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.md }}>{message}</AppText> : null}
    </View>
  );
}

/** Estado de error a pantalla completa con reintento opcional. */
export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
      <View style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
        <Icon name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <AppText variant="bodyStrong" center style={{ marginBottom: spacing.lg }}>{message}</AppText>
      {onRetry ? <Button label="Reintentar" icon="refresh" variant="secondary" fullWidth={false} onPress={onRetry} /> : null}
    </View>
  );
}
