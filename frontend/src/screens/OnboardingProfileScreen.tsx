import React, { useState } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme/tokens';
import { AppText, Button, Chip, Icon } from '../components/ui';
import { haptics } from '../lib/haptics';
import { PerfilHogar } from '../types/types';

type Props = {
  onSave: (gustos: string[], numComensales: number) => Promise<PerfilHogar>;
  onSkip: () => void;
};

// Gustos preestablecidos alineados con la cocina mediterránea española.
const GUSTOS_PRESET = [
  'Arroces',
  'Guisos y potajes',
  'Pescado',
  'Carne a la plancha',
  'Verduras de temporada',
  'Legumbres',
  'Pasta',
  'Tradicional',
  'Ligero y saludable',
  'Picante',
];

const MIN_COMENSALES = 1;
const MAX_COMENSALES = 20;

export default function OnboardingProfileScreen({ onSave, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const [gustos, setGustos] = useState<string[]>([]);
  const [numComensales, setNumComensales] = useState(2);
  const [guardando, setGuardando] = useState(false);

  const toggleGusto = (g: string) => {
    setGustos((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const cambiarComensales = (delta: number) => {
    haptics.light();
    setNumComensales((n) => Math.min(MAX_COMENSALES, Math.max(MIN_COMENSALES, n + delta)));
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await onSave(gustos, numComensales);
      haptics.success();
    } catch (err: any) {
      haptics.error();
      Alert.alert('No se pudo guardar', err.message || 'Inténtalo de nuevo en un momento.');
      setGuardando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xxl,
          paddingTop: spacing.xxl,
          paddingBottom: spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera */}
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.xl,
            backgroundColor: colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xl,
          }}
        >
          <Icon name="restaurant" size={34} color={colors.brand} />
        </View>
        <AppText variant="display" style={{ marginBottom: spacing.sm }}>
          Cuéntanos qué os gusta
        </AppText>
        <AppText
          variant="body"
          color={colors.inkMuted}
          style={{ lineHeight: 23, marginBottom: spacing.xxl }}
        >
          Personalizaremos las recetas según los gustos del hogar. Podrás cambiarlo cuando quieras.
        </AppText>

        {/* Gustos culinarios */}
        <AppText variant="label" color={colors.inkFaint} style={{ marginBottom: spacing.md }}>
          Gustos culinarios
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginBottom: spacing.xxl,
          }}
        >
          {GUSTOS_PRESET.map((g) => (
            <Chip
              key={g}
              label={g}
              active={gustos.includes(g)}
              activeColor={colors.brand}
              onPress={() => toggleGusto(g)}
            />
          ))}
        </View>

        {/* Número de comensales */}
        <AppText variant="label" color={colors.inkFaint} style={{ marginBottom: spacing.md }}>
          ¿Cuántos sois en casa?
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.md,
          }}
        >
          <Pressable
            onPress={() => cambiarComensales(-1)}
            disabled={numComensales <= MIN_COMENSALES}
            hitSlop={8}
            accessibilityLabel="Quitar un comensal"
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              backgroundColor: colors.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: numComensales <= MIN_COMENSALES ? 0.4 : 1,
            }}
          >
            <Icon name="remove" size={22} color={colors.brand} />
          </Pressable>

          <View style={{ alignItems: 'center' }}>
            <AppText variant="display" style={{ fontSize: 32 }}>
              {numComensales}
            </AppText>
            <AppText variant="micro" color={colors.inkFaint}>
              {numComensales === 1 ? 'comensal' : 'comensales'}
            </AppText>
          </View>

          <Pressable
            onPress={() => cambiarComensales(1)}
            disabled={numComensales >= MAX_COMENSALES}
            hitSlop={8}
            accessibilityLabel="Añadir un comensal"
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: numComensales >= MAX_COMENSALES ? 0.4 : 1,
            }}
          >
            <Icon name="add" size={22} color={colors.white} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Acciones */}
      <View
        style={{
          paddingHorizontal: spacing.xxl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingTop: spacing.md,
          gap: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <Button
          label={guardando ? 'Guardando...' : 'Guardar y empezar'}
          onPress={guardar}
          loading={guardando}
          size="lg"
        />
        <Pressable
          onPress={onSkip}
          hitSlop={8}
          disabled={guardando}
          style={{ alignItems: 'center' }}
        >
          <AppText variant="caption" color={colors.inkFaint}>
            Ahora no
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
