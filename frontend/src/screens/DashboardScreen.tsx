import React from 'react';
import { View, Alert, Pressable } from 'react-native';
import { useDashboard } from '../hooks/useDashboard';
import { useTasks } from '../hooks/useTasks';
import { TareaItem } from '../types/types';
import { getDiasParaCaducar } from '../hooks/usePantry';
import { useAuthStore } from '../state/authStore';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';
import { colors, radius, spacing } from '../theme/tokens';
import {
  Screen,
  Card,
  IconButton,
  Badge,
  AppText,
  Icon,
  FoodIcon,
  Button,
  LoadingView,
  ErrorView,
} from '../components/ui';
import { getCategoriaIcon } from '../lib/categoria';
import { haptics } from '../lib/haptics';

function formatHora(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatFechaCorta(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function DashboardScreen() {
  const { loading, briefing, error, refetch: refetchDashboard } = useDashboard();
  const { tasks, isLoading: tasksLoading, error: tasksError, toggleTaskStatus, refetch: refetchTasks } = useTasks();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar la sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => { logout(); } },
    ]);
  };

  const refetch = () => {
    refetchDashboard();
    refetchTasks();
  };

  if (loading) return <LoadingView message="Generando briefing del hogar..." />;
  if (error) return <ErrorView message={error} onRetry={refetch} />;

  const handleToggleTask = (tarea: TareaItem) => {
    Alert.alert('Confirmar tarea', `¿Deseas marcar la tarea "${tarea.nombre}" como completada?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            haptics.success();
            await toggleTaskStatus(tarea.id, tarea.estado);
          } catch (err: any) {
            Alert.alert('Error de Sincronización', err.message || 'No se pudo actualizar el estado de la tarea.');
          }
        },
      },
    ]);
  };

  const eventos = briefing?.eventos_hoy ?? [];
  const pendientes = tasks.filter((t) => t.estado === 'pendiente');
  const alertas = briefing?.alertas_despensa?.alertas_caducidad ?? [];

  return (
    <Screen refreshing={loading} onRefresh={refetch}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="home" size={22} color={colors.white} />
          </View>
          <View>
            <AppText variant="caption" color={colors.inkMuted}>Hola,</AppText>
            <AppText variant="h2">{usuario?.nombre || 'Hogar'}</AppText>
          </View>
        </View>
        <IconButton name="person-circle-outline" size={26} color={colors.inkMuted} bg={colors.card} diameter={44} onPress={handleLogout} accessibilityLabel="Cerrar sesión" />
      </View>

      {/* Briefing */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="sunny" size={18} color={colors.warning} />
            <AppText variant="h2">Informe de la mañana</AppText>
          </View>
        </View>
        <AppText variant="micro" color={colors.inkFaint} style={{ textTransform: 'capitalize', marginBottom: spacing.md }}>
          {formatFechaCorta(briefing?.fecha)}
        </AppText>

        {briefing?.briefing_texto ? (
          <View style={{ marginBottom: spacing.md }}>
            <View style={{ backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm }}>
              <AppText variant="caption" color={colors.ink} style={{ lineHeight: 20 }}>{briefing.briefing_texto}</AppText>
            </View>
            {/* Transparencia IA (EU AI Act): solo si el texto proviene del modelo, no del fallback */}
            {briefing.briefing_generado_por_ia ? <AIDisclaimerBanner /> : null}
          </View>
        ) : null}

        {/* Eventos de hoy */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <AppText variant="captionStrong">Eventos hoy</AppText>
          <Badge label={`${eventos.length}`} icon="calendar-outline" color={colors.calendar} bg={colors.calendarSoft} />
        </View>
        {eventos.length > 0 ? (
          eventos.map((evento) => (
            <View key={evento.id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm }}>
              <AppText variant="captionStrong" color={colors.calendar} style={{ width: 44, paddingTop: 1 }}>{formatHora(evento.fecha_inicio)}</AppText>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.calendar, marginTop: 5, marginRight: spacing.md }} />
              <View style={{ flex: 1 }}>
                <AppText variant="captionStrong" numberOfLines={1}>{evento.titulo}</AppText>
                <AppText variant="micro" color={colors.inkMuted} numberOfLines={1}>{evento.descripcion || 'Sin descripción'}</AppText>
              </View>
            </View>
          ))
        ) : (
          <AppText variant="caption" color={colors.inkFaint} style={{ paddingVertical: spacing.sm }}>No hay eventos programados para hoy.</AppText>
        )}
      </Card>

      {/* Tareas pendientes */}
      <Card tint={colors.tasksSoft} borderColor="#FBE7BE" style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
          <Icon name="flash" size={16} color={colors.tasks} />
          <AppText variant="captionStrong" color="#B45309">Tareas pendientes</AppText>
        </View>
        {tasksError ? <AppText variant="micro" color={colors.danger} style={{ marginBottom: spacing.sm }}>{tasksError}</AppText> : null}
        {pendientes.length > 0 ? (
          pendientes.map((tarea) => (
            <Pressable
              key={tarea.id}
              onPress={() => handleToggleTask(tarea)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
              accessibilityLabel={`Marcar tarea ${tarea.nombre} como completada`}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}
            >
              <AppText variant="caption" color="#92400E" style={{ flex: 1, marginRight: spacing.sm }} numberOfLines={1}>
                {tarea.nombre}{tarea.asignado_a ? ` · ${tarea.asignado_a}` : ''}
              </AppText>
              <View style={{ width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: '#FBD38D', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }} />
            </Pressable>
          ))
        ) : (
          <AppText variant="caption" color="#92400E">No hay tareas pendientes. ¡Buen trabajo!</AppText>
        )}
      </Card>

      {/* Alertas de la despensa */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="alert-circle" size={16} color={colors.pantry} />
            <AppText variant="h2">Despensa</AppText>
          </View>
          <Badge label={`${alertas.length}`} color={colors.pantry} bg={colors.pantrySoft} />
        </View>
        {alertas.length > 0 ? (
          alertas.map((item) => {
            const dias = getDiasParaCaducar(item.fecha_caducidad);
            const isUrgent = dias !== null && dias <= 2;
            return (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md }}>
                  <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.pantrySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <FoodIcon name={getCategoriaIcon(item.categoria)} size={20} color={colors.pantry} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="captionStrong" numberOfLines={1}>{item.nombre}</AppText>
                    <AppText variant="micro" color={colors.inkMuted}>
                      {dias !== null ? `Caduca en ${dias} día(s)` : 'Sin caducidad'} · {item.cantidad} {item.unidad}
                    </AppText>
                  </View>
                </View>
                {isUrgent ? <Badge label="Usar pronto" color={colors.danger} bg={colors.dangerSoft} icon="time-outline" /> : null}
              </View>
            );
          })
        ) : (
          <AppText variant="caption" color={colors.inkFaint} style={{ paddingVertical: spacing.sm }}>No hay alertas de caducidad en la despensa.</AppText>
        )}
      </Card>

      <Button label="Actualizar briefing" icon="refresh" variant="secondary" onPress={refetch} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
