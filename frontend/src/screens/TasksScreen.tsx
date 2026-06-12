import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useTasks } from '../hooks/useTasks';
import { TareaItem } from '../types/types';

type FiltroEstado = 'todas' | 'pendiente' | 'completado';

const FRECUENCIAS = ['diaria', 'semanal', 'mensual', 'ocasional'];
const PRIORIDADES = ['alta', 'media', 'baja'];

function getPrioridadStyle(prioridad: string): { label: string; text: string; dot: string } {
  switch (prioridad) {
    case 'alta':
      return { label: 'Alta', text: 'text-red-600', dot: 'bg-red-600' };
    case 'baja':
      return { label: 'Baja', text: 'text-green-600', dot: 'bg-green-500' };
    default:
      return { label: 'Media', text: 'text-amber-500', dot: 'bg-amber-500' };
  }
}

function getFrecuenciaEmoji(frecuencia: string): string {
  const f = frecuencia.toLowerCase();
  if (f.includes('diaria')) return '☀️';
  if (f.includes('semanal')) return '📆';
  if (f.includes('mensual')) return '🗓️';
  return '🔁';
}

export default function TasksScreen() {
  const {
    tasks,
    isLoading,
    error,
    refetch,
    addTask,
    toggleTaskStatus,
    deleteTask
  } = useTasks();

  const [modalVisible, setModalVisible] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');

  // Formulario nueva tarea
  const [nombre, setNombre] = useState('');
  const [asignadoA, setAsignadoA] = useState('');
  const [frecuencia, setFrecuencia] = useState('semanal');
  const [prioridad, setPrioridad] = useState('media');

  const resetForm = () => {
    setNombre('');
    setAsignadoA('');
    setFrecuencia('semanal');
    setPrioridad('media');
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#fafafa] justify-center items-center">
        <ActivityIndicator size="large" color="#000000" />
        <Text className="text-gray-500 mt-4 text-sm font-medium">Cargando tareas del hogar...</Text>
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
          accessibilityLabel="Reintentar carga de tareas"
        >
          <Text className="text-white font-bold">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleAdd = () => {
    if (nombre.trim().length < 2) {
      Alert.alert('Campo requerido', 'El nombre de la tarea debe tener al menos 2 caracteres.');
      return;
    }

    // IA Pasiva - Confirmar creación manual del usuario
    Alert.alert(
      'Confirmar tarea',
      `¿Deseas crear la tarea "${nombre.trim()}"${asignadoA.trim() ? ` asignada a ${asignadoA.trim()}` : ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            try {
              await addTask(
                nombre.trim(),
                asignadoA.trim() || null,
                frecuencia,
                prioridad
              );
              setModalVisible(false);
              resetForm();
              Alert.alert('Éxito', 'La tarea ha sido registrada.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo crear la tarea.');
            }
          }
        }
      ]
    );
  };

  const handleToggle = (item: TareaItem) => {
    toggleTaskStatus(item.id, item.estado).catch((err: any) => {
      Alert.alert('Error', err.message || 'No se pudo actualizar la tarea.');
    });
  };

  const handleDelete = (item: TareaItem) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Deseas eliminar la tarea "${item.nombre}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          onPress: () => {
            deleteTask(item.id).catch((err: any) => {
              Alert.alert('Error', err.message || 'No se pudo eliminar la tarea.');
            });
          }
        }
      ]
    );
  };

  const tareasFiltradas = tasks.filter(t => {
    if (filtroEstado === 'todas') return true;
    return t.estado === filtroEstado;
  });

  const pendientes = tasks.filter(t => t.estado === 'pendiente').length;
  const completadas = tasks.filter(t => t.estado === 'completado').length;

  return (
    <View className="flex-1 bg-[#fafafa]">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 }}>

        {/* Cabecera */}
        <View className="flex-row justify-between items-center mb-5">
          <Text className="text-black text-xl font-bold">Tareas</Text>
        </View>

        {/* Bloque de Métricas */}
        <View className="flex-row gap-3 mb-5">
          <View className="flex-1 bg-white border border-gray-100 rounded-3xl p-4 shadow-sm items-center">
            <View className="flex-row justify-between items-center w-full mb-2">
              <Text className="text-gray-400 text-[10px] font-bold uppercase">Pendientes</Text>
              <Text className="text-base">⚡</Text>
            </View>
            <View className="w-16 h-16 rounded-full bg-black justify-center items-center mb-1">
              <Text className="text-white text-lg font-bold">{pendientes}</Text>
            </View>
            <Text className="text-black text-[10px] text-center font-bold">Tareas por completar</Text>
          </View>

          <View className="flex-1 bg-white border border-gray-100 rounded-3xl p-4 shadow-sm items-center">
            <View className="flex-row justify-between items-center w-full mb-2">
              <Text className="text-gray-400 text-[10px] font-bold uppercase">Completadas</Text>
              <Text className="text-base">✅</Text>
            </View>
            <View className="w-16 h-16 rounded-full bg-black justify-center items-center mb-1">
              <Text className="text-white text-lg font-bold">{completadas}</Text>
            </View>
            <Text className="text-black text-[10px] text-center font-bold">Tareas finalizadas</Text>
          </View>
        </View>

        {/* Filtros por estado */}
        <View className="flex-row gap-2 mb-5">
          {(['todas', 'pendiente', 'completado'] as FiltroEstado[]).map(f => {
            const activo = filtroEstado === f;
            const etiqueta = f === 'todas' ? 'Todas' : f === 'pendiente' ? 'Pendientes' : 'Completadas';
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFiltroEstado(f)}
                className={`flex-1 rounded-full py-2.5 items-center border ${activo ? 'bg-black border-black' : 'bg-white border-gray-200'}`}
              >
                <Text className={`text-xs font-bold ${activo ? 'text-white' : 'text-gray-500'}`}>{etiqueta}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Listado de tareas */}
        <View className="mb-6">
          {tareasFiltradas.length === 0 && (
            <View className="bg-white border border-gray-100 rounded-3xl p-8 items-center shadow-sm">
              <Text className="text-3xl mb-2">🧹</Text>
              <Text className="text-gray-400 text-xs font-medium text-center">
                {filtroEstado === 'todas'
                  ? 'No hay tareas registradas. Pulsa + para crear la primera.'
                  : 'No hay tareas en este estado.'}
              </Text>
            </View>
          )}

          {tareasFiltradas.map(item => {
            const completada = item.estado === 'completado';
            const prio = getPrioridadStyle(item.prioridad);

            return (
              <View key={item.id} className="bg-white border border-gray-100 rounded-3xl p-4 mb-3 shadow-sm flex-row items-center">

                {/* Checkbox completar */}
                <TouchableOpacity
                  onPress={() => handleToggle(item)}
                  className={`w-7 h-7 rounded-full mr-3 items-center justify-center border ${completada ? 'bg-black border-black' : 'bg-gray-50 border-gray-300'}`}
                  accessibilityLabel={completada ? 'Marcar como pendiente' : 'Marcar como completada'}
                >
                  {completada && <Text className="text-white text-xs font-bold">✓</Text>}
                </TouchableOpacity>

                {/* Detalles */}
                <View className="flex-1 mr-2">
                  <Text className={`text-xs font-bold ${completada ? 'text-gray-400 line-through' : 'text-black'}`}>
                    {item.nombre}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-gray-400 text-[10px]">
                      {getFrecuenciaEmoji(item.frecuencia)} {item.frecuencia}
                    </Text>
                    {item.asignado_a && (
                      <Text className="text-gray-400 text-[10px]"> · 👤 {item.asignado_a}</Text>
                    )}
                  </View>
                  <View className="flex-row items-center mt-1">
                    <View className={`w-1.5 h-1.5 rounded-full mr-1 ${prio.dot}`} />
                    <Text className={`text-[9px] font-bold ${prio.text}`}>Prioridad {prio.label}</Text>
                  </View>
                </View>

                {/* Botón eliminar */}
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  className="bg-gray-100 rounded-full w-7 h-7 items-center justify-center border border-gray-200"
                  accessibilityLabel="Eliminar tarea"
                >
                  <Text className="text-xs">🗑️</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

      </ScrollView>

      {/* FAB Añadir Tarea */}
      <TouchableOpacity
        className="absolute bottom-6 right-5 bg-black rounded-full w-14 h-14 justify-center items-center shadow-2xl"
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Añadir tarea"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </TouchableOpacity>

      {/* Modal Añadir Tarea */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-black text-lg font-bold mb-4">Nueva tarea</Text>
            <ScrollView>
              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Nombre *</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black mb-3 text-xs"
                placeholder="Ej: Sacar la basura"
                placeholderTextColor="#94a3b8"
                value={nombre}
                onChangeText={setNombre}
              />

              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Asignado a</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black mb-3 text-xs"
                placeholder="Ej: Mamá (opcional)"
                placeholderTextColor="#94a3b8"
                value={asignadoA}
                onChangeText={setAsignadoA}
              />

              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Frecuencia</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {FRECUENCIAS.map(f => {
                  const activo = frecuencia === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setFrecuencia(f)}
                      className={`rounded-full px-4 py-2 border ${activo ? 'bg-black border-black' : 'bg-white border-gray-200'}`}
                    >
                      <Text className={`text-xs font-bold capitalize ${activo ? 'text-white' : 'text-gray-500'}`}>{f}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Prioridad</Text>
              <View className="flex-row gap-2 mb-5">
                {PRIORIDADES.map(p => {
                  const activo = prioridad === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPrioridad(p)}
                      className={`flex-1 rounded-full py-2.5 items-center border ${activo ? 'bg-black border-black' : 'bg-white border-gray-200'}`}
                    >
                      <Text className={`text-xs font-bold capitalize ${activo ? 'text-white' : 'text-gray-500'}`}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                className="bg-black rounded-full py-4 items-center mb-3"
                onPress={handleAdd}
                accessibilityLabel="Confirmar nueva tarea"
              >
                <Text className="text-white font-bold text-sm">Crear tarea</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="items-center py-2"
                onPress={() => { setModalVisible(false); resetForm(); }}
                accessibilityLabel="Cancelar nueva tarea"
              >
                <Text className="text-gray-400 text-xs font-bold">Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}
