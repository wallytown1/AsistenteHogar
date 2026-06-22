import React from 'react';
import { View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';

function HistorialCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.xxl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        marginBottom: spacing.md,
        gap: spacing.md,
      }}
    >
      {/* Título + badge estado */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton height={17} width="65%" borderRadius={radius.sm} />
          <Skeleton height={12} width="45%" borderRadius={radius.sm} />
        </View>
        <Skeleton height={24} width={72} borderRadius={radius.pill} />
      </View>
      {/* Chips de valoración */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Skeleton height={20} width={60} borderRadius={radius.pill} />
        <Skeleton height={20} width={80} borderRadius={radius.pill} />
      </View>
    </View>
  );
}

/** Pantalla completa de carga del Historial de recetas. */
export function HistorialSkeleton() {
  return (
    <Screen>
      {/* Título */}
      <Skeleton
        height={32}
        width="60%"
        borderRadius={radius.md}
        style={{ marginBottom: spacing.sm }}
      />
      <Skeleton
        height={13}
        width="38%"
        borderRadius={radius.sm}
        style={{ marginBottom: spacing.xxl }}
      />

      <HistorialCardSkeleton />
      <HistorialCardSkeleton />
      <HistorialCardSkeleton />
      <HistorialCardSkeleton />
      <HistorialCardSkeleton />
    </Screen>
  );
}
