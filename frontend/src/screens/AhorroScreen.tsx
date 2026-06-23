import React from 'react';
import { View, ScrollView, StyleSheet, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, TIMEOUT } from '../api/api';
import { AhorroResumenResponse } from '../types/types';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText, Button, Card, Icon, IconButton } from '../components/ui';
import { haptics } from '../lib/haptics';

type NavProp = NativeStackNavigationProp<any>;

function useAhorroResumen() {
  return useQuery({
    queryKey: ['ahorro', 'resumen'],
    queryFn: () =>
      apiRequest<AhorroResumenResponse>('/ahorro/resumen', { timeoutMs: TIMEOUT.DEFAULT }),
    staleTime: 5 * 60 * 1000,
  });
}

function StatBox({
  icon,
  value,
  label,
  iconColor,
}: {
  icon: string;
  value: string;
  label: string;
  iconColor: string;
}) {
  return (
    <View style={styles.statBox}>
      <Icon name={icon as any} size={20} color={iconColor} />
      <AppText variant="h2" style={styles.statValue}>
        {value}
      </AppText>
      <AppText variant="micro" color="inkMuted" style={styles.statLabel}>
        {label}
      </AppText>
    </View>
  );
}

export default function AhorroScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch } = useAhorroResumen();

  const ahorroMostrado =
    data?.tiene_datos_reales && data.ahorro_real_eur != null
      ? data.ahorro_real_eur
      : (data?.ahorro_estimado_eur ?? 0);

  const esEstimado = !data?.tiene_datos_reales || data.ahorro_real_eur == null;

  const handleCompartir = async () => {
    if (!data) return;
    haptics.selection();
    try {
      await Share.share({
        message: `🌿 Este mes he aprovechado la despensa y evitado desperdiciar ${data.kg_no_desperdiciados.toFixed(1)} kg de comida. Ahorro estimado: ${ahorroMostrado.toFixed(2)} €. #AsistenteHogar #SinDesperdicio`,
      });
    } catch {
      // user cancelled
    }
  };

  const mesFormateado = data
    ? new Date(data.mes + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <AppText variant="h2" style={styles.headerTitle}>
          Informe de Ahorro
        </AppText>
        <IconButton name="share-social-outline" onPress={handleCompartir} />
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
          <AppText variant="caption" color="inkFaint" style={{ marginTop: spacing.lg }}>
            Calculando tu informe…
          </AppText>
        </View>
      )}

      {isError && (
        <View style={styles.centered}>
          <AppText variant="caption" color={colors.danger} style={{ textAlign: 'center' }}>
            No se pudo cargar el informe. Comprueba tu conexión.
          </AppText>
          <Button
            label="Reintentar"
            variant="secondary"
            onPress={() => refetch()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      )}

      {data && !isLoading && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero: € ahorrado */}
          <View style={styles.heroCard}>
            <AppText variant="micro" color="inkMuted" style={styles.heroMes}>
              {mesFormateado.charAt(0).toUpperCase() + mesFormateado.slice(1)}
            </AppText>
            <View style={styles.heroAmount}>
              <AppText style={styles.euroSymbol}>€</AppText>
              <AppText style={styles.heroNumber}>{ahorroMostrado.toFixed(2)}</AppText>
            </View>
            <AppText variant="caption" color="inkMuted" style={styles.heroSubtitle}>
              {esEstimado
                ? 'ahorro estimado · importa tickets para el cálculo real'
                : 'ahorro real calculado desde tus tickets'}
            </AppText>
          </View>

          {/* Stats row */}
          <Card style={styles.statsCard}>
            <StatBox
              icon="restaurant-outline"
              value={String(data.recetas_cocinadas)}
              label="recetas cocinadas"
              iconColor={colors.brand}
            />
            <View style={styles.statDivider} />
            <StatBox
              icon="leaf-outline"
              value={`${data.kg_no_desperdiciados.toFixed(1)} kg`}
              label="no desperdiciados"
              iconColor={colors.success}
            />
            <View style={styles.statDivider} />
            <StatBox
              icon="trending-up-outline"
              value={`${data.porcentaje_media_espana}%`}
              label="mejor que la media"
              iconColor={colors.warning}
            />
          </Card>

          {/* Tickets info */}
          <View style={styles.metaRow}>
            <Icon name="document-text-outline" size={14} color={colors.inkMuted} />
            <AppText variant="micro" color="inkMuted" style={{ marginLeft: spacing.xs }}>
              {data.tickets_analizados > 0
                ? `${data.tickets_analizados} entradas con precio importadas`
                : 'Sin tickets importados · usa "PDF Mercadona" en Despensa para obtener precios reales'}
            </AppText>
          </View>

          {/* Desglose */}
          {data.desglose.length > 0 && (
            <Card style={styles.desgloseCard}>
              <View style={styles.desgloseHeader}>
                <Icon name="list-outline" size={16} color={colors.ink} />
                <AppText variant="h2" style={{ marginLeft: spacing.sm }}>
                  Ingredientes aprovechados
                </AppText>
              </View>
              {data.desglose.map((item, idx) => (
                <View key={idx} style={styles.desgloseRow}>
                  <View style={styles.desgloseInfo}>
                    <AppText variant="captionStrong" numberOfLines={1}>
                      {item.nombre}
                    </AppText>
                    <AppText variant="micro" color="inkMuted">
                      {item.cantidad_total.toFixed(2)} {item.unidad} ·{' '}
                      {item.precio_unitario_medio.toFixed(2)} €/ud
                    </AppText>
                  </View>
                  <View style={styles.desgloseValor}>
                    <AppText variant="captionStrong" style={{ color: colors.success }}>
                      {item.valor_total.toFixed(2)} €
                    </AppText>
                  </View>
                </View>
              ))}
            </Card>
          )}

          {/* CTA importar ticket si no hay datos reales */}
          {!data.tiene_datos_reales && (
            <Card style={styles.ctaCard}>
              <View style={styles.ctaContent}>
                <Icon name="scan-outline" size={28} color={colors.brand} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <AppText variant="captionStrong">Activa el cálculo real</AppText>
                  <AppText
                    variant="micro"
                    color="inkMuted"
                    style={{ marginTop: 2, lineHeight: 18 }}
                  >
                    Importa el PDF de tu ticket de Mercadona y Marce calculará el ahorro exacto en
                    euros, no una estimación.
                  </AppText>
                </View>
              </View>
              <Button
                label="Importar ticket PDF"
                icon="document-attach-outline"
                variant="secondary"
                onPress={() => navigation.navigate('TicketImportPdf')}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          )}

          {/* Comparativa media española */}
          <View style={styles.referenceNote}>
            <Icon name="information-circle-outline" size={13} color={colors.inkFaint} />
            <AppText variant="micro" color="inkFaint" style={styles.referenceText}>
              Media española de desperdicio: 31 kg/persona/año (MAPA 2024). Coste medio comida
              casera: 3,50 €/comida (Ministerio de Consumo 2024).
            </AppText>
          </View>

          {/* Share CTA */}
          <Button
            label="Compartir mi ahorro"
            icon="share-social-outline"
            variant="secondary"
            onPress={handleCompartir}
            style={styles.shareButton}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  headerTitle: { flex: 1, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroMes: { textTransform: 'capitalize', marginBottom: spacing.sm },
  heroAmount: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  euroSymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.success,
    marginTop: 8,
  },
  heroNumber: { fontSize: 56, fontWeight: '800', color: colors.success, lineHeight: 60 },
  heroSubtitle: { textAlign: 'center', marginTop: spacing.sm },
  statsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { textAlign: 'center', lineHeight: 14 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  desgloseCard: { gap: spacing.sm },
  desgloseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  desgloseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  desgloseInfo: { flex: 1, gap: 2 },
  desgloseValor: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  ctaCard: { gap: spacing.sm },
  ctaContent: { flexDirection: 'row', alignItems: 'flex-start' },
  referenceNote: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    alignItems: 'flex-start',
  },
  referenceText: { flex: 1, lineHeight: 16 },
  shareButton: { marginTop: spacing.sm },
});
