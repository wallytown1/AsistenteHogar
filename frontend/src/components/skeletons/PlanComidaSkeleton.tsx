import React from 'react';
import { View, ScrollView } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Skeleton } from '../ui/Skeleton';

function DiaCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.xxl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        marginBottom: spacing.md,
        gap: spacing.lg,
      }}
    >
      {/* Nombre del día */}
      <Skeleton height={19} width="35%" borderRadius={radius.sm} />

      {/* Slot comida */}
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <Skeleton width={24} height={24} borderRadius={radius.pill} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton height={11} width={50} borderRadius={radius.sm} />
          <Skeleton height={15} width="80%" borderRadius={radius.sm} />
        </View>
      </View>

      {/* Slot cena */}
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <Skeleton width={24} height={24} borderRadius={radius.pill} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton height={11} width={50} borderRadius={radius.sm} />
          <Skeleton height={15} width="70%" borderRadius={radius.sm} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton del plan de comidas.
 * Se monta como hijo del SafeAreaView de PlanComidaScreen (no incluye header).
 */
export function PlanComidaSkeleton() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* Fila de días (7 pills) */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} width={48} height={60} borderRadius={radius.lg} style={{ flex: 1 }} />
        ))}
      </View>

      {/* Cards de días */}
      <DiaCardSkeleton />
      <DiaCardSkeleton />
      <DiaCardSkeleton />
      <DiaCardSkeleton />
    </ScrollView>
  );
}
