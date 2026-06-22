import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { AppText, Icon } from '../ui';
import { colors, spacing, radius } from '../../theme/tokens';
import { RecetaSugerida } from '../../types/types';

interface RecipeChatCardProps {
  receta: RecetaSugerida;
  onPress?: () => void;
}

export default function RecipeChatCard({ receta, onPress }: RecipeChatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <AppText variant="bodyStrong" color={colors.ink}>
            {receta.titulo}
          </AppText>
        </View>
        <View style={styles.timeBadge}>
          <Icon name="timer" size={14} color={colors.brand} />
          <AppText variant="captionStrong" color={colors.brand} style={{ marginLeft: 4 }}>
            {receta.tiempo_min} min
          </AppText>
        </View>
      </View>

      {receta.ingredientes_usados && receta.ingredientes_usados.length > 0 && (
        <View style={styles.ingredientsRow}>
          <Icon name="restaurant" size={14} color={colors.inkFaint} />
          <AppText
            variant="caption"
            color={colors.inkMuted}
            style={styles.ingredientsText}
            numberOfLines={1}
          >
            Aprovechas: {receta.ingredientes_usados.join(', ')}
          </AppText>
        </View>
      )}

      {receta.pasos && receta.pasos.length > 0 && (
        <View style={styles.stepsPreview}>
          <AppText variant="caption" color={colors.inkMuted} numberOfLines={2}>
            1. {receta.pasos[0]}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cardPressed: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.brand,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  ingredientsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  ingredientsText: {
    marginLeft: 6,
    flex: 1,
  },
  stepsPreview: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
