import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PurchasesPackage } from 'react-native-purchases';
import { Screen } from '../components/ui/Screen';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { colors, radius, spacing } from '../theme/tokens';
import { usePurchasesStore } from '../state/purchasesStore';

export default function PaywallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { packages, loadPackages, purchasePackage, restorePurchases, isPremium } =
    usePurchasesStore();
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadPackages();
      setLoading(false);
    }
    init();
  }, [loadPackages]);

  // Si se vuelve premium en segundo plano o tras la compra, cerrar modal
  useEffect(() => {
    if (isPremium) {
      navigation.goBack();
    }
  }, [isPremium, navigation]);

  const handlePurchase = async (pack: PurchasesPackage) => {
    setPurchasing(true);
    const success = await purchasePackage(pack);
    setPurchasing(false);
    if (!success && !isPremium) {
      Alert.alert('Compra cancelada', 'No se ha podido procesar la suscripción.');
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    const success = await restorePurchases();
    setPurchasing(false);
    if (success) {
      Alert.alert('Éxito', 'Compras restauradas correctamente.');
    } else {
      Alert.alert('Error', 'No se han encontrado compras previas para restaurar.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton name="close" size={24} color={colors.ink} onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AppText variant="display" style={styles.title}>
            AsistenteHogar Pro
          </AppText>
          <AppText variant="body" color="inkFaint" style={styles.subtitle}>
            Desbloquea todo el poder de la Inteligencia Artificial y ahorra tiempo en tu día a día.
          </AppText>
        </View>

        <View style={styles.featuresList}>
          <FeatureItem icon="sparkles" text="Plan de comidas semanal generado por IA" />
          <FeatureItem icon="fast-food" text="Categorización automática de despensa" />
          <FeatureItem icon="chatbubbles" text="Añadir tareas en lenguaje natural" />
          <FeatureItem icon="infinite" text="Límites extendidos de inteligencia artificial" />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginVertical: 30 }} />
        ) : (
          <View style={styles.packagesContainer}>
            {packages.map((pack) => (
              <View key={pack.identifier} style={styles.packageCard}>
                <View style={styles.packageInfo}>
                  <AppText variant="h2">{pack.product.title}</AppText>
                  <AppText variant="body" color="inkFaint">
                    {pack.product.description}
                  </AppText>
                </View>
                <Button
                  label={pack.product.priceString}
                  onPress={() => handlePurchase(pack)}
                  loading={purchasing}
                  style={styles.buyButton}
                />
              </View>
            ))}
            {packages.length === 0 && (
              <AppText variant="body" color={colors.danger} style={{ textAlign: 'center' }}>
                No hay suscripciones disponibles en este momento.
              </AppText>
            )}
          </View>
        )}

        <Button
          label="Restaurar compras"
          variant="secondary"
          onPress={handleRestore}
          loading={purchasing}
          style={styles.restoreButton}
        />
      </ScrollView>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.featureItem}>
      <IconButton
        name={icon}
        size={24}
        color={colors.brand}
        bg={colors.brandSoft}
        onPress={() => {}}
      />
      <AppText variant="body" style={styles.featureText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    color: colors.brand,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  featuresList: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featureText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  packagesContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  packageCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  buyButton: {
    minWidth: 100,
  },
  restoreButton: {
    marginTop: spacing.sm,
  },
});
