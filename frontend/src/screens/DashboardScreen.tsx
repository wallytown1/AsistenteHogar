import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { useDashboard } from '../hooks/useDashboard';
import { useTasks } from '../hooks/useTasks';
import { TareaItem } from '../types/types';
import { getDiasParaCaducar } from '../hooks/usePantry';
import { useAuthStore } from '../state/authStore';

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
    Alert.alert(
      'Cerrar sesión',
      '¿Deseas cerrar la sesión en este dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: () => { logout(); } },
      ]
    );
  };

  const refetch = () => {
    refetchDashboard();
    refetchTasks();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#fafafa] justify-center items-center">
        <ActivityIndicator size="large" color="#000000" />
        <Text className="text-gray-500 mt-4 text-sm font-medium">Generando briefing del hogar...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-[#fafafa] justify-center items-center px-6">
        <Text className="text-red-500 text-center text-base mb-4 font-semibold">{error}</Text>
        <TouchableOpacity
          className="bg-black rounded-full px-6 py-3"
          onPress={refetch}
          accessibilityLabel="Reintentar carga del briefing"
        >
          <Text className="text-white font-bold">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleToggleTask = (tarea: TareaItem) => {
    Alert.alert(
      "Confirmar tarea",
      `¿Deseas marcar la tarea "${tarea.nombre}" como completada?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            try {
              await toggleTaskStatus(tarea.id, tarea.estado);
            } catch (err: any) {
              Alert.alert(
                "Error de Sincronización",
                err.message || "No se pudo actualizar el estado de la tarea."
              );
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-[#fafafa]" contentContainerStyle={{ paddingBottom: 100 }}>
      <View className="px-5 pt-14 pb-6">

        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-center gap-2">
            <View className="bg-black rounded-full p-2">
              <Text className="text-white text-base">🏠</Text>
            </View>
            <View>
              <Text className="text-gray-400 text-xs font-semibold">Buenos días,</Text>
              <Text className="text-black text-xl font-bold">{usuario?.nombre || 'Hogar'}</Text>
            </View>
          </View>
          <TouchableOpacity
            className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center"
            onPress={handleLogout}
            accessibilityLabel="Cerrar sesión"
          >
            <Text className="text-base">👤</Text>
          </TouchableOpacity>
        </View>

        {/* Tarjeta: Informe de la Mañana */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-black text-lg font-bold">Informe de la Mañana</Text>
            <Text className="text-gray-400 text-xs font-medium capitalize">{formatFechaCorta(briefing?.fecha)}</Text>
          </View>
          <Text className="text-gray-400 text-xs mb-4">Resumen rápido de tu hogar para hoy</Text>
          {briefing?.briefing_texto ? (
            <Text className="text-gray-700 text-xs leading-5 mb-4 p-4 bg-[#f8fafc] rounded-2xl border border-gray-100 font-medium">
              {briefing.briefing_texto}
            </Text>
          ) : null}

          {/* Eventos del día */}
          <View className="mb-2">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-black text-sm font-semibold">Eventos hoy</Text>
              <Text className="text-gray-400 text-xs">
                {briefing?.eventos_hoy?.length || 0} evento(s)
              </Text>
            </View>

            <View className="space-y-3">
              {briefing?.eventos_hoy && briefing.eventos_hoy.length > 0 ? (
                briefing.eventos_hoy.map((evento) => (
                  <View key={evento.id} className="flex-row items-start mb-2">
                    <Text className="text-gray-400 text-xs font-bold w-12 pt-0.5">
                      {formatHora(evento.fecha_inicio)}
                    </Text>
                    <View className="w-1.5 h-1.5 rounded-full bg-black mt-2 mr-3" />
                    <View className="flex-1">
                      <Text className="text-black text-xs font-bold">{evento.titulo}</Text>
                      <Text className="text-gray-500 text-[10px]">
                        {evento.descripcion || 'Sin descripción'}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-gray-400 text-xs py-2">No hay eventos programados para hoy.</Text>
              )}
            </View>
          </View>
        </View>

        {/* Tarjeta: Tareas Pendientes */}
        <View className="bg-[#fffbeb] border border-[#fde68a] rounded-3xl p-4 mb-4">
          <Text className="text-[#b45309] font-bold text-xs mb-2">⚡ Tareas pendientes</Text>
          {tasksError && (
            <Text className="text-red-700 text-[10px] mb-2 font-medium font-semibold">⚠️ {tasksError}</Text>
          )}
          {tasksLoading && tasks.length === 0 ? (
            <ActivityIndicator size="small" color="#b45309" />
          ) : tasks.filter(t => t.estado === 'pendiente').length > 0 ? (
            tasks.filter(t => t.estado === 'pendiente').map((tarea) => (
              <TouchableOpacity
                key={tarea.id}
                className="flex-row items-center justify-between mb-2"
                onPress={() => handleToggleTask(tarea)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={`Marcar tarea ${tarea.nombre} como completada`}
              >
                <Text className="text-[#92400e] text-[11px] leading-4 flex-1 mr-1">
                  • {tarea.nombre} {tarea.asignado_a ? `(${tarea.asignado_a})` : ''}
                </Text>
                <View className="w-4.5 h-4.5 rounded border border-[#fde68a] items-center justify-center bg-white shadow-sm">
                  <Text className="text-[#b45309] text-[9px] font-bold">☐</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-[#92400e] text-[11px]">No hay tareas pendientes.</Text>
          )}
        </View>

        {/* Tarjeta: Alertas de la Despensa */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-black text-base font-bold">Alertas de la despensa</Text>
            <Text className="text-gray-400 text-xs">
              {briefing?.alertas_despensa?.alertas_caducidad?.length || 0} artículos
            </Text>
          </View>

          <View className="space-y-4">
            {briefing?.alertas_despensa?.alertas_caducidad && briefing.alertas_despensa.alertas_caducidad.length > 0 ? (
              briefing.alertas_despensa.alertas_caducidad.map((item) => {
                const dias = getDiasParaCaducar(item.fecha_caducidad);
                const isUrgent = dias !== null && dias <= 2;
                return (
                  <View key={item.id} className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center flex-1">
                      <View className="w-10 h-10 rounded-xl overflow-hidden mr-3 bg-gray-100 items-center justify-center">
                        <Text className="text-lg">
                          {item.categoria === 'Lácteos' ? '🥛' : item.categoria === 'Carnes' ? '🥩' : '🥫'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-black text-xs font-bold">{item.nombre}</Text>
                        <Text className="text-gray-400 text-[10px]">
                          {dias !== null ? `Caduca en ${dias} día(s)` : 'Sin caducidad'} · Cantidad: {item.cantidad} {item.unidad}
                        </Text>
                      </View>
                    </View>
                    {isUrgent ? (
                      <View className="rounded-full px-3 py-1 bg-black">
                        <Text className="text-[10px] font-bold text-white">Usar pronto</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text className="text-gray-400 text-xs py-2">No hay alertas de caducidad en la despensa.</Text>
            )}
          </View>
        </View>

        {/* Botón de recarga general */}
        <TouchableOpacity
          className="mt-6 flex-row items-center justify-center bg-black rounded-full py-4 shadow-sm"
          onPress={refetch}
          accessibilityLabel="Actualizar briefing"
        >
          <Text className="text-white font-bold text-sm">↻  Actualizar briefing</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}
