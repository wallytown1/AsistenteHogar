import React from 'react';
import { View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Screen } from '../ui/Screen';
import { Skeleton, SkeletonChip } from '../ui/Skeleton';

function IngredientRowSkeleton({ withBadge = false }: { withBadge?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Skeleton width={44} height={44} borderRadius={radius.lg} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton height={15} width="55%" borderRadius={radius.sm} />
        <Skeleton height={12} width="70%" borderRadius={radius.sm} />
        {withBadge && <Skeleton height={20} width={90} borderRadius={radius.pill} />}
      </View>
      <Skeleton width={32} height={32} borderRadius={radius.pill} />
    </View>
  );
}

/** Pantalla completa de carga de la Despensa. */
export function PantrySkeleton() {
  return (
    <Screen>
      {/* Título */}
      <Skeleton
        height={32}
        width="50%"
        borderRadius={radius.md}
        style={{ marginBottom: spacing.lg }}
      />

      {/* Chips de filtro */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonChip key={i} />
        ))}
      </View>

      {/* Sección "Por caducar" */}
      <Skeleton
        height={11}
        width="42%"
        borderRadius={radius.sm}
        style={{ marginBottom: spacing.md }}
      />
      <IngredientRowSkeleton withBadge />
      <IngredientRowSkeleton withBadge />
      <IngredientRowSkeleton withBadge />

      {/* Sección "Disponibles" */}
      <Skeleton
        height={11}
        width="30%"
        borderRadius={radius.sm}
        style={{ marginTop: spacing.lg, marginBottom: spacing.md }}
      />
      <IngredientRowSkeleton />
      <IngredientRowSkeleton />
      <IngredientRowSkeleton />
      <IngredientRowSkeleton />
    </Screen>
  );
}
