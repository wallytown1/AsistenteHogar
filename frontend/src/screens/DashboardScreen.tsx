import React, { useEffect, useState } from 'react';
import { View, Pressable, Image, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useDashboard } from '../hooks/useDashboard';
import { getDiasParaCaducar } from '../hooks/usePantry';
import { getSemaforoCaducidad } from '../lib/caducidad';
import { useAuthStore } from '../state/authStore';
import { usePurchasesStore } from '../state/purchasesStore';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';
import { colors, radius, spacing } from '../theme/tokens';
import { Screen, AppText, Icon, FoodIcon, Button } from '../components/ui';
import { DashboardBriefingSkeleton } from '../components/skeletons';
import { getCategoriaIcon } from '../lib/categoria';
import { FadeInView } from '../animations';
import { apiRequest, TIMEOUT } from '../api/api';
import { AhorroPreviewResponse } from '../types/types';

// Intentamos cargar el asset de Marce en tiempo de ejecución.
// Si el archivo no existe todavía (pre-generación Higgsfield), Metro lanzará
// un error en el require; lo capturamos para usar el placeholder "M".
let MARCE_AVATAR: number | null = null;
try {
  MARCE_AVATAR = require('../../assets/marce-avatar.png') as number;
} catch {
  MARCE_AVATAR = null;
}

type NavProp = NativeStackNavigationProp<{
  PlanComidas: undefined;
  Historial: undefined;
  Paywall: { motivo?: string } | undefined;
  Ahorro: undefined;
}>;

// ---------------------------------------------------------------------------
// Hook ahorro preview
// ---------------------------------------------------------------------------
function useAhorroPreview() {
  return useQuery({
    queryKey: ['ahorro', 'preview'],
    queryFn: () =>
      apiRequest<AhorroPreviewResponse>('/ahorro/resumen/preview', { timeoutMs: TIMEOUT.DEFAULT }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// formatFechaCorta
// ---------------------------------------------------------------------------
function formatFechaCorta(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------------------
// Stat mini-card
// ---------------------------------------------------------------------------
function StatMiniCard({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText
        variant="display"
        style={{ fontSize: 22, fontWeight: '800', color: colors.brand, lineHeight: 26 }}
      >
        {value}
      </AppText>
      <AppText
        variant="micro"
        color={colors.inkMuted}
        style={{ textAlign: 'center', marginTop: 2 }}
      >
        {label}
      </AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ahorro Preview Card (motor de conversión)
// ---------------------------------------------------------------------------
function AhorroPreviewCard({ isPremium }: { isPremium: boolean }) {
  const navigation = useNavigation<NavProp>();
  const { data } = useAhorroPreview();

  const ahorro = data?.ahorro_estimado_eur ?? 0;
  const recetas = data?.recetas_cocinadas ?? 0;
  const tieneAhorro = ahorro > 0;

  const handlePress = () => {
    if (isPremium) {
      navigation.navigate('Ahorro');
      return;
    }
    const motivo = tieneAhorro
      ? `Has aprovechado ~${ahorro.toFixed(0)} € este mes. Desbloquea el informe completo y tu proyección de ahorro anual.`
      : undefined;
    navigation.navigate('Paywall', motivo ? { motivo } : undefined);
  };

  const subtitle = isPremium
    ? recetas > 0
      ? `${recetas} receta${recetas === 1 ? '' : 's'} · ~${ahorro.toFixed(0)} € est. cocinado este mes`
      : 'Sin recetas cocinadas este mes'
    : tieneAhorro
      ? `Has aprovechado ~${ahorro.toFixed(0)} € este mes · desbloquea el informe completo`
      : 'Mide en € lo que aprovechas y deja de tirar comida';

  const cta = isPremium ? null : tieneAhorro ? 'Ver mi ahorro real' : 'Probar gratis';

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={isPremium ? 'Ver informe de ahorro' : 'Desbloquear el informe de ahorro'}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: isPremium ? colors.border : colors.success,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.successSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="leaf-outline" size={20} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            {/* Número de ahorro bloqueado o real */}
            {tieneAhorro && !isPremium ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                accessibilityLabel="Ahorro estimado bloqueado, desbloquea con premium"
              >
                <View>
                  <AppText
                    variant="display"
                    accessibilityElementsHidden={true}
                    importantForAccessibility="no"
                    style={{
                      fontSize: 24,
                      fontWeight: '800',
                      color: colors.success,
                      opacity: 0.3,
                    }}
                  >
                    ~{ahorro.toFixed(0)} €
                  </AppText>
                </View>
                <Icon name="lock-closed-outline" size={16} color={colors.success} />
              </View>
            ) : (
              <AppText variant="captionStrong">Informe de Ahorro</AppText>
            )}
            <AppText variant="micro" color={colors.inkFaint}>
              {subtitle}
            </AppText>
          </View>
        </View>
        <Icon
          name={isPremium ? 'chevron-forward' : 'lock-closed-outline'}
          size={18}
          color={isPremium ? colors.inkFaint : colors.success}
        />
      </View>

      {cta ? (
        <View
          style={{
            marginTop: spacing.md,
            alignSelf: 'flex-start',
            backgroundColor: colors.successSoft,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          <Icon name="sparkles" size={13} color={colors.success} />
          <AppText variant="micro" style={{ color: colors.success, fontWeight: '700' }}>
            {cta}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function DashboardScreen() {
  const { loading, briefing, error, refetch } = useDashboard();
  const usuario = useAuthStore((s) => s.usuario);
  const navigation = useNavigation<NavProp>();
  const isFamilia = usePurchasesStore((s) => s.isFamilia);
  const isPremium = usePurchasesStore((s) => s.isPremium);
  const { data: ahorroData } = useAhorroPreview();

  const alertas = briefing?.alertas_despensa?.alertas_caducidad ?? [];
  const totalProductos = briefing?.alertas_despensa?.items_disponibles;
  const recetasCocinadas = ahorroData?.recetas_cocinadas;
  const ahorroEur = ahorroData?.ahorro_estimado_eur ?? 0;

  // -------------------------------------------------------------------
  // Marce avatar — fallback "M" si el asset no existe aún
  // -------------------------------------------------------------------
  const [avatarError, setAvatarError] = useState(false);
  const showPlaceholder = MARCE_AVATAR === null || avatarError;

  // -------------------------------------------------------------------
  // Marce breathing animation
  // -------------------------------------------------------------------
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedAvatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // -------------------------------------------------------------------
  // Saludo por hora del día
  // -------------------------------------------------------------------
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <Screen refreshing={loading} onRefresh={refetch}>
      {/* ================================================================
          HERO — Avatar Marce + saludo + speech bubble
      ================================================================ */}
      <FadeInView delay={0}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          {/* Avatar animado de Marce */}
          <Animated.View style={animatedAvatarStyle}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                borderWidth: 3,
                borderColor: colors.white,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#3D2B1A',
                shadowOpacity: 0.18,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                overflow: 'hidden',
              }}
            >
              {showPlaceholder ? (
                // Placeholder circular con inicial "M" hasta que el asset esté listo
                <AppText
                  variant="display"
                  style={{ fontSize: 28, fontWeight: '800', color: colors.white }}
                >
                  M
                </AppText>
              ) : (
                <Image
                  source={MARCE_AVATAR as number}
                  style={{ width: 72, height: 72 }}
                  onError={() => setAvatarError(true)}
                />
              )}
            </View>
          </Animated.View>

          {/* Saludo + fecha */}
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={colors.inkMuted} style={{ marginBottom: 1 }}>
              {saludo},
            </AppText>
            <AppText variant="h2" style={{ marginBottom: spacing.xs }}>
              {usuario?.nombre || 'Hogar'}
            </AppText>
            <AppText
              variant="micro"
              color={colors.inkFaint}
              style={{ textTransform: 'capitalize' }}
            >
              {formatFechaCorta(briefing?.fecha)}
            </AppText>
          </View>
        </View>

        {/* Speech bubble del briefing de Marce */}
        <View
          style={{
            backgroundColor: colors.cardAlt,
            borderRadius: radius.lg,
            padding: spacing.xl,
            marginBottom: spacing.xs,
            // Triángulo apuntando hacia el avatar (arriba-izquierda)
            position: 'relative',
          }}
        >
          {/* Triángulo decorativo */}
          <View
            style={{
              position: 'absolute',
              top: -7,
              left: 30,
              width: 16,
              height: 16,
              backgroundColor: colors.cardAlt,
              transform: [{ rotate: '45deg' }],
            }}
          />

          {loading && !briefing ? (
            <DashboardBriefingSkeleton />
          ) : error && !briefing ? (
            <View style={{ paddingVertical: spacing.sm, alignItems: 'center' }}>
              <AppText
                variant="caption"
                color={colors.danger}
                style={{ textAlign: 'center', marginBottom: spacing.sm }}
              >
                {error}
              </AppText>
              <Button label="Reintentar" variant="secondary" onPress={refetch} />
            </View>
          ) : briefing?.briefing_texto ? (
            <View style={{ gap: spacing.md }}>
              {briefing.briefing_texto.split('\n').map((parrafo, index) => {
                const textoLimpio = parrafo.trim();
                if (!textoLimpio) return null;
                return (
                  <AppText
                    key={index}
                    variant="caption"
                    color={colors.ink}
                    style={{ lineHeight: 22, fontSize: 15 }}
                  >
                    {textoLimpio}
                  </AppText>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Transparencia IA (EU AI Act) */}
        {briefing?.briefing_generado_por_ia ? <AIDisclaimerBanner /> : null}
      </FadeInView>

      {/* ================================================================
          STATS STRIP — 3 cifras clave
      ================================================================ */}
      <FadeInView delay={80}>
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.xl,
            marginBottom: spacing.xl,
          }}
        >
          <StatMiniCard
            value={totalProductos != null ? String(totalProductos) : '—'}
            label={'productos\nen despensa'}
          />
          <StatMiniCard
            value={recetasCocinadas != null ? String(recetasCocinadas) : '—'}
            label={'recetas\neste mes'}
          />
          <StatMiniCard
            value={isPremium && ahorroEur > 0 ? `${ahorroEur.toFixed(0)} €` : '—'}
            label={'ahorro\nestimado'}
          />
        </View>
      </FadeInView>

      {/* ================================================================
          ALERTAS CADUCIDAD — chips horizontales scrollables
      ================================================================ */}
      {alertas.length > 0 ? (
        <FadeInView delay={140}>
          <View style={{ marginBottom: spacing.xl }}>
            {/* Cabecera */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginBottom: spacing.md,
              }}
            >
              <Icon name="alert-circle" size={16} color={colors.warning} />
              <AppText variant="h2">Caduca pronto</AppText>
              <View
                style={{
                  backgroundColor: colors.warningSoft,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                }}
              >
                <AppText variant="micro" style={{ color: colors.warning, fontWeight: '700' }}>
                  {alertas.length}
                </AppText>
              </View>
            </View>

            {/* Chips en scroll horizontal */}
            <FlatList
              data={alertas.slice(0, 10)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
              renderItem={({ item }) => {
                const dias = getDiasParaCaducar(item.fecha_caducidad);
                const semaforo = getSemaforoCaducidad(dias);
                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      backgroundColor: semaforo.colorSoft,
                      borderRadius: radius.pill,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                      borderWidth: 1,
                      borderColor: semaforo.color + '33',
                    }}
                  >
                    <FoodIcon
                      name={getCategoriaIcon(item.categoria)}
                      size={14}
                      color={semaforo.color}
                    />
                    <AppText
                      variant="micro"
                      style={{ color: semaforo.color, fontWeight: '700', maxWidth: 90 }}
                      numberOfLines={1}
                    >
                      {item.nombre}
                    </AppText>
                    <AppText variant="micro" style={{ color: semaforo.color, opacity: 0.75 }}>
                      {dias != null ? `${dias}d` : '?'}
                    </AppText>
                  </View>
                );
              }}
            />
          </View>
        </FadeInView>
      ) : null}

      {/* ================================================================
          INFORME DE AHORRO — motor de conversión
      ================================================================ */}
      <FadeInView delay={200}>
        <View style={{ marginBottom: spacing.xl }}>
          <AhorroPreviewCard isPremium={isPremium} />
        </View>
      </FadeInView>

      {/* ================================================================
          QUICK ACTIONS — 2 columnas estilo launcher
      ================================================================ */}
      <FadeInView delay={260}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {/* Plan de la semana */}
          <Pressable
            onPress={() => navigation.navigate(isFamilia ? 'PlanComidas' : 'Paywall')}
            accessibilityLabel={
              isFamilia ? 'Ver plan de la semana' : 'Plan de la semana, requiere plan Familia'
            }
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              paddingVertical: spacing.xl,
              paddingHorizontal: spacing.md,
              alignItems: 'center',
              gap: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.md,
                backgroundColor: colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="calendar" size={26} color={colors.brand} />
            </View>
            <AppText variant="captionStrong" style={{ textAlign: 'center' }}>
              Plan de la semana
            </AppText>
            <AppText variant="micro" color={colors.inkFaint} style={{ textAlign: 'center' }}>
              {isFamilia ? 'Menú diario' : 'Plan Familia'}
            </AppText>
            {!isFamilia ? (
              <View
                style={{
                  position: 'absolute',
                  top: spacing.md,
                  right: spacing.md,
                }}
              >
                <Icon name="lock-closed-outline" size={13} color={colors.inkFaint} />
              </View>
            ) : null}
          </Pressable>

          {/* Historial de recetas */}
          <Pressable
            onPress={() => navigation.navigate('Historial')}
            accessibilityLabel="Ver historial de recetas"
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              paddingVertical: spacing.xl,
              paddingHorizontal: spacing.md,
              alignItems: 'center',
              gap: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.md,
                backgroundColor: colors.pantrySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="book-outline" size={26} color={colors.pantry} />
            </View>
            <AppText variant="captionStrong" style={{ textAlign: 'center' }}>
              Historial
            </AppText>
            <AppText variant="micro" color={colors.inkFaint} style={{ textAlign: 'center' }}>
              Cocinadas y rechazadas
            </AppText>
          </Pressable>
        </View>
      </FadeInView>
    </Screen>
  );
}
