import React from 'react';
import { View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useDashboard } from '../hooks/useDashboard';
import { getDiasParaCaducar } from '../hooks/usePantry';
import { getSemaforoCaducidad } from '../lib/caducidad';
import { useAuthStore } from '../state/authStore';
import { usePurchasesStore } from '../state/purchasesStore';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';
import { colors, radius, spacing } from '../theme/tokens';
import { Screen, Card, Badge, AppText, Icon, FoodIcon, Button } from '../components/ui';
import { DashboardBriefingSkeleton } from '../components/skeletons';
import { getCategoriaIcon } from '../lib/categoria';
import { FadeInView } from '../animations';
import { apiRequest, TIMEOUT } from '../api/api';
import { AhorroPreviewResponse } from '../types/types';

type NavProp = NativeStackNavigationProp<{
  PlanComidas: undefined;
  Historial: undefined;
  Paywall: { motivo?: string } | undefined;
  Ahorro: undefined;
}>;

function useAhorroPreview() {
  return useQuery({
    queryKey: ['ahorro', 'preview'],
    queryFn: () =>
      apiRequest<AhorroPreviewResponse>('/ahorro/resumen/preview', { timeoutMs: TIMEOUT.DEFAULT }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

function AhorroPreviewCard({ isPremium }: { isPremium: boolean }) {
  const navigation = useNavigation<NavProp>();
  const { data } = useAhorroPreview();

  const ahorro = data?.ahorro_estimado_eur ?? 0;
  const recetas = data?.recetas_cocinadas ?? 0;
  const tieneAhorro = ahorro > 0;

  // Para usuarios NO premium, este teaser es el motor de conversión: enseña el
  // ahorro estimado gratis y dispara el paywall en el momento de valor, pasando
  // un motivo contextual para personalizar el encabezado del paywall.
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

  // Copy de valor para usuarios NO premium. Mantenemos honesto el "estimado".
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
        paddingVertical: spacing.lg,
        marginTop: spacing.xl,
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
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: colors.successSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="leaf-outline" size={18} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="captionStrong">Informe de Ahorro</AppText>
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

function formatFechaCorta(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function DashboardScreen() {
  const { loading, briefing, error, refetch } = useDashboard();
  const usuario = useAuthStore((s) => s.usuario);
  const navigation = useNavigation<NavProp>();
  const isFamilia = usePurchasesStore((s) => s.isFamilia);
  const isPremium = usePurchasesStore((s) => s.isPremium);

  const alertas = briefing?.alertas_despensa?.alertas_caducidad ?? [];

  return (
    <Screen refreshing={loading} onRefresh={refetch}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.lg,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="home" size={22} color={colors.white} />
          </View>
          <View>
            <AppText variant="caption" color={colors.inkMuted}>
              Hola,
            </AppText>
            <AppText variant="h2">{usuario?.nombre || 'Hogar'}</AppText>
          </View>
        </View>
      </View>

      {/* Briefing */}
      <FadeInView delay={0}>
        <Card style={{ marginBottom: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="sunny" size={18} color={colors.warning} />
              <AppText variant="h2">Informe de la mañana</AppText>
            </View>
          </View>

          {loading && !briefing ? (
            <DashboardBriefingSkeleton />
          ) : error && !briefing ? (
            <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <AppText
                variant="caption"
                color={colors.danger}
                style={{ textAlign: 'center', marginBottom: spacing.sm }}
              >
                {error}
              </AppText>
              <Button label="Reintentar" variant="secondary" onPress={refetch} />
            </View>
          ) : (
            <>
              <AppText
                variant="micro"
                color={colors.inkFaint}
                style={{ textTransform: 'capitalize', marginBottom: spacing.md }}
              >
                {formatFechaCorta(briefing?.fecha)}
              </AppText>

              {briefing?.briefing_texto ? (
                <View>
                  <View
                    style={{
                      backgroundColor: colors.cardAlt,
                      borderRadius: radius.lg,
                      padding: spacing.xl,
                      marginBottom: spacing.sm,
                      gap: spacing.md,
                    }}
                  >
                    <View style={{ alignSelf: 'center', marginBottom: spacing.xs }}>
                      <Icon name="sparkles" size={24} color={colors.brand} />
                    </View>
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
                  {/* Transparencia IA (EU AI Act): solo si el texto proviene del modelo, no del fallback */}
                  {briefing.briefing_generado_por_ia ? <AIDisclaimerBanner /> : null}
                </View>
              ) : null}
            </>
          )}
        </Card>
      </FadeInView>

      {/* Alertas de la despensa */}
      <FadeInView delay={120}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="alert-circle" size={16} color={colors.pantry} />
              <AppText variant="h2">Despensa</AppText>
            </View>
            <Badge label={`${alertas.length}`} color={colors.pantry} bg={colors.pantrySoft} />
          </View>
          {alertas.length > 0 ? (
            alertas.map((item) => {
              const dias = getDiasParaCaducar(item.fecha_caducidad);
              const semaforo = getSemaforoCaducidad(dias);
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 6,
                  }}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: radius.md,
                        backgroundColor: semaforo.colorSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FoodIcon
                        name={getCategoriaIcon(item.categoria)}
                        size={20}
                        color={semaforo.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="captionStrong" numberOfLines={1}>
                        {item.nombre}
                      </AppText>
                      <AppText variant="micro" color={colors.inkMuted}>
                        {dias !== null ? `Caduca en ${dias} día(s)` : 'Sin caducidad'} ·{' '}
                        {item.cantidad} {item.unidad}
                      </AppText>
                    </View>
                  </View>
                  <Badge
                    label={semaforo.etiqueta}
                    color={semaforo.color}
                    bg={semaforo.colorSoft}
                    icon="time-outline"
                  />
                </View>
              );
            })
          ) : (
            <AppText
              variant="caption"
              color={colors.inkFaint}
              style={{ paddingVertical: spacing.sm }}
            >
              No hay alertas de caducidad en la despensa.
            </AppText>
          )}
        </Card>
      </FadeInView>

      {/* Informe de Ahorro mensual — teaser de conversión para usuarios no premium */}
      <FadeInView delay={200}>
        <AhorroPreviewCard isPremium={isPremium} />
      </FadeInView>

      {/* Acceso al plan de la semana — exclusivo Familia */}
      <FadeInView delay={240}>
        <Pressable
          onPress={() => navigation.navigate(isFamilia ? 'PlanComidas' : 'Paywall')}
          accessibilityLabel="Ver plan de la semana"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            marginTop: spacing.xl,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="calendar" size={18} color={colors.brand} />
            </View>
            <View>
              <AppText variant="captionStrong">Plan de la semana</AppText>
              <AppText variant="micro" color={colors.inkFaint}>
                {isFamilia ? 'Menú diario de aprovechamiento' : 'Plan Familia · Desbloquear'}
              </AppText>
            </View>
          </View>
          <Icon
            name={isFamilia ? 'chevron-forward' : 'lock-closed-outline'}
            size={18}
            color={colors.inkFaint}
          />
        </Pressable>

        {/* Acceso al historial de recetas */}
        <Pressable
          onPress={() => navigation.navigate('Historial')}
          accessibilityLabel="Ver historial de recetas"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            marginTop: spacing.md,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: colors.pantrySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="book-outline" size={18} color={colors.pantry} />
            </View>
            <View>
              <AppText variant="captionStrong">Historial de recetas</AppText>
              <AppText variant="micro" color={colors.inkFaint}>
                Cocinadas y rechazadas
              </AppText>
            </View>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.inkFaint} />
        </Pressable>
      </FadeInView>
    </Screen>
  );
}
