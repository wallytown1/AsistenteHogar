import React from 'react';
import { View } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText } from './ui/AppText';
import { Icon } from './ui/Icon';

interface AIDisclaimerBannerProps {
  /** Texto alternativo para contextos distintos del briefing (p. ej. propuestas de evento) */
  texto?: string;
}

/**
 * Aviso de transparencia de contenido generado por IA (EU AI Act, art. 50).
 * Debe mostrarse junto a cualquier texto que provenga realmente del LLM
 * (briefing del dashboard, recetas sugeridas); no junto a fallbacks estáticos.
 */
export default function AIDisclaimerBanner({ texto }: AIDisclaimerBannerProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.brandSoft,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        marginBottom: spacing.md,
      }}
      accessibilityRole="text"
      accessibilityLabel="Aviso de contenido generado por inteligencia artificial"
    >
      <Icon name="sparkles" size={14} color={colors.brand} />
      <AppText variant="micro" color={colors.inkMuted} style={{ flex: 1, lineHeight: 15 }}>
        {texto ?? 'Este resumen ha sido generado por IA y puede contener imprecisiones.'}
      </AppText>
    </View>
  );
}
