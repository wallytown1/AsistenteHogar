import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { colors, spacing, radius } from '../../theme/tokens';

interface Props {
  titulo: string;
  ingredientes: string[];
  tiempoMin: number;
}

// Usa Text nativo en lugar de AppText para garantizar que ViewShot capture
// la fuente correctamente sin dependencias de contexto externo.
export const ShareRecipeCard = React.forwardRef<View, Props>(
  ({ titulo, ingredientes, tiempoMin }, ref) => {
    const visibles = ingredientes.slice(0, 5);
    const extra = ingredientes.length - visibles.length;

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {/* Header de marca */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🥘</Text>
          <Text style={styles.marce}>Chef Marce</Text>
          <Text style={styles.app}>AsistenteHogar</Text>
        </View>

        {/* Título */}
        <Text style={styles.titulo} numberOfLines={3}>
          {titulo}
        </Text>

        <View style={styles.separator} />

        {/* Ingredientes */}
        <Text style={styles.label}>Con lo que había en casa</Text>
        <View style={styles.chips}>
          {visibles.map((ing, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{ing}</Text>
            </View>
          ))}
          {extra > 0 && (
            <View style={[styles.chip, styles.chipExtra]}>
              <Text style={styles.chipText}>+{extra} más</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.tiempo}>⏱ {tiempoMin} min</Text>
          <Text style={styles.cta}>asistente-hogar.app</Text>
        </View>
      </View>
    );
  }
);

ShareRecipeCard.displayName = 'ShareRecipeCard';

const CARD_WIDTH = 360;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  emoji: {
    fontSize: 20,
  },
  marce: {
    flex: 1,
    color: colors.onBrand,
    fontSize: 16,
    fontWeight: '700',
  },
  app: {
    color: colors.onBrand,
    fontSize: 12,
    opacity: 0.8,
  },
  titulo: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  chip: {
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipExtra: {
    backgroundColor: colors.cardAlt,
  },
  chipText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tiempo: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  cta: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
});
