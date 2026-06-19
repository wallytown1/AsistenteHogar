import React, { useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { DiaPlanComidas } from '../types/types';
import { usePlanComidas } from '../hooks/usePlanComidas';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';
import { colors, spacing, radius } from '../theme/tokens';
import { Card, AppText, IconButton, LoadingView, ErrorView, EmptyState } from '../components/ui';

export default function PlanComidaScreen() {
  const navigation = useNavigation();
  const { loading, plan, error, refetch } = usePlanComidas();

  const renderDia = useCallback(
    ({ item }: { item: DiaPlanComidas }) => (
      <Card style={styles.diaCard}>
        <AppText variant="h2" style={styles.diaNombre}>
          {item.dia}
        </AppText>
        <View style={styles.mealRow}>
          <View style={styles.mealIcon}>
            <Ionicons name="sunny-outline" size={15} color={colors.warning} />
          </View>
          <View style={styles.mealContent}>
            <AppText variant="label" color={colors.inkFaint}>
              COMIDA
            </AppText>
            <AppText variant="body">{item.comida}</AppText>
          </View>
        </View>
        <View style={[styles.mealRow, styles.mealRowDivider]}>
          <View style={styles.mealIcon}>
            <Ionicons name="moon-outline" size={15} color={colors.brand} />
          </View>
          <View style={styles.mealContent}>
            <AppText variant="label" color={colors.inkFaint}>
              CENA
            </AppText>
            <AppText variant="body">{item.cena}</AppText>
          </View>
        </View>
      </Card>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          name="arrow-back"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Volver"
        />
        <AppText variant="h2" style={styles.headerTitle}>
          Plan de la semana
        </AppText>
        <IconButton
          name="refresh"
          onPress={refetch}
          accessibilityLabel="Regenerar plan"
          color={loading ? colors.inkFaint : colors.brand}
        />
      </View>

      {loading ? (
        <LoadingView message="Generando plan semanal con IA..." />
      ) : error ? (
        <ErrorView message={error} onRetry={refetch} />
      ) : !plan || plan.dias.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Sin plan todavía"
          subtitle="Añade alimentos a la despensa para generar un menú de aprovechamiento."
        />
      ) : (
        <FlatList
          data={plan.dias}
          keyExtractor={(item) => item.dia}
          renderItem={renderDia}
          ListHeaderComponent={
            plan.generado_por_ia ? (
              <View style={styles.bannerWrap}>
                <AIDisclaimerBanner />
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  bannerWrap: {
    marginBottom: spacing.md,
  },
  diaCard: {
    gap: spacing.sm,
  },
  diaNombre: {
    marginBottom: spacing.xs,
    textTransform: 'capitalize',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  mealRowDivider: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mealIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  mealContent: {
    flex: 1,
    gap: 2,
  },
});
