import React from 'react';
import { View, ViewStyle, DimensionValue, StyleProp } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, radius, shadow, spacing } from '../../theme/tokens';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Átomo base pulsante. Usa moti para animar en el hilo nativo.
 * Respeta "Reducir movimiento" del SO: con la opción activa muestra una
 * opacidad estática en lugar del pulso infinito (accesibilidad).
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = radius.md,
  style,
}) => {
  const reduceMotion = useReducedMotion();
  return (
    <MotiView
      transition={
        reduceMotion
          ? { type: 'timing', duration: 0 }
          : { type: 'timing', duration: 1000, loop: true }
      }
      from={{ opacity: reduceMotion ? 0.5 : 0.3 }}
      animate={{ opacity: reduceMotion ? 0.5 : 0.7 }}
      style={[{ width, height, borderRadius, backgroundColor: colors.cardAlt }, style]}
    />
  );
};

// ─── Helpers de composición ────────────────────────────────────────────────

interface SkeletonTextProps {
  lines?: number;
  widths?: DimensionValue[];
  style?: StyleProp<ViewStyle>;
}

/** Varias líneas de texto esqueleto. */
export function SkeletonText({ lines = 1, widths = ['100%'], style }: SkeletonTextProps) {
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          borderRadius={radius.sm}
          width={widths[i] ?? widths[widths.length - 1]}
        />
      ))}
    </View>
  );
}

/** Wrapper con el estilo Card del sistema (radius xxl + sombra + borde). */
export function SkeletonCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xxl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.xl,
          ...shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Placeholder de imagen/hero. */
export function SkeletonImage({
  width = '100%',
  height = 150,
  borderRadius = radius.xl,
  style,
}: SkeletonProps & { height?: number }) {
  return <Skeleton width={width} height={height} borderRadius={borderRadius} style={style} />;
}

/** Chip de filtro esqueleto. */
export function SkeletonChip({ style }: { style?: StyleProp<ViewStyle> }) {
  return <Skeleton width={80} height={34} borderRadius={radius.pill} style={style} />;
}

/** Tarjeta de estadística (usada en grid 2×2 del Dashboard). */
export function SkeletonStatCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xxl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          alignItems: 'center',
          gap: spacing.sm,
          ...shadow.card,
        },
        style,
      ]}
    >
      <Skeleton width={40} height={26} borderRadius={radius.md} />
      <Skeleton width={60} height={11} borderRadius={radius.sm} />
    </View>
  );
}

/** Fila de receta/ingrediente (icono + título + subtítulo). */
export function SkeletonRecipeRow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
        },
        style,
      ]}
    >
      <Skeleton width={52} height={52} borderRadius={radius.lg} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton height={15} width="60%" borderRadius={radius.sm} />
        <Skeleton height={12} width="80%" borderRadius={radius.sm} />
      </View>
    </View>
  );
}

/** Lista de pasos de receta esqueleto. */
export function SkeletonSteps({
  count = 3,
  style,
}: {
  count?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: spacing.md }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            backgroundColor: colors.card,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
          }}
        >
          <Skeleton width={32} height={32} borderRadius={radius.pill} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton height={14} width="100%" borderRadius={radius.sm} />
            <Skeleton height={14} width="75%" borderRadius={radius.sm} />
          </View>
        </View>
      ))}
    </View>
  );
}
