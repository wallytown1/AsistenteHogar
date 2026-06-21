import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PurchasesPackage, PACKAGE_TYPE } from 'react-native-purchases';
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
      'Despensa manual (CRUD)',
      'Briefing diario',
      'Recetas del catálogo',
      'Lista de la compra',
    ],
  },
  {
    key: 'premium',
    label: 'Premium',
    sublabel: 'Mensual',
    color: colors.brand,
    colorSoft: colors.brandSoft,
    features: [
      'Todo lo del plan Gratis',
      'Recetas IA personalizadas',
      'OCR de tickets de compra',
      'Añadir por audio o texto IA',
      'Foto de nevera con IA',
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
      'Todo lo del plan Premium',
      'Plan semanal de comidas IA',
      'Perfiles individuales por miembro',
      'Personalización máxima',
    ],
  },
];

export default function PaywallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
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
        <AppText variant="display" style={styles.title}>
          Elige tu plan
        </AppText>
        <AppText variant="body" color="inkFaint" style={styles.subtitle}>
          Desbloquea la IA para cocinar mejor con lo que tienes en casa.
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
                      <AppText variant="captionStrong" style={{ color: tier.color }}>
                        {price}
                      </AppText>
                    )}
                  </View>

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
                      label={`Suscribirse · ${pack.product.priceString}`}
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
          Los precios pueden variar por región. Las suscripciones se renuevan automáticamente.
          Puedes cancelar en cualquier momento desde los ajustes de tu cuenta.
        </AppText>
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
});
