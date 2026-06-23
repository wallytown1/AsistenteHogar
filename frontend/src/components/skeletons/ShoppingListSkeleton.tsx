import React from 'react';
import { View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';

function ShoppingItemSkeleton({ checked = false }: { checked?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: checked ? colors.successSoft : colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: checked ? '#C0DCCA' : colors.border,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Skeleton width={24} height={24} borderRadius={radius.sm} />
      <View style={{ flex: 1 }}>
        <Skeleton height={15} width={checked ? '50%' : '62%'} borderRadius={radius.sm} />
      </View>
      <Skeleton height={13} width={28} borderRadius={radius.sm} />
    </View>
  );
}

/** Pantalla completa de carga de la Lista de Compra. */
export function ShoppingListSkeleton() {
  return (
    <Screen>
      {/* Título */}
      <Skeleton
        height={26}
        width="55%"
        borderRadius={radius.md}
        style={{ marginBottom: spacing.xl }}
      />

      {/* Barra de progreso */}
      <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton height={13} width="40%" borderRadius={radius.sm} />
          <Skeleton height={13} width="25%" borderRadius={radius.sm} />
        </View>
        <Skeleton height={8} width="100%" borderRadius={radius.pill} />
      </View>

      {/* Banner Marce */}
      <View
        style={{
          backgroundColor: colors.brandSoft,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          padding: spacing.lg,
          marginBottom: spacing.xl,
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
        }}
      >
        <Skeleton width={32} height={32} borderRadius={radius.pill} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton height={13} width="100%" borderRadius={radius.sm} />
          <Skeleton height={13} width="80%" borderRadius={radius.sm} />
        </View>
      </View>

      {/* Items pendientes */}
      <Skeleton
        height={11}
        width="30%"
        borderRadius={radius.sm}
        style={{ marginBottom: spacing.md }}
      />
      <ShoppingItemSkeleton />
      <ShoppingItemSkeleton />
      <ShoppingItemSkeleton />
      <ShoppingItemSkeleton />

      {/* Items completados */}
      <Skeleton
        height={11}
        width="30%"
        borderRadius={radius.sm}
        style={{ marginTop: spacing.lg, marginBottom: spacing.md }}
      />
      <ShoppingItemSkeleton checked />
      <ShoppingItemSkeleton checked />
    </Screen>
  );
}
