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
import { useCalendar } from '../hooks/useCalendar';
import { EventoItem, ConflictoEvento, InterpretarEventoResponse } from '../types/types';
import { apiRequest } from '../api/api';

function formatHora(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatFechaLarga(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Horas del eje vertical del calendario
const HOURS = Array.from({ length: 16 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

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
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [conflictoModal, setConflictoModal] = useState<ConflictoEvento | null>(null);

  // States para crear evento rápido con IA
  const [quickInput, setQuickInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  // States para modal de creación detallada
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [participantes, setParticipantes] = useState('');

  // Participantes reales extraídos de los eventos del hogar
  const miembros = Array.from(new Set(eventos.flatMap(e => e.participantes || [])));

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

  const crearEvento = (
    evento: Omit<EventoItem, 'id' | 'is_deleted' | 'hogar_id' | 'created_at' | 'updated_at'>,
    bypass = false
  ) => {
    addEvento(evento, bypass).then((conflicto) => {
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
        { text: "Confirmar", onPress: () => {
          const hoy = new Date();
          const [hI, mI] = horaInicio.split(':').map(Number);
          const [hF, mF] = horaFin.split(':').map(Number);
          crearEvento({
            titulo: titulo.trim(),
            descripcion: descripcion || null,
            fecha_inicio: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), hI || 9, mI || 0).toISOString(),
            fecha_fin: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), hF || 10, mF || 0).toISOString(),
            participantes: participantes ? participantes.split(',').map((p: string) => p.trim()).filter(Boolean) : null,
          });
        }}
      ]
    );
  };

  /**
   * Evento rápido con IA real: Gemini interpreta el texto en lenguaje natural
   * y devuelve una PROPUESTA. El usuario siempre confirma antes de crear (IA pasiva).
   */
  const handleQuickAdd = async () => {
    const texto = quickInput.trim();
    if (texto.length < 3 || quickLoading) return;

    setQuickLoading(true);
    try {
      const res = await apiRequest<InterpretarEventoResponse>('/calendar/interpretar', {
        method: 'POST',
        json: { texto, fecha_referencia: new Date().toISOString() },
      });

      if (!res.evento) {
        Alert.alert(
          "No se pudo interpretar",
          res.mensaje || "Intenta describir el evento con más detalle, por ejemplo: \"cena con mis padres el viernes a las 21h\"."
        );
        return;
      }

      const ev = res.evento;
      const inicio = new Date(ev.fecha_inicio);
      const detalle =
        `📅 ${formatFechaLarga(inicio)}\n` +
        `🕐 ${formatHora(ev.fecha_inicio)} – ${formatHora(ev.fecha_fin)}` +
        (ev.participantes && ev.participantes.length > 0 ? `\n👥 ${ev.participantes.join(', ')}` : '') +
        (ev.descripcion ? `\n📝 ${ev.descripcion}` : '') +
        // Transparencia IA (EU AI Act): la propuesta proviene del modelo
        `\n\n🤖 Propuesta generada por IA — revísala antes de confirmar.`;

      Alert.alert(
        `Crear "${ev.titulo}"`,
        detalle,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: () => {
            crearEvento({
              titulo: ev.titulo,
              descripcion: ev.descripcion,
              fecha_inicio: ev.fecha_inicio,
              fecha_fin: ev.fecha_fin,
              participantes: ev.participantes,
            });
            setQuickInput('');
          }}
        ]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "No se pudo interpretar el evento.");
    } finally {
      setQuickLoading(false);
    }
  };

  // Predicado de filtrado por miembro seleccionado (reutilizado en el eje horario y en "fuera de horario")
  const pasaFiltroMiembro = (e: EventoItem): boolean => {
    if (selectedMembers.length === 0) return true;
    if (!e.participantes || e.participantes.length === 0) return true;
    return e.participantes.some(p => selectedMembers.includes(p));
  };

  // Render de una tarjeta de evento. Extraído para poder pintar VARIOS eventos por hora (B2)
  // y reutilizarlo en la sección "Fuera de horario" (B3).
  const renderEventoCard = (evento: EventoItem) => {
    const hasConflict = conflictos.some(
      (c) => c.evento_a.id === evento.id || c.evento_b.id === evento.id
    );
    const tituloLower = evento.titulo.toLowerCase();
    const isHealth = tituloLower.includes('médico') || tituloLower.includes('dentista') || tituloLower.includes('pediatra');
    const isTask = tituloLower.includes('tarea') || tituloLower.includes('basura') || tituloLower.includes('limpiar');

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
      <View key={evento.id} className={`rounded-3xl p-4 border relative ${cardBg}`}>
        {/* Iniciales de los participantes */}
        <View className="absolute right-4 top-4 flex-row gap-1">
          {evento.participantes?.map((partName, idx) => (
            <View
              key={`${evento.id}-${partName}-${idx}`}
              className="w-6 h-6 rounded-full border border-white bg-white/70 items-center justify-center"
            >
              <Text className="text-[8px] font-bold text-black">{getInitials(partName)}</Text>
            </View>
          ))}
        </View>

        <View className="pr-12">
          <Text className={`font-bold text-xs ${textColor}`} numberOfLines={1}>
            {evento.titulo}
          </Text>
          <Text className="text-gray-500 text-[10px] mt-0.5 font-semibold">
            {formatHora(evento.fecha_inicio)} – {formatHora(evento.fecha_fin)}
          </Text>
          <Text className="text-gray-400 text-[9px] mt-1 font-medium" numberOfLines={2}>
            {evento.descripcion || 'Sin descripción'}
          </Text>
        </View>

        {hasConflict && (
          <Text className="text-red-600 text-[9px] mt-2 font-bold leading-4">
            Conflicto detectado: Colisión horaria en la agenda. Revisa las alertas abajo.
          </Text>
        )}

        {/* Botón rápido para borrar */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "Confirmar eliminación",
              `¿Deseas eliminar "${evento.titulo}" del calendario?`,
              [
                { text: "No", style: "cancel" },
                { text: "Sí", onPress: () => deleteEvento(evento.id) }
              ]
            );
          }}
          className="absolute right-4 bottom-4 bg-white/80 rounded-full w-6 h-6 items-center justify-center border border-gray-100"
        >
          <Text className="text-[10px]">🗑️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // B3: eventos cuya hora de inicio cae fuera del eje 07:00–22:00 (madrugada o noche).
  // Sin esta sección serían invisibles en la agenda.
  const eventosFueraHorario = eventos
    .filter((e) => {
      const h = new Date(e.fecha_inicio).getHours();
      return (h < 7 || h > 22) && pasaFiltroMiembro(e);
    })
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

  return (
    <View className="flex-1 bg-[#fafafa]">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 }}>

        {/* Cabecera del calendario */}
        <View className="mb-5">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-black text-2xl font-bold capitalize">{formatFechaLarga(new Date())}</Text>
            <TouchableOpacity
              onPress={refetch}
              className="bg-black rounded-full px-4 py-1.5 justify-center items-center"
              accessibilityLabel="Actualizar agenda"
            >
              <Text className="text-white text-xs font-bold">↻</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-gray-400 text-xs font-medium">
            Agenda combinada · {eventos.length} evento(s) · {conflictos.length} conflicto(s)
          </Text>
        </View>

        {/* Filtro por participantes (derivados de los eventos reales) */}
        {miembros.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mb-6">
            {miembros.map(member => {
              const isSelected = selectedMembers.includes(member);
              return (
                <TouchableOpacity
                  key={member}
                  onPress={() => toggleMember(member)}
                  className={`flex-row items-center border rounded-full px-3 py-1.5 ${
                    isSelected ? 'bg-black border-black' : 'bg-white border-gray-200'
                  }`}
                >
                  <View className={`w-6 h-6 rounded-full mr-2 items-center justify-center ${isSelected ? 'bg-white' : 'bg-gray-100'}`}>
                    <Text className="text-[9px] font-bold text-black">{getInitials(member)}</Text>
                  </View>
                  <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-black'}`}>{member}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Distribución Horaria Vertical */}
        <View className="mb-6">
          {HOURS.map((hour) => {
            const hourNumber = parseInt(hour.split(':')[0], 10);

            // B2: TODOS los eventos que comienzan en esta hora (con filtro de miembro aplicado),
            // no solo el primero. Ordenados por minuto de inicio.
            const eventosHora = eventos
              .filter((e) => new Date(e.fecha_inicio).getHours() === hourNumber && pasaFiltroMiembro(e))
              .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

            return (
              <View key={hour} className="flex-row mb-4 min-h-[70px]">
                {/* Eje Horario */}
                <View className="w-14 items-start pt-1">
                  <Text className="text-gray-400 text-xs font-bold">{hour}</Text>
                </View>

                {/* Eventos de esta hora apilados al lado derecho */}
                <View className="flex-1">
                  {eventosHora.length > 0 ? (
                    <View className="gap-3">
                      {eventosHora.map((ev) => renderEventoCard(ev))}
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

        {/* B3: Eventos fuera del eje 07:00–22:00 (no caben en la rejilla horaria) */}
        {eventosFueraHorario.length > 0 && (
          <View className="mb-6">
            <Text className="text-gray-400 text-[10px] font-bold uppercase mb-2 ml-1">
              Fuera de horario ({eventosFueraHorario.length})
            </Text>
            <View className="gap-3">
              {eventosFueraHorario.map((ev) => renderEventoCard(ev))}
            </View>
          </View>
        )}

        {/* Sección: Alertas de Conflicto */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-black text-sm font-bold">Alertas de conflicto</Text>
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

                  {/* Acciones reales de resolución */}
                  <View className="flex-row gap-2 mt-4">
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Confirmar eliminación",
                          `¿Deseas eliminar "${conf.evento_a.titulo}" (${horaA})?`,
                          [
                            { text: "No", style: "cancel" },
                            { text: "Sí", onPress: () => deleteEvento(conf.evento_a.id) }
                          ]
                        );
                      }}
                      className="bg-black rounded-full px-4 py-2"
                    >
                      <Text className="text-white text-[10px] font-bold">Eliminar "{conf.evento_a.titulo.slice(0, 15)}"</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Confirmar eliminación",
                          `¿Deseas eliminar "${conf.evento_b.titulo}" (${horaB})?`,
                          [
                            { text: "No", style: "cancel" },
                            { text: "Sí", onPress: () => deleteEvento(conf.evento_b.id) }
                          ]
                        );
                      }}
                      className="bg-black rounded-full px-4 py-2"
                    >
                      <Text className="text-white text-[10px] font-bold">Eliminar "{conf.evento_b.titulo.slice(0, 15)}"</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text className="text-gray-400 text-xs py-2">No se han detectado conflictos en la agenda.</Text>
          )}
        </View>

        {/* Crear Evento Rápido con IA */}
        <View className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
          <Text className="text-black text-xs font-bold mb-2">Evento rápido con IA ✨</Text>
          <Text className="text-gray-400 text-[10px] mb-3">
            Describe el evento en tus palabras y la IA propondrá fecha y hora. Tú siempre confirmas.
          </Text>
          <View className="flex-row bg-gray-50 border border-gray-200 rounded-full p-1.5 items-center">
            <TextInput
              placeholder='Ej: "cena con mis padres el viernes a las 21h"'
              placeholderTextColor="#94a3b8"
              className="flex-1 px-4 py-2 text-black text-xs font-medium"
              value={quickInput}
              onChangeText={setQuickInput}
              onSubmitEditing={handleQuickAdd}
              editable={!quickLoading}
            />
            <TouchableOpacity
              onPress={handleQuickAdd}
              disabled={quickLoading}
              className="bg-black rounded-full w-10 h-10 items-center justify-center"
              accessibilityLabel="Interpretar evento con IA"
            >
              {quickLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white text-lg font-bold">✨</Text>
              )}
            </TouchableOpacity>
          </View>
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
                    crearEvento({
                      titulo: ev.titulo,
                      descripcion: ev.descripcion,
                      fecha_inicio: ev.fecha_inicio,
                      fecha_fin: ev.fecha_fin,
                      participantes: ev.participantes,
                    }, true);
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
