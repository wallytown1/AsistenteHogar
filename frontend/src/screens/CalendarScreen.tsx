import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { useCalendar } from '../hooks/useCalendar';
import { EventoItem, ConflictoEvento } from '../types/types';

function formatHora(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const {
    eventos,
    conflictos,
    isLoading,
    error,
    addEvento,
    deleteEvento,
    refetch
  } = useCalendar();
  const [viewTab, setViewTab] = useState<'Día' | 'Semana' | 'Mes'>('Semana');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['Andrés', 'Sofía']);
  const [modalVisible, setModalVisible] = useState(false);
  const [conflictoModal, setConflictoModal] = useState<ConflictoEvento | null>(null);
  
  // States para crear evento rápido
  const [quickInput, setQuickInput] = useState('');
  
  // States para modal de creación detallada
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [participantes, setParticipantes] = useState('');

  const toggleMember = (member: string) => {
    setSelectedMembers(prev =>
      prev.includes(member) ? prev.filter(m => m !== member) : [...prev, member]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#fafafa] justify-center items-center">
        <ActivityIndicator size="large" color="#000000" />
        <Text className="text-gray-500 mt-4 text-sm font-medium">Cargando agenda familiar...</Text>
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
          accessibilityLabel="Reintentar carga de agenda"
        >
          <Text className="text-white font-bold">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleAdd = () => {
    if (!titulo.trim() || !horaInicio || !horaFin) {
      Alert.alert('Campos requeridos', 'El título, hora de inicio y fin son obligatorios.');
      return;
    }
    
    // IA Pasiva - Confirmar creación del evento
    Alert.alert(
      "Confirmar creación",
      `¿Deseas guardar el evento "${titulo}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: () => saveEvento(titulo, descripcion, horaInicio, horaFin, participantes) }
      ]
    );
  };

  const saveEvento = (t: string, desc: string, hIStr: string, hFStr: string, part: string, bypass = false) => {
    const hoy = new Date();
    const [hI, mI] = hIStr.split(':').map(Number);
    const [hF, mF] = hFStr.split(':').map(Number);
    const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), hI || 9, mI || 0).toISOString();
    const fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), hF || 10, mF || 0).toISOString();

    addEvento({
      titulo: t,
      descripcion: desc || null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      participantes: part ? part.split(',').map((p: string) => p.trim()).filter(Boolean) : null,
    }, bypass).then((conflicto) => {
      if (conflicto) {
        setConflictoModal(conflicto);
      } else {
        setModalVisible(false);
        setTitulo(''); setDescripcion(''); setHoraInicio(''); setHoraFin(''); setParticipantes('');
        Alert.alert("Éxito", "El evento se ha agregado correctamente.");
      }
    }).catch((err) => {
      Alert.alert("Error", err.message || "No se pudo agregar el evento.");
    });
  };

  const handleQuickAdd = () => {
    if (!quickInput.trim()) return;
    
    // Parseo rápido simulado
    const tituloSugerido = quickInput;
    Alert.alert(
      "Sugerencia de evento rápido",
      `¿Deseas crear el evento "${tituloSugerido}" hoy de 12:00 a 13:00?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: () => {
          saveEvento(tituloSugerido, "Evento rápido inteligente", "12:00", "13:00", "María");
          setQuickInput('');
        }}
      ]
    );
  };

  const handleReprogramar = () => {
    Alert.alert(
      "Propuesta de Reprogramación",
      "La IA sugiere mover 'Clases de piano' a las 09:30 (María disponible). ¿Aplicar cambio?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Aplicar cambio", onPress: () => Alert.alert("Agenda actualizada", "El evento se ha reprogramado exitosamente.") }
      ]
    );
  };

  // Miembros de la familia con sus avatares correspondientes
  const familyMembers = [
    { name: 'María', avatar: '👩', color: '#ec4899', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    { name: 'Andrés', avatar: '👨', color: '#3b82f6', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    { name: 'Sofía', avatar: '👧', color: '#10b981', photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100' },
  ];

  // Horas del calendario scannable
  const hours = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

  // Datos de los eventos del mockup
  const mockupEventos = [
    {
      id: 'mock-1',
      titulo: 'Cita con pediatra',
      hora: '09:00 – 09:30',
      responsable: 'Andrés',
      etiqueta: 'Salud',
      tipo: 'salud',
      avatarPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    },
    {
      id: 'mock-2',
      titulo: 'Clases de piano (Conflicto)',
      hora: '09:15 – 10:00',
      responsable: 'María',
      etiqueta: 'Actividades',
      tipo: 'conflicto',
      avatarPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    },
    {
      id: 'mock-3',
      titulo: 'Repartir tareas - Sacar la basura',
      hora: '11:00 – 11:15',
      responsable: 'Sofía',
      etiqueta: 'Conectado a tarea: Casa • Prioridad: Media',
      tipo: 'tarea',
      avatarPhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
    },
    {
      id: 'mock-4',
      titulo: 'Recordatorio: Comprar leche (Despensa baja)',
      hora: '14:00 – 14:05',
      responsable: 'Automático',
      etiqueta: 'Vinculado a: Despensa • Cantidad: 0.5L',
      tipo: 'recordatorio',
      avatarPhoto: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100', // abstracto
    }
  ];

  return (
    <View className="flex-1 bg-[#fafafa]">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 }}>
        
        {/* Cabecera del calendario */}
        <View className="mb-5">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-black text-2xl font-bold">Miércoles, 16 de junio</Text>
            <View className="flex-row gap-1">
              <TouchableOpacity className="bg-black rounded-full px-4 py-1.5 justify-center items-center">
                <Text className="text-white text-xs font-bold">Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-gray-100 rounded-full w-8 h-8 justify-center items-center border border-gray-200">
                <Text className="text-xs">⏳</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text className="text-gray-400 text-xs font-medium">
            Agenda combinada · 5 eventos · 1 conflicto
          </Text>
        </View>

        {/* Selector de Vistas (Día, Semana, Mes) */}
        <View className="flex-row bg-gray-100 p-1 rounded-full mb-5 self-start">
          {(['Día', 'Semana', 'Mes'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setViewTab(tab)}
              className={`rounded-full px-4 py-1.5 ${viewTab === tab ? 'bg-black' : 'bg-transparent'}`}
            >
              <Text className={`text-xs font-bold ${viewTab === tab ? 'text-white' : 'text-gray-500'}`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filtro por Miembros de la Familia con Avatares */}
        <View className="flex-row gap-2 mb-6 overflow-x-scroll pb-1">
          {familyMembers.map(member => {
            const isSelected = selectedMembers.includes(member.name);
            return (
              <TouchableOpacity
                key={member.name}
                onPress={() => toggleMember(member.name)}
                className={`flex-row items-center border rounded-full px-3 py-1.5 bg-white ${
                  isSelected ? 'border-gray-300' : 'border-gray-100'
                }`}
              >
                <View className="w-5 h-5 rounded-full border border-gray-300 mr-2 items-center justify-center bg-gray-50">
                  {isSelected && <View className="w-3 h-3 rounded-full bg-black" />}
                </View>
                <Image
                  source={{ uri: member.photo }}
                  className="w-6 h-6 rounded-full mr-2 bg-gray-200"
                />
                <Text className="text-black text-xs font-bold">{member.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Distribución Horaria Vertical */}
        <View className="mb-6">
          {hours.map((hour, index) => {
            const hourNumber = parseInt(hour.split(':')[0], 10);
            
            // Buscar eventos que comiencen en esta hora y que tengan algún participante seleccionado
            const eventAtHour = eventos.find((e) => {
              const d = new Date(e.fecha_inicio);
              if (d.getHours() !== hourNumber) return false;
              
              if (selectedMembers.length === 0) return true;
              if (!e.participantes || e.participantes.length === 0) return true;
              
              return e.participantes.some(p => selectedMembers.includes(p));
            });

            const hasConflict = eventAtHour && conflictos.some(
              (c) => c.evento_a.id === eventAtHour.id || c.evento_b.id === eventAtHour.id
            );
            const isHealth = eventAtHour && (eventAtHour.titulo.toLowerCase().includes('médico') || eventAtHour.titulo.toLowerCase().includes('dentista') || eventAtHour.titulo.toLowerCase().includes('pediatra'));
            const isTask = eventAtHour && (eventAtHour.titulo.toLowerCase().includes('tarea') || eventAtHour.titulo.toLowerCase().includes('basura') || eventAtHour.titulo.toLowerCase().includes('limpiar'));

            const cardBg = hasConflict 
              ? 'bg-[#fee2e2] border-[#fecaca]' 
              : isHealth 
              ? 'bg-[#e0f2fe] border-[#bae6fd]' 
              : isTask 
              ? 'bg-[#d1fae5] border-[#a7f3d0]' 
              : 'bg-[#fef3c7] border-[#fde68a]';

            const textColor = hasConflict 
              ? 'text-[#b91c1c]' 
              : isHealth 
              ? 'text-[#0369a1]' 
              : isTask 
              ? 'text-[#047857]' 
              : 'text-[#b45309]';

            return (
              <View key={hour} className="flex-row mb-4 min-h-[70px]">
                {/* Eje Horario */}
                <View className="w-14 items-start pt-1">
                  <Text className="text-gray-400 text-xs font-bold">{hour}</Text>
                </View>
                
                {/* Evento flotando al lado derecho */}
                <View className="flex-1">
                  {eventAtHour ? (
                    <View className={`rounded-3xl p-4 border relative ${cardBg}`}>
                      {/* Avatar del responsable */}
                      <View className="absolute right-4 top-4 flex-row gap-1">
                        {eventAtHour.participantes?.map((partName) => {
                          const m = familyMembers.find(fm => fm.name === partName);
                          return m ? (
                            <Image
                              key={partName}
                              source={{ uri: m.photo }}
                              className="w-6 h-6 rounded-full border border-white bg-gray-200"
                            />
                          ) : null;
                        })}
                      </View>

                      <View className="pr-12">
                        <Text className={`font-bold text-xs ${textColor}`}>
                          {eventAtHour.titulo}
                        </Text>
                        <Text className="text-gray-500 text-[10px] mt-0.5 font-semibold">
                          {formatHora(eventAtHour.fecha_inicio)} – {formatHora(eventAtHour.fecha_fin)}
                        </Text>
                        <Text className="text-gray-400 text-[9px] mt-1 font-medium">
                          {eventAtHour.descripcion || 'Sin descripción'}
                        </Text>
                      </View>
                      
                      {hasConflict && (
                        <Text className="text-red-600 text-[9px] mt-2 font-bold leading-4">
                          Conflicto detectado: Colisión horaria en la agenda. Sugerencia disponible abajo.
                        </Text>
                      )}

                      {/* Botón rápido para borrar */}
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert(
                            "Confirmar eliminación",
                            `¿Deseas eliminar "${eventAtHour.titulo}" del calendario?`,
                            [
                              { text: "No", style: "cancel" },
                              { text: "Sí", onPress: () => deleteEvento(eventAtHour.id) }
                            ]
                          );
                        }}
                        className="absolute right-4 bottom-4 bg-white/80 rounded-full w-6 h-6 items-center justify-center border border-gray-100"
                      >
                        <Text className="text-[10px]">🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    // Línea horizontal guía
                    <View className="h-px bg-gray-100 mt-3" />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Sección: Alertas y sugerencias de Conflicto */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-black text-sm font-bold">Alertas y sugerencias</Text>
            <Text className="text-red-500 text-[10px] font-bold">
              {conflictos.length} conflicto(s) activo(s)
            </Text>
          </View>

          {conflictos.length > 0 ? (
            conflictos.map((conf, idx) => {
              const horaA = formatHora(conf.evento_a.fecha_inicio);
              const horaB = formatHora(conf.evento_b.fecha_inicio);
              return (
                <View key={idx} className="bg-[#fff5f5] border border-[#fecaca] rounded-2xl p-4 mb-3">
                  <Text className="text-[#b91c1c] text-xs font-bold leading-5">
                    Conflicto: {conf.evento_a.titulo} ({horaA}) y {conf.evento_b.titulo} ({horaB})
                  </Text>

                  {/* Acciones flotantes de resolución */}
                  <View className="flex-row gap-2 mt-4">
                    <TouchableOpacity
                      onPress={handleReprogramar}
                      className="bg-black rounded-full px-4 py-2"
                    >
                      <Text className="text-white text-[10px] font-bold">Reprogramar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteEvento(conf.evento_b.id)}
                      className="bg-black rounded-full px-4 py-2"
                    >
                      <Text className="text-white text-[10px] font-bold">Eliminar B</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Alert.alert("Ignorar", "El conflicto continuará visualizándose en la agenda.")}
                      className="border border-gray-300 bg-white rounded-full px-4 py-2"
                    >
                      <Text className="text-gray-500 text-[10px] font-bold">Ignorar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text className="text-gray-400 text-xs py-2">No se han detectado conflictos en la agenda.</Text>
          )}
        </View>

        {/* Sección: Integraciones */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-black text-sm font-bold">Integraciones</Text>
            <Text className="text-gray-400 text-[10px] font-medium">Tareas del hogar · Despensa</Text>
          </View>

          {/* Comprar leche */}
          <View className="border border-gray-100 rounded-2xl p-4 mb-3">
            <View className="flex-row justify-between items-start mb-3">
              <View>
                <Text className="text-black text-xs font-bold">Comprar leche</Text>
                <Text className="text-gray-400 text-[10px] mt-0.5">Despensa: 0.5L restante · Activación automática</Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert("Evento Creado", "Se ha añadido el recordatorio al calendario.")}
                className="bg-black rounded-full px-3 py-1.5"
              >
                <Text className="text-white text-[10px] font-bold">Crear evento</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert("Despensa actualizada", "Leche marcada como comprada.")}
              className="border border-gray-300 rounded-full py-2 items-center"
            >
              <Text className="text-gray-500 text-[10px] font-bold">Marcar como comprado</Text>
            </TouchableOpacity>
          </View>

          {/* Sacar la basura */}
          <View className="border border-gray-100 rounded-2xl p-4">
            <View className="flex-row justify-between items-center">
              <View className="flex-1 pr-3">
                <Text className="text-black text-xs font-bold">Sacar la basura</Text>
                <Text className="text-gray-400 text-[10px] mt-0.5">Tarea programada semanalmente · Sábado 20:00</Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert("Asignar", "Tarea asignada a Sofía.")}
                className="bg-black rounded-full px-4 py-2"
              >
                <Text className="text-white text-[10px] font-bold">Asignar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Crear Evento Rápido Input */}
        <View className="flex-row bg-white border border-gray-100 rounded-full p-2 items-center shadow-sm">
          <TextInput
            placeholder="Título, miembro, duración · Sugerencias inteligentes"
            placeholderTextColor="#94a3b8"
            className="flex-1 px-4 py-2 text-black text-xs font-medium"
            value={quickInput}
            onChangeText={setQuickInput}
            onSubmitEditing={handleQuickAdd}
          />
          <TouchableOpacity
            onPress={handleQuickAdd}
            className="bg-black rounded-full w-10 h-10 items-center justify-center"
          >
            <Text className="text-white text-lg font-bold">+</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* FAB Crear detalladamente */}
      <TouchableOpacity
        className="absolute bottom-6 right-5 bg-black rounded-full w-14 h-14 justify-center items-center shadow-2xl"
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Añadir evento al calendario"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </TouchableOpacity>

      {/* Modal Crear Detalladamente */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-black text-lg font-bold mb-4">Nuevo evento</Text>
            <ScrollView>
              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Título *</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black mb-3 text-xs"
                placeholder="Ej: Reunión escolar"
                placeholderTextColor="#94a3b8"
                value={titulo}
                onChangeText={setTitulo}
              />
              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Descripción</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black mb-3 text-xs"
                placeholder="Opcional"
                placeholderTextColor="#94a3b8"
                value={descripcion}
                onChangeText={setDescripcion}
              />
              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Inicio (HH:MM) *</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black text-xs"
                    placeholder="10:00"
                    placeholderTextColor="#94a3b8"
                    value={horaInicio}
                    onChangeText={setHoraInicio}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Fin (HH:MM) *</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black text-xs"
                    placeholder="11:00"
                    placeholderTextColor="#94a3b8"
                    value={horaFin}
                    onChangeText={setHoraFin}
                  />
                </View>
              </View>
              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Participantes (separados por coma)</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black mb-5 text-xs"
                placeholder="Mamá, Papá, Juan"
                placeholderTextColor="#94a3b8"
                value={participantes}
                onChangeText={setParticipantes}
              />
              <TouchableOpacity
                className="bg-black rounded-full py-4 items-center mb-3"
                onPress={handleAdd}
                accessibilityLabel="Confirmar nuevo evento"
              >
                <Text className="text-white font-bold text-sm">Crear evento</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="items-center py-2"
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Cancelar nuevo evento"
              >
                <Text className="text-gray-400 text-xs font-bold">Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Conflicto en el Guardado */}
      <Modal visible={!!conflictoModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/70 px-6">
          <View className="bg-white rounded-3xl p-6 w-full">
            <Text className="text-red-500 text-base font-bold mb-3">⚠️ Conflicto de horario detectado</Text>
            <Text className="text-gray-600 text-xs leading-5 mb-4">
              El evento "<Text className="font-bold text-black">{conflictoModal?.evento_nuevo.titulo}</Text>" se solapa con el evento existente:
            </Text>
            <View className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
              <Text className="text-red-800 text-xs font-bold">{conflictoModal?.evento_conflictivo.titulo}</Text>
              <Text className="text-red-600 text-[10px] mt-0.5">
                {conflictoModal ? formatHora(conflictoModal.evento_conflictivo.fecha_inicio) : ''} –{' '}
                {conflictoModal ? formatHora(conflictoModal.evento_conflictivo.fecha_fin) : ''}
              </Text>
            </View>
            <Text className="text-gray-400 text-[11px] mb-5 leading-4">¿Deseas añadirlo igualmente ignorando el conflicto?</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 border border-gray-300 rounded-full py-3 items-center"
                onPress={() => setConflictoModal(null)}
                accessibilityLabel="Cancelar evento con conflicto"
              >
                <Text className="text-gray-500 font-bold text-xs">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-black rounded-full py-3 items-center"
                onPress={() => {
                  const ev = conflictoModal?.evento_nuevo;
                  setConflictoModal(null);
                  if (ev) {
                    saveEvento(ev.titulo, ev.descripcion || '', horaInicio, horaFin, participantes, true);
                  }
                }}
                accessibilityLabel="Confirmar evento ignorando conflicto"
              >
                <Text className="text-white font-bold text-xs">Añadir igualmente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
