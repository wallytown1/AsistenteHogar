import React from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';
import { useDashboard } from '../hooks/useDashboard';
import { getDiasParaCaducar } from '../hooks/usePantry';
import { getSemaforoCaducidad } from '../lib/caducidad';
import { useAuthStore } from '../state/authStore';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';
import { colors, radius, spacing } from '../theme/tokens';
import { Screen, Card, IconButton, Badge, AppText, Icon, FoodIcon, Button } from '../components/ui';
import { getCategoriaIcon } from '../lib/categoria';

function formatFechaCorta(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function DashboardScreen() {
  const { loading, briefing, error, refetch } = useDashboard();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar la sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  const alertas = briefing?.alertas_despensa?.alertas_caducidad ?? [];

  return (
    <Screen refreshing={loading} onRefresh={refetch}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
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
        <IconButton
          name="person-circle-outline"
          size={26}
          color={colors.inkMuted}
          bg={colors.card}
          diameter={44}
          onPress={handleLogout}
          accessibilityLabel="Cerrar sesión"
        />
      </View>

      {/* Briefing */}
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
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.brand} />
            <AppText variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.md }}>
              Redactando informe con IA...
            </AppText>
          </View>
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

      {/* Alertas de la despensa */}
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

      <Button
        label="Actualizar briefing"
        icon="refresh"
        variant="secondary"
        onPress={refetch}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}
