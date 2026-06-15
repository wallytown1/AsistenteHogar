import React, { useState } from 'react';
import {
  View,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useCalendar } from '../hooks/useCalendar';
import { EventoItem, ConflictoEvento, InterpretarEventoResponse } from '../types/types';
import { apiRequest } from '../api/api';
import { colors, radius, spacing } from '../theme/tokens';
import {
  Screen,
  Card,
  Button,
  IconButton,
  Field,
  Fab,
  AppText,
  Icon,
  IconName,
  Badge,
  LoadingView,
  ErrorView,
} from '../components/ui';
import { haptics } from '../lib/haptics';

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
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Horas del eje vertical del calendario
const HOURS = Array.from({ length: 16 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

type EventoStyle = { bg: string; border: string; fg: string; icon: IconName };

function getEventoStyle(evento: EventoItem, hasConflict: boolean): EventoStyle {
  if (hasConflict)
    return { bg: colors.dangerSoft, border: '#FBD5D5', fg: colors.danger, icon: 'warning-outline' };
  const t = evento.titulo.toLowerCase();
  if (t.includes('médico') || t.includes('dentista') || t.includes('pediatra'))
    return { bg: colors.infoSoft, border: '#CFE3FB', fg: colors.info, icon: 'medkit-outline' };
  if (t.includes('tarea') || t.includes('basura') || t.includes('limpiar'))
    return {
      bg: colors.successSoft,
      border: '#C6F0DD',
      fg: colors.success,
      icon: 'checkbox-outline',
    };
  return {
    bg: colors.calendarSoft,
    border: '#DADBF7',
    fg: colors.calendar,
    icon: 'calendar-outline',
  };
}

export default function CalendarScreen() {
  const { eventos, conflictos, isLoading, error, addEvento, deleteEvento, refetch } = useCalendar();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [conflictoModal, setConflictoModal] = useState<ConflictoEvento | null>(null);

  const [quickInput, setQuickInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [participantes, setParticipantes] = useState('');

  const miembros = Array.from(new Set(eventos.flatMap((e) => e.participantes || [])));

  const toggleMember = (member: string) => {
    haptics.selection();
    setSelectedMembers((prev) =>
      prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]
    );
  };

  // Loader completo solo en carga inicial; en refrescos se usa el spinner nativo.
  if (isLoading && eventos.length === 0)
    return <LoadingView message="Cargando agenda familiar..." />;
  if (error && eventos.length === 0) return <ErrorView message={error} onRetry={refetch} />;

  const crearEvento = (
    evento: Omit<EventoItem, 'id' | 'is_deleted' | 'hogar_id' | 'created_at' | 'updated_at'>,
    bypass = false
  ) => {
    addEvento(evento, bypass)
      .then((conflicto) => {
        if (conflicto) {
          setConflictoModal(conflicto);
        } else {
          haptics.success();
          setModalVisible(false);
          setTitulo('');
          setDescripcion('');
          setHoraInicio('');
          setHoraFin('');
          setParticipantes('');
          Alert.alert('Éxito', 'El evento se ha agregado correctamente.');
        }
      })
      .catch((err) => {
        Alert.alert('Error', err.message || 'No se pudo agregar el evento.');
      });
  };

  const handleAdd = () => {
    if (!titulo.trim() || !horaInicio || !horaFin) {
      Alert.alert('Campos requeridos', 'El título, hora de inicio y fin son obligatorios.');
      return;
    }
    // IA Pasiva - Confirmar creación del evento
    Alert.alert('Confirmar creación', `¿Deseas guardar el evento "${titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => {
          const hoy = new Date();
          const [hI, mI] = horaInicio.split(':').map(Number);
          const [hF, mF] = horaFin.split(':').map(Number);
          crearEvento({
            titulo: titulo.trim(),
            descripcion: descripcion || null,
            fecha_inicio: new Date(
              hoy.getFullYear(),
              hoy.getMonth(),
              hoy.getDate(),
              hI || 9,
              mI || 0
            ).toISOString(),
            fecha_fin: new Date(
              hoy.getFullYear(),
              hoy.getMonth(),
              hoy.getDate(),
              hF || 10,
              mF || 0
            ).toISOString(),
            participantes: participantes
              ? participantes
                  .split(',')
                  .map((p: string) => p.trim())
                  .filter(Boolean)
              : null,
          });
        },
      },
    ]);
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
          'No se pudo interpretar',
          res.mensaje ||
            'Intenta describir el evento con más detalle, por ejemplo: "cena con mis padres el viernes a las 21h".'
        );
        return;
      }

      const ev = res.evento;
      const inicio = new Date(ev.fecha_inicio);
      const detalle =
        `📅 ${formatFechaLarga(inicio)}\n` +
        `🕐 ${formatHora(ev.fecha_inicio)} – ${formatHora(ev.fecha_fin)}` +
        (ev.participantes && ev.participantes.length > 0
          ? `\n👥 ${ev.participantes.join(', ')}`
          : '') +
        (ev.descripcion ? `\n📝 ${ev.descripcion}` : '') +
        // Transparencia IA (EU AI Act): la propuesta proviene del modelo
        `\n\n🤖 Propuesta generada por IA — revísala antes de confirmar.`;

      Alert.alert(`Crear "${ev.titulo}"`, detalle, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            crearEvento({
              titulo: ev.titulo,
              descripcion: ev.descripcion,
              fecha_inicio: ev.fecha_inicio,
              fecha_fin: ev.fecha_fin,
              participantes: ev.participantes,
            });
            setQuickInput('');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo interpretar el evento.');
    } finally {
      setQuickLoading(false);
    }
  };

  // Predicado de filtrado por miembro seleccionado (eje horario y "fuera de horario")
  const pasaFiltroMiembro = (e: EventoItem): boolean => {
    if (selectedMembers.length === 0) return true;
    if (!e.participantes || e.participantes.length === 0) return true;
    return e.participantes.some((p) => selectedMembers.includes(p));
  };

  // Render de una tarjeta de evento. Soporta VARIOS eventos por hora (B2) y la
  // sección "Fuera de horario" (B3).
  const renderEventoCard = (evento: EventoItem) => {
    const hasConflict = conflictos.some(
      (c) => c.evento_a.id === evento.id || c.evento_b.id === evento.id
    );
    const st = getEventoStyle(evento, hasConflict);
    return (
      <View
        key={evento.id}
        style={{
          backgroundColor: st.bg,
          borderWidth: 1,
          borderColor: st.border,
          borderRadius: radius.xl,
          padding: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.md,
              backgroundColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
            }}
          >
            <Icon name={st.icon} size={18} color={st.fg} />
          </View>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <AppText variant="captionStrong" color={st.fg} numberOfLines={1}>
              {evento.titulo}
            </AppText>
            <AppText variant="micro" color={colors.inkMuted} style={{ marginTop: 1 }}>
              {formatHora(evento.fecha_inicio)} – {formatHora(evento.fecha_fin)}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {evento.participantes?.slice(0, 3).map((partName, idx) => (
              <View
                key={`${evento.id}-${partName}-${idx}`}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radius.pill,
                  backgroundColor: colors.white,
                  borderWidth: 1,
                  borderColor: st.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="micro" color={st.fg} style={{ fontSize: 9 }}>
                  {getInitials(partName)}
                </AppText>
              </View>
            ))}
            <IconButton
              name="trash-outline"
              size={14}
              color={colors.danger}
              bg={colors.white}
              diameter={26}
              accessibilityLabel={`Eliminar ${evento.titulo}`}
              onPress={() => {
                Alert.alert(
                  'Confirmar eliminación',
                  `¿Deseas eliminar "${evento.titulo}" del calendario?`,
                  [
                    { text: 'No', style: 'cancel' },
                    { text: 'Sí', style: 'destructive', onPress: () => deleteEvento(evento.id) },
                  ]
                );
              }}
            />
          </View>
        </View>
        {evento.descripcion ? (
          <AppText
            variant="micro"
            color={colors.inkMuted}
            numberOfLines={2}
            style={{ marginTop: 6 }}
          >
            {evento.descripcion}
          </AppText>
        ) : null}
        {hasConflict ? (
          <AppText
            variant="micro"
            color={colors.danger}
            style={{ marginTop: 6, fontWeight: '700' }}
          >
            Conflicto: colisión horaria. Revisa las alertas abajo.
          </AppText>
        ) : null}
      </View>
    );
  };

  // B3: eventos cuya hora de inicio cae fuera del eje 07:00–22:00.
  const eventosFueraHorario = eventos
    .filter((e) => {
      const h = new Date(e.fecha_inicio).getHours();
      return (h < 7 || h > 22) && pasaFiltroMiembro(e);
    })
    .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen bottomExtra={72} refreshing={isLoading} onRefresh={refetch}>
        {/* Cabecera */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <AppText variant="title" style={{ textTransform: 'capitalize' }}>
              {formatFechaLarga(new Date())}
            </AppText>
            <AppText variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>
              {eventos.length} evento(s) · {conflictos.length} conflicto(s)
            </AppText>
          </View>
          <IconButton
            name="refresh"
            size={20}
            color={colors.brand}
            bg={colors.brandSoft}
            onPress={refetch}
            accessibilityLabel="Actualizar agenda"
          />
        </View>

        {/* Filtro por miembros */}
        {miembros.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.sm,
              marginBottom: spacing.lg,
            }}
          >
            {miembros.map((member) => {
              const isSelected = selectedMembers.includes(member);
              return (
                <Pressable
                  key={member}
                  onPress={() => toggleMember(member)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    backgroundColor: isSelected ? colors.calendar : colors.card,
                    borderColor: isSelected ? colors.calendar : colors.borderStrong,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: radius.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? colors.white : colors.brandSoft,
                    }}
                  >
                    <AppText
                      variant="micro"
                      color={isSelected ? colors.calendar : colors.brand}
                      style={{ fontSize: 9 }}
                    >
                      {getInitials(member)}
                    </AppText>
                  </View>
                  <AppText variant="captionStrong" color={isSelected ? colors.white : colors.ink}>
                    {member}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Timeline horario */}
        <View style={{ marginBottom: spacing.lg }}>
          {HOURS.map((hour) => {
            const hourNumber = parseInt(hour.split(':')[0], 10);
            // B2: todos los eventos de la franja, no solo el primero.
            const eventosHora = eventos
              .filter(
                (e) => new Date(e.fecha_inicio).getHours() === hourNumber && pasaFiltroMiembro(e)
              )
              .sort(
                (a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
              );

            return (
              <View
                key={hour}
                style={{ flexDirection: 'row', marginBottom: spacing.md, minHeight: 36 }}
              >
                <View style={{ width: 48, paddingTop: 2 }}>
                  <AppText variant="micro" color={colors.inkFaint} style={{ fontWeight: '700' }}>
                    {hour}
                  </AppText>
                </View>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  {eventosHora.length > 0 ? (
                    eventosHora.map((ev) => renderEventoCard(ev))
                  ) : (
                    <View style={{ height: 1, backgroundColor: colors.border, marginTop: 8 }} />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* B3: Fuera de horario */}
        {eventosFueraHorario.length > 0 ? (
          <View style={{ marginBottom: spacing.lg }}>
            <AppText variant="label" color={colors.inkFaint} style={{ marginBottom: spacing.sm }}>
              Fuera de horario ({eventosFueraHorario.length})
            </AppText>
            <View style={{ gap: spacing.sm }}>
              {eventosFueraHorario.map((ev) => renderEventoCard(ev))}
            </View>
          </View>
        ) : null}

        {/* Alertas de conflicto */}
        <Card style={{ marginBottom: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="warning-outline" size={16} color={colors.danger} />
              <AppText variant="h2">Conflictos</AppText>
            </View>
            <Badge
              label={`${conflictos.length}`}
              color={conflictos.length > 0 ? colors.danger : colors.success}
              bg={conflictos.length > 0 ? colors.dangerSoft : colors.successSoft}
            />
          </View>

          {conflictos.length > 0 ? (
            conflictos.map((conf, idx) => {
              const horaA = formatHora(conf.evento_a.fecha_inicio);
              const horaB = formatHora(conf.evento_b.fecha_inicio);
              return (
                <View
                  key={idx}
                  style={{
                    backgroundColor: colors.dangerSoft,
                    borderWidth: 1,
                    borderColor: '#FBD5D5',
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                  }}
                >
                  <AppText variant="captionStrong" color={colors.danger} style={{ lineHeight: 18 }}>
                    {conf.evento_a.titulo} ({horaA}) ↔ {conf.evento_b.titulo} ({horaB})
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={`Borrar ${conf.evento_a.titulo.slice(0, 10)}`}
                        variant="danger"
                        size="sm"
                        onPress={() => {
                          Alert.alert(
                            'Confirmar eliminación',
                            `¿Deseas eliminar "${conf.evento_a.titulo}" (${horaA})?`,
                            [
                              { text: 'No', style: 'cancel' },
                              {
                                text: 'Sí',
                                style: 'destructive',
                                onPress: () => deleteEvento(conf.evento_a.id),
                              },
                            ]
                          );
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={`Borrar ${conf.evento_b.titulo.slice(0, 10)}`}
                        variant="danger"
                        size="sm"
                        onPress={() => {
                          Alert.alert(
                            'Confirmar eliminación',
                            `¿Deseas eliminar "${conf.evento_b.titulo}" (${horaB})?`,
                            [
                              { text: 'No', style: 'cancel' },
                              {
                                text: 'Sí',
                                style: 'destructive',
                                onPress: () => deleteEvento(conf.evento_b.id),
                              },
                            ]
                          );
                        }}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <AppText variant="caption" color={colors.inkFaint}>
              No se han detectado conflictos en la agenda.
            </AppText>
          )}
        </Card>

        {/* Evento rápido con IA */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="sparkles" size={16} color={colors.brand} />
            <AppText variant="h2">Evento rápido con IA</AppText>
          </View>
          <AppText
            variant="micro"
            color={colors.inkMuted}
            style={{ marginBottom: spacing.md, lineHeight: 15 }}
          >
            Descríbelo en tus palabras y la IA propondrá fecha y hora. Tú siempre confirmas.
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              placeholder='Ej: "cena con mis padres el viernes a las 21h"'
              placeholderTextColor={colors.inkFaint}
              style={{
                flex: 1,
                backgroundColor: colors.cardAlt,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: 11,
                fontSize: 14,
                color: colors.ink,
              }}
              value={quickInput}
              onChangeText={setQuickInput}
              onSubmitEditing={handleQuickAdd}
              editable={!quickLoading}
            />
            <Pressable
              onPress={handleQuickAdd}
              disabled={quickLoading}
              accessibilityLabel="Interpretar evento con IA"
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.md,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {quickLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Icon name="sparkles" size={20} color={colors.white} />
              )}
            </Pressable>
          </View>
        </Card>
      </Screen>

      <Fab
        icon="add"
        color={colors.calendar}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Añadir evento al calendario"
      />

      {/* Modal Crear evento */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              padding: spacing.xl,
              paddingBottom: spacing.xxxl,
              maxHeight: '88%',
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.borderStrong,
                }}
              />
            </View>
            <AppText variant="h2" style={{ marginBottom: spacing.lg }}>
              Nuevo evento
            </AppText>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Field
                label="Título *"
                placeholder="Ej: Reunión escolar"
                value={titulo}
                onChangeText={setTitulo}
              />
              <Field
                label="Descripción"
                placeholder="Opcional"
                value={descripcion}
                onChangeText={setDescripcion}
              />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Inicio (HH:MM) *"
                    placeholder="10:00"
                    value={horaInicio}
                    onChangeText={setHoraInicio}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Fin (HH:MM) *"
                    placeholder="11:00"
                    value={horaFin}
                    onChangeText={setHoraFin}
                  />
                </View>
              </View>
              <Field
                label="Participantes (coma)"
                placeholder="Mamá, Papá, Juan"
                value={participantes}
                onChangeText={setParticipantes}
                containerStyle={{ marginBottom: spacing.xl }}
              />
              <Button
                label="Crear evento"
                icon="add"
                onPress={handleAdd}
                style={{ marginBottom: spacing.sm }}
              />
              <Button label="Cancelar" variant="ghost" onPress={() => setModalVisible(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de conflicto al guardar */}
      <Modal
        visible={!!conflictoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConflictoModal(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.overlay,
            paddingHorizontal: spacing.xl,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.xxl,
              padding: spacing.xl,
              width: '100%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: spacing.md,
              }}
            >
              <Icon name="warning" size={20} color={colors.danger} />
              <AppText variant="h2" color={colors.danger}>
                Conflicto de horario
              </AppText>
            </View>
            <AppText
              variant="caption"
              color={colors.inkMuted}
              style={{ lineHeight: 19, marginBottom: spacing.md }}
            >
              El evento «{conflictoModal?.evento_nuevo.titulo}» se solapa con un evento existente:
            </AppText>
            <View
              style={{
                backgroundColor: colors.dangerSoft,
                borderWidth: 1,
                borderColor: '#FBD5D5',
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.lg,
              }}
            >
              <AppText variant="captionStrong" color={colors.danger}>
                {conflictoModal?.evento_conflictivo.titulo}
              </AppText>
              <AppText variant="micro" color={colors.danger} style={{ marginTop: 2 }}>
                {conflictoModal ? formatHora(conflictoModal.evento_conflictivo.fecha_inicio) : ''} –{' '}
                {conflictoModal ? formatHora(conflictoModal.evento_conflictivo.fecha_fin) : ''}
              </AppText>
            </View>
            <AppText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.lg }}>
              ¿Deseas añadirlo igualmente ignorando el conflicto?
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancelar" variant="ghost" onPress={() => setConflictoModal(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Añadir igual"
                  variant="danger"
                  onPress={() => {
                    const ev = conflictoModal?.evento_nuevo;
                    setConflictoModal(null);
                    if (ev) {
                      crearEvento(
                        {
                          titulo: ev.titulo,
                          descripcion: ev.descripcion,
                          fecha_inicio: ev.fecha_inicio,
                          fecha_fin: ev.fecha_fin,
                          participantes: ev.participantes,
                        },
                        true
                      );
                    }
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
