import React, { useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert
} from 'react-native';
import { useDashboard } from '../hooks/useDashboard';
import { useTasks } from '../hooks/useTasks';
import { TareaItem } from '../types/types';
import { getDiasParaCaducar } from '../hooks/usePantry';
import { Svg, Path } from 'react-native-svg';
import { useAuthStore } from '../state/authStore';

function formatHora(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function DashboardScreen() {
  const { loading, briefing, error, refetch: refetchDashboard } = useDashboard();
  const { tasks, isLoading: tasksLoading, error: tasksError, toggleTaskStatus, refetch: refetchTasks } = useTasks();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const [lucesEncendidas, setLucesEncendidas] = useState(true);
  const [temperaturaTermostato, setTemperaturaTermostato] = useState(21);

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

  // Manejo de interacciones con IA Pasiva
  const handleToggleLuces = () => {
    Alert.alert(
      "Confirmar acción",
      `¿Deseas ${lucesEncendidas ? 'apagar' : 'encender'} las luces del salón?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: () => setLucesEncendidas(!lucesEncendidas) }
      ]
    );
  };

  const handleReponer = (producto: string) => {
    Alert.alert(
      "Confirmar reabastecimiento",
      `¿Deseas agregar "${producto}" a la lista de compras del hogar?`,
      [
        { text: "No", style: "cancel" },
        { text: "Sí, agregar", onPress: () => Alert.alert("Lista actualizada", `Se ha solicitado reponer "${producto}".`) }
      ]
    );
  };

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
        
        {/* Header con estilo premium del mockup */}
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
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center"
              onPress={handleLogout}
              accessibilityLabel="Cerrar sesión"
            >
              <Text className="text-base">👤</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center">
              <Text className="text-base">🔔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta: Informe de la Mañana */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-black text-lg font-bold">Informe de la Mañana</Text>
            <Text className="text-gray-400 text-xs font-medium">Hoy · 08:15</Text>
          </View>
          <Text className="text-gray-400 text-xs mb-4">Resumen rápido de tu hogar para hoy</Text>
          {briefing?.briefing_texto ? (
            <Text className="text-gray-700 text-xs leading-5 mb-4 p-4 bg-[#f8fafc] rounded-2xl border border-gray-100 font-medium">
              {briefing.briefing_texto}
            </Text>
          ) : null}
          {/* Bloque de clima */}
          <View className="flex-row items-center bg-[#f8fafc] rounded-2xl p-4 mb-4">
            <View className="w-16 h-16 rounded-full overflow-hidden mr-4 bg-gray-200">
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=150' }} 
                className="w-full h-full"
              />
            </View>
            <View className="flex-1">
              <Text className="text-black text-lg font-bold">
                {briefing?.clima_temperatura || '22°C'} · {briefing?.clima_estado || 'Parcialmente nublado'}
              </Text>
              <Text className="text-gray-500 text-xs mt-0.5">Madrid · Viento 10 km/h · Humedad 58%</Text>
            </View>
          </View>

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

        {/* Fila de Tarjetas Pastel Contextuales (Doble columna) */}
        <View className="flex-row gap-3 mb-4">
          {/* Tareas Pendientes (Amarillo pastel) */}
          <View className="flex-1 bg-[#fffbeb] border border-[#fde68a] rounded-3xl p-4">
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

          {/* Seguridad Estado (Azul pastel) */}
          <View className="flex-1 bg-[#eff6ff] border border-[#bfdbfe] rounded-3xl p-4 justify-between">
            <View>
              <Text className="text-[#1e40af] font-bold text-xs mb-2">🛡️ Seguridad Estado</Text>
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-[#2563eb] text-[11px]">Puerta principal</Text>
                <Text className="text-black font-bold text-[11px]">Cerrada</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-[#2563eb] text-[11px]">Alarma</Text>
                <Text className="text-black font-bold text-[11px]">Armada (Modo Casa)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tarjeta: Consumo Energético */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4 shadow-sm">
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-black text-base font-bold">Consumo energético (últimas 24h)</Text>
            </View>
            <Text className="text-black text-base font-bold">8.2 kWh</Text>
          </View>
          
          {/* Gráfico minimalista vectorial con SVG */}
          <View className="h-20 w-full items-center justify-center my-2">
            <Svg height="100%" width="100%" viewBox="0 0 300 80">
              {/* Línea 1: Consumo proyectado (descendente) */}
              <Path
                d="M 10,45 C 50,48 90,58 130,62 C 170,66 210,74 290,78"
                fill="none"
                stroke="#000000"
                strokeWidth="2.5"
              />
              {/* Línea 2: Consumo real (ascendente y oscilante) */}
              <Path
                d="M 10,50 Q 35,47 60,49 T 110,44 T 160,45 T 210,42 T 260,43 T 290,40"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
            </Svg>
          </View>
        </View>

        {/* Tarjeta: Alertas de la Despensa */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4 shadow-sm">
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
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-xl overflow-hidden mr-3 bg-gray-100 items-center justify-center">
                        <Text className="text-lg">
                          {item.categoria === 'Lácteos' ? '🥛' : item.categoria === 'Carnes' ? '🥩' : '🥫'}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-black text-xs font-bold">{item.nombre}</Text>
                        <Text className="text-gray-400 text-[10px]">
                          {dias !== null ? `Caduca en ${dias} día(s)` : 'Sin caducidad'} · Cantidad: {item.cantidad} {item.unidad}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      onPress={() => handleReponer(item.nombre)}
                      className={`rounded-full px-3 py-1 ${isUrgent ? 'bg-black' : 'border border-black'}`}
                    >
                      <Text className={`text-[10px] font-bold ${isUrgent ? 'text-white' : 'text-black'}`}>
                        {isUrgent ? 'Usar pronto' : 'Reponer'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text className="text-gray-400 text-xs py-2">No hay alertas de caducidad en la despensa.</Text>
            )}
          </View>
        </View>

        {/* Domótica Grid (3 Columnas) */}
        <View className="flex-row gap-2 mb-4">
          {/* Luces */}
          <TouchableOpacity 
            onPress={handleToggleLuces}
            className="flex-1 bg-white border border-gray-100 rounded-3xl p-3 items-center justify-center shadow-sm"
          >
            <Text className="text-lg mb-1">💡</Text>
            <Text className="text-black text-[11px] font-bold">Luces</Text>
            <Text className="text-gray-400 text-[9px] mt-0.5">{lucesEncendidas ? 'Encendida' : 'Apagada'}</Text>
          </TouchableOpacity>

          {/* Termostato */}
          <View className="flex-1 bg-white border border-gray-100 rounded-3xl p-3 items-center justify-center shadow-sm">
            <Text className="text-lg mb-1">🌡️</Text>
            <Text className="text-black text-[11px] font-bold">Termostato</Text>
            <Text className="text-gray-600 text-[10px] font-bold mt-0.5">{temperaturaTermostato}°C</Text>
            
            {/* Slider de control simple simulación */}
            <View className="w-full h-1 bg-gray-200 rounded-full mt-2 relative justify-center">
              <TouchableOpacity 
                onPress={() => setTemperaturaTermostato(prev => Math.min(28, prev + 1))}
                className="absolute right-0 -top-2 w-4 h-4 bg-black rounded-full"
              />
              <TouchableOpacity 
                onPress={() => setTemperaturaTermostato(prev => Math.max(16, prev - 1))}
                className="absolute left-0 -top-2 w-4 h-4 bg-gray-400 rounded-full"
              />
            </View>
          </View>

          {/* Cámaras */}
          <TouchableOpacity 
            onPress={() => Alert.alert("Cámaras", "Cargando transmisiones de seguridad...")}
            className="flex-1 bg-white border border-gray-100 rounded-3xl p-3 items-center justify-center shadow-sm"
          >
            <Text className="text-lg mb-1">🎥</Text>
            <Text className="text-black text-[11px] font-bold">Cámaras</Text>
            <Text className="text-gray-400 text-[9px] mt-0.5">2 en línea</Text>
          </TouchableOpacity>
        </View>

        {/* Tarjeta: Notificaciones Recientes */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <Text className="text-black text-sm font-bold mb-3">Notificaciones recientes</Text>
          
          <View className="space-y-3">
            {/* Notif 1 */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Text className="text-base mr-3">🚪</Text>
                <View>
                  <Text className="text-black text-xs font-semibold">Puerta principal cerrada</Text>
                  <Text className="text-gray-400 text-[10px]">Hace 12 min</Text>
                </View>
              </View>
            </View>

            {/* Notif 2 */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Text className="text-base mr-3">🌀</Text>
                <View>
                  <Text className="text-black text-xs font-semibold">Lavadora: ciclo terminado</Text>
                  <Text className="text-gray-400 text-[10px]">Hace 45 min</Text>
                </View>
              </View>
            </View>

            {/* Notif 3 */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Text className="text-base mr-3">⚡</Text>
                <View>
                  <Text className="text-black text-xs font-semibold">Consumo eléctrico: pico a las 07:30</Text>
                  <Text className="text-gray-400 text-[10px]">Hace 2 horas</Text>
                </View>
              </View>
            </View>

            {/* Notif 4 */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="text-base mr-3">📦</Text>
                <View>
                  <Text className="text-black text-xs font-semibold">Paquetería disponible en la puerta</Text>
                  <Text className="text-gray-400 text-[10px]">Hace 3 horas</Text>
                </View>
              </View>
            </View>
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
