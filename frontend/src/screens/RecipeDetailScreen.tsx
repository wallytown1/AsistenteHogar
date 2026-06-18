import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RecetaSugerida } from '../types/types';
import { useRecetaHistorial } from '../hooks/useRecetaHistorial';
import { colors, spacing, radius } from '../theme/tokens';
import { Card, Button, IconButton, AppText, SectionHeader } from '../components/ui';
import { haptics } from '../lib/haptics';

type NavProp = NativeStackNavigationProp<any>;

export default function RecipeDetailScreen() {
  const route =
    useRoute<RouteProp<{ RecetaDetalle: { receta: RecetaSugerida } }, 'RecetaDetalle'>>();
  const navigation = useNavigation<NavProp>();
  const { receta } = route.params;
  const { registrarAccion, isLoading } = useRecetaHistorial();

  const handleCocinada = async () => {
    haptics.success();
    await registrarAccion(receta.titulo, 'cocinada');
    navigation.goBack();
  };

  const handleRechazada = async () => {
    haptics.light();
    await registrarAccion(receta.titulo, 'rechazada');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <AppText variant="h2" style={styles.headerTitle} numberOfLines={2}>
          {receta.titulo}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={14} color={colors.brand} />
            <AppText variant="captionStrong" color={colors.brand} style={styles.badgeText}>
              {receta.tiempo_min} min
            </AppText>
          </View>
          <View style={[styles.badge, { marginLeft: spacing.sm }]}>
            <Ionicons name="leaf-outline" size={14} color={colors.success} />
            <AppText variant="captionStrong" color={colors.success} style={styles.badgeText}>
              {receta.ingredientes_usados.length} ingredientes
            </AppText>
          </View>
        </View>

        <SectionHeader title="Ingredientes" style={{ marginTop: spacing.lg }} />
        <Card>
          {receta.ingredientes_usados.map((ing, idx) => (
            <View key={idx} style={[styles.row, idx > 0 && styles.rowBorder]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <AppText variant="body" style={styles.rowText}>
                {ing}
              </AppText>
            </View>
          ))}
        </Card>

        <SectionHeader title="Preparación" style={{ marginTop: spacing.lg }} />
        <Card>
          {receta.pasos.map((paso, idx) => (
            <View key={idx} style={[styles.row, styles.rowTop, idx > 0 && styles.rowBorder]}>
              <View style={styles.stepBubble}>
                <AppText variant="label" color={colors.onBrand}>
                  {idx + 1}
                </AppText>
              </View>
              <AppText variant="body" style={[styles.rowText, { flex: 1 }]}>
                {paso}
              </AppText>
            </View>
          ))}
        </Card>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Marcar como cocinada"
          icon="checkmark-circle-outline"
          variant="primary"
          loading={isLoading(receta.titulo, 'cocinada')}
          onPress={handleCocinada}
        />
        <View style={{ marginTop: spacing.sm }}>
          <Button
            label="No me gusta"
            icon="close-circle-outline"
            variant="ghost"
            loading={isLoading(receta.titulo, 'rechazada')}
            onPress={handleRechazada}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: {
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowTop: {
    alignItems: 'flex-start',
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  stepBubble: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
