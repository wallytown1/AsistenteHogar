import React from 'react';
import { Text, View } from 'react-native';

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
      className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 mb-3"
      accessibilityRole="text"
      accessibilityLabel="Aviso de contenido generado por inteligencia artificial"
    >
      <Text className="text-xs mr-2">🤖</Text>
      <Text className="text-gray-500 text-[10px] leading-4 flex-1 font-medium">
        {texto ?? 'Este resumen ha sido generado por IA y puede contener imprecisiones.'}
      </Text>
    </View>
  );
}
