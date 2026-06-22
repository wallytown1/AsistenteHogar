import React from 'react';
import { View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import {
  Skeleton,
  SkeletonCard,
  SkeletonText,
  SkeletonStatCard,
  SkeletonRecipeRow,
} from '../ui/Skeleton';

/**
 * Reemplaza el ActivityIndicator dentro de la Card de briefing del Dashboard.
 * El resto de la pantalla (header, card shell de Despensa, accesos) siempre es visible.
 */
export function DashboardBriefingSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      {/* Fecha */}
      <Skeleton height={11} width="32%" borderRadius={radius.sm} />
      {/* Cuerpo del briefing */}
      <View
        style={{
          backgroundColor: colors.cardAlt,
          borderRadius: radius.lg,
          padding: spacing.xl,
          gap: spacing.md,
        }}
      >
        <Skeleton
          width={24}
          height={24}
          borderRadius={radius.pill}
          style={{ alignSelf: 'center' }}
        />
        <SkeletonText lines={4} widths={['100%', '100%', '90%', '65%']} />
      </View>
    </View>
  );
}

/**
 * Variante de pantalla completa: útil si en el futuro se reestructura
 * el Dashboard para tener un early-return de carga.
 */
export function DashboardSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          marginBottom: spacing.xl,
        }}
      >
        <Skeleton width={44} height={44} borderRadius={radius.lg} />
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={11} width={40} borderRadius={radius.sm} />
          <Skeleton height={17} width={100} borderRadius={radius.sm} />
        </View>
      </View>

      {/* Card briefing */}
      <SkeletonCard style={{ marginBottom: spacing.lg }}>
        <Skeleton
          height={17}
          width="55%"
          borderRadius={radius.sm}
          style={{ marginBottom: spacing.md }}
        />
        <Skeleton
          height={11}
          width="32%"
          borderRadius={radius.sm}
          style={{ marginBottom: spacing.md }}
        />
        <View
          style={{
            backgroundColor: colors.cardAlt,
            borderRadius: radius.lg,
            padding: spacing.xl,
            gap: spacing.md,
          }}
        >
          <Skeleton
            width={24}
            height={24}
            borderRadius={radius.pill}
            style={{ alignSelf: 'center' }}
          />
          <SkeletonText lines={3} widths={['100%', '100%', '70%']} />
        </View>
      </SkeletonCard>

      {/* Card despensa */}
      <SkeletonCard style={{ marginBottom: spacing.xl }}>
        <Skeleton
          height={17}
          width="40%"
          borderRadius={radius.sm}
          style={{ marginBottom: spacing.lg }}
        />
        <SkeletonRecipeRow />
        <SkeletonRecipeRow />
        <SkeletonRecipeRow />
      </SkeletonCard>

      {/* Stats grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonStatCard key={i} style={{ flex: 1, minWidth: '45%' }} />
        ))}
      </View>
    </View>
  );
}
