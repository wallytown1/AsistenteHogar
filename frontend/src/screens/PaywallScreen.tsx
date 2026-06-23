import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PurchasesPackage, PACKAGE_TYPE, PurchasesStoreProduct } from 'react-native-purchases';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Icon } from '../components/ui';
import { colors, radius, spacing } from '../theme/tokens';
import { usePurchasesStore } from '../state/purchasesStore';

type TierKey = 'free' | 'premium' | 'familia';

interface TierConfig {
  key: TierKey;
  label: string;
  sublabel: string;
  color: string;
  colorSoft: string;
  badge?: string;
  features: string[];
}

const TIERS: TierConfig[] = [
  {
    key: 'free',
    label: 'Gratis',
    sublabel: 'Para siempre',
    color: colors.inkFaint,
    colorSoft: colors.cardAlt,
    features: [
      'OCR de tickets de compra',
      'Foto de nevera con IA',
      'Añadir por voz o texto IA',
      'Recetas del catálogo',
      'Chat con Marce (10/día)',
    ],
  },
  {
    key: 'premium',
    label: 'Premium',
    sublabel: 'Mensual',
    color: colors.brand,
    colorSoft: colors.brandSoft,
    badge: 'MÁS POPULAR',
    features: [
      'Informe de Ahorro mensual en € que tiras y aprovechas',
      'Proyección de tu ahorro anual',
      'Recetas IA personalizadas con lo que tienes',
      'Chat con Marce sin límites',
      'Todo lo del plan Gratis',
    ],
  },
  {
    key: 'familia',
    label: 'Familia',
    sublabel: 'Anual · mejor valor',
    color: colors.success,
    colorSoft: colors.successSoft,
    badge: 'MEJOR VALOR',
    features: [
      'Todo el Informe de Ahorro, incluido',
      'Plan semanal de comidas IA',
      'Perfiles individuales por miembro',
      'Personalización máxima',
      'Todo lo del plan Premium',
    ],
  },
];

// Traduce la unidad de periodo de RevenueCat (DAY/WEEK/MONTH/YEAR) a español.
function periodoUnitLabel(unit: string, n: number): string {
  const plural = n !== 1;
  switch (unit) {
    case 'DAY':
      return plural ? 'días' : 'día';
    case 'WEEK':
      return plural ? 'semanas' : 'semana';
    case 'MONTH':
      return plural ? 'meses' : 'mes';
    case 'YEAR':
      return plural ? 'años' : 'año';
    default:
      return '';
  }
}

// Devuelve el texto de oferta de introducción SOLO si RevenueCat la expone.
// Nunca inventa "gratis": el texto de prueba gratuita solo aparece si el precio
// de introducción es 0. La oferta real se configura en App Store Connect/RevenueCat.
function getIntroOfferText(product: PurchasesStoreProduct): string | null {
  const intro = product.introPrice;
  if (!intro) return null;

  const total = intro.periodNumberOfUnits * Math.max(intro.cycles, 1);
  const unidad = periodoUnitLabel(intro.periodUnit, total);
  if (!unidad) return null;

  // Prueba gratuita real (precio de introducción = 0).
  if (intro.price === 0) {
    return `${total} ${unidad} gratis, luego ${product.priceString}`;
  }
  // Precio de introducción reducido (no es gratis): lo mostramos como tal.
  return `${intro.priceString} los primeros ${total} ${unidad}, luego ${product.priceString}`;
}

type PaywallRouteParams = { motivo?: string };

export default function PaywallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<Record<string, PaywallRouteParams | undefined>, string>>();
  const motivo = route.params?.motivo;
  const packages = usePurchasesStore((s) => s.packages);
  const loadPackages = usePurchasesStore((s) => s.loadPackages);
  const purchasePackage = usePurchasesStore((s) => s.purchasePackage);
  const restorePurchases = usePurchasesStore((s) => s.restorePurchases);
  const isPremium = usePurchasesStore((s) => s.isPremium);
  const isFamilia = usePurchasesStore((s) => s.isFamilia);
  const [loading, setLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const busy = purchasingId !== null || restoring;

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadPackages();
      setLoading(false);
    }
    init();
  }, [loadPackages]);

  useEffect(() => {
    if (isFamilia) navigation.goBack();
  }, [isFamilia, navigation]);

  const premiumPack = packages.find(
    (p) =>
      p.packageType === PACKAGE_TYPE.MONTHLY ||
      p.identifier.includes('monthly') ||
      p.identifier.includes('premium')
  );
  const familiaPack = packages.find(
    (p) =>
      p.packageType === PACKAGE_TYPE.ANNUAL ||
      p.identifier.includes('annual') ||
      p.identifier.includes('familia')
  );

  const handlePurchase = async (pack: PurchasesPackage) => {
    setPurchasingId(pack.identifier);
    const success = await purchasePackage(pack);
    setPurchasingId(null);
    if (!success && !isPremium) {
      Alert.alert('Compra cancelada', 'No se ha podido procesar la suscripción.');
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const success = await restorePurchases();
    setRestoring(false);
    if (success) {
      Alert.alert('Éxito', 'Compras restauradas correctamente.');
    } else {
      Alert.alert('Sin compras', 'No se han encontrado compras previas para restaurar.');
    }
  };

  const currentTier: TierKey = isFamilia ? 'familia' : isPremium ? 'premium' : 'free';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton name="close" size={24} color={colors.ink} onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {motivo ? (
          <View style={styles.motivoBanner}>
            <Icon name="trending-up-outline" size={18} color={colors.success} />
            <AppText variant="captionStrong" style={{ flex: 1, color: colors.success }}>
              {motivo}
            </AppText>
          </View>
        ) : null}

        <AppText variant="display" style={styles.title}>
          {motivo ? 'Llévate el informe completo' : 'Elige tu plan'}
        </AppText>
        <AppText variant="body" color="inkFaint" style={styles.subtitle}>
          La IA para añadir stock es gratis. Premium convierte lo que cocinas en un Informe de
          Ahorro mensual en € y proyecta tu ahorro anual.
        </AppText>

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginVertical: 40 }} />
        ) : (
          <View style={styles.tiersContainer}>
            {TIERS.map((tier) => {
              const isCurrent = currentTier === tier.key;
              const pack =
                tier.key === 'premium' ? premiumPack : tier.key === 'familia' ? familiaPack : null;
              const price = pack ? pack.product.priceString : tier.key === 'free' ? 'Gratis' : null;

              // Oferta de prueba/introducción real (si RevenueCat la expone).
              const introText = pack ? getIntroOfferText(pack.product) : null;

              // Ancla de valor para el plan anual: precio mensual equivalente que
              // ofrece RevenueCat (pricePerMonthString). No inventamos cifras; si el
              // dato no está disponible en runtime, usamos un mensaje cualitativo.
              const anclaMensualAnual =
                tier.key === 'familia' && pack ? pack.product.pricePerMonthString : null;
              const anclaCualitativa =
                tier.key === 'familia' && !anclaMensualAnual
                  ? 'Paga una vez al año y ahorra frente al plan mensual'
                  : null;

              return (
                <View
                  key={tier.key}
                  style={[
                    styles.tierCard,
                    { borderColor: isCurrent ? tier.color : colors.border },
                    isCurrent && styles.tierCardActive,
                  ]}
                >
                  {tier.badge && (
                    <View style={[styles.badge, { backgroundColor: tier.color }]}>
                      <AppText variant="micro" style={{ color: '#fff', fontWeight: '700' }}>
                        {tier.badge}
                      </AppText>
                    </View>
                  )}

                  <View style={styles.tierHeader}>
                    <View style={[styles.tierDot, { backgroundColor: tier.colorSoft }]}>
                      <Icon
                        name={
                          tier.key === 'free'
                            ? 'leaf-outline'
                            : tier.key === 'premium'
                              ? 'sparkles'
                              : 'people'
                        }
                        size={18}
                        color={tier.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="h2" style={{ color: tier.color }}>
                        {tier.label}
                      </AppText>
                      <AppText variant="micro" color="inkFaint">
                        {tier.sublabel}
                      </AppText>
                    </View>
                    {price && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <AppText variant="captionStrong" style={{ color: tier.color }}>
                          {price}
                        </AppText>
                        {anclaMensualAnual ? (
                          <AppText variant="micro" color="inkFaint">
                            ≈ {anclaMensualAnual}/mes
                          </AppText>
                        ) : null}
                      </View>
                    )}
                  </View>

                  {anclaCualitativa ? (
                    <AppText
                      variant="micro"
                      style={{ color: tier.color, marginBottom: spacing.sm, fontWeight: '600' }}
                    >
                      {anclaCualitativa}
                    </AppText>
                  ) : null}

                  {introText ? (
                    <View style={[styles.introPill, { backgroundColor: tier.colorSoft }]}>
                      <Icon name="gift-outline" size={13} color={tier.color} />
                      <AppText variant="micro" style={{ color: tier.color, fontWeight: '700' }}>
                        {introText}
                      </AppText>
                    </View>
                  ) : null}

                  <View style={styles.featureList}>
                    {tier.features.map((f) => (
                      <View key={f} style={styles.featureRow}>
                        <Icon name="checkmark-circle" size={15} color={tier.color} />
                        <AppText variant="caption" style={styles.featureText}>
                          {f}
                        </AppText>
                      </View>
                    ))}
                  </View>

                  {isCurrent ? (
                    <View style={[styles.currentBadge, { borderColor: tier.color }]}>
                      <AppText variant="micro" style={{ color: tier.color, fontWeight: '700' }}>
                        Plan actual
                      </AppText>
                    </View>
                  ) : pack ? (
                    <Button
                      label={
                        introText && pack.product.introPrice?.price === 0
                          ? 'Empezar prueba gratis'
                          : `Suscribirse · ${pack.product.priceString}`
                      }
                      onPress={() => handlePurchase(pack)}
                      loading={purchasingId === pack.identifier}
                      disabled={busy && purchasingId !== pack.identifier}
                      style={{ marginTop: spacing.md }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <Button
          label="Restaurar compras"
          variant="secondary"
          onPress={handleRestore}
          loading={restoring}
          disabled={busy && !restoring}
          style={styles.restoreButton}
        />

        <AppText variant="micro" color="inkFaint" style={styles.legal}>
          Precios con IVA incluido, según la pantalla de compra. Las suscripciones son de pago
          recurrente y se renuevan automáticamente al final de cada periodo salvo que las canceles
          al menos 24 h antes, desde los ajustes de App Store o Google Play. El cobro lo gestiona la
          tienda de aplicaciones. Servicio para mayores de 14 años.
        </AppText>

        <View style={styles.legalLinks}>
          <AppText
            variant="micro"
            style={styles.legalLink}
            onPress={() => navigation.navigate('Legal', { documento: 'terminos' })}
          >
            Términos de Servicio
          </AppText>
          <AppText variant="micro" color="inkFaint">
            {'  ·  '}
          </AppText>
          <AppText
            variant="micro"
            style={styles.legalLink}
            onPress={() => navigation.navigate('Legal', { documento: 'privacidad' })}
          >
            Política de Privacidad
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  motivoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  introPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center', marginBottom: spacing.sm, marginTop: spacing.md },
  subtitle: { textAlign: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  tiersContainer: { gap: spacing.md },
  tierCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tierCardActive: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tierDot: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureList: { gap: spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { flex: 1 },
  currentBadge: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  restoreButton: { marginTop: spacing.xl },
  legal: { textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  legalLink: { color: colors.brand, fontWeight: '600' },
});
