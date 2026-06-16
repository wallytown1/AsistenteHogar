import React, { useState } from 'react';
import { View, Modal, ScrollView, Alert, Pressable, ActivityIndicator } from 'react-native';
import { useTasks } from '../hooks/useTasks';
import { TareaItem, TareaInterpretada, InterpretarTareaResponse } from '../types/types';
import { apiRequest } from '../api/api';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';
import { colors, radius, spacing } from '../theme/tokens';
import {
  Screen,
  Card,
  StatCard,
  Chip,
  Button,
  IconButton,
  Field,
  Fab,
  AppText,
  Icon,
  IconName,
  EmptyState,
  LoadingView,
  ErrorView,
} from '../components/ui';
import { haptics } from '../lib/haptics';
import { usePurchasesStore } from '../state/purchasesStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type FiltroEstado = 'todas' | 'pendiente' | 'completado';

const FRECUENCIAS = ['diaria', 'semanal', 'mensual', 'ocasional'];
const PRIORIDADES = ['alta', 'media', 'baja'];

function getPrioridad(prioridad: string): { label: string; color: string; soft: string } {
  switch (prioridad) {
    case 'alta':
      return { label: 'Alta', color: colors.danger, soft: colors.dangerSoft };
    case 'baja':
      return { label: 'Baja', color: colors.success, soft: colors.successSoft };
    default:
      return { label: 'Media', color: colors.warning, soft: colors.warningSoft };
  }
}

function getFrecuenciaIcon(frecuencia: string): IconName {
  const f = frecuencia.toLowerCase();
  if (f.includes('diaria')) return 'sunny-outline';
  if (f.includes('semanal')) return 'calendar-outline';
  if (f.includes('mensual')) return 'calendar-number-outline';
  return 'repeat-outline';
}

export default function TasksScreen() {
  const { tasks, isLoading, error, refetch, addTask, toggleTaskStatus, deleteTask } = useTasks();

  const [modalVisible, setModalVisible] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');

  const [nombre, setNombre] = useState('');
  const [asignadoA, setAsignadoA] = useState('');
  const [frecuencia, setFrecuencia] = useState('semanal');
  const [prioridad, setPrioridad] = useState('media');

  // --- Modo del modal: manual o IA ---
  const [modoModal, setModoModal] = useState<'manual' | 'ia'>('manual');
  const [textoIA, setTextoIA] = useState('');
  const [propuestaIA, setPropuestaIA] = useState<TareaInterpretada | null>(null);
  const [interpretandoIA, setInterpretandoIA] = useState(false);
  const [mensajeIA, setMensajeIA] = useState<string | null>(null);

  const isPremium = usePurchasesStore((s) => s.isPremium);
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const checkPremiumGate = () => {
    if (!isPremium) {
      navigation.navigate('Paywall');
      setModalVisible(false); // Cierra el modal de añadir tarea
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setNombre('');
    setAsignadoA('');
    setFrecuencia('semanal');
    setPrioridad('media');
    setModoModal('manual');
    setTextoIA('');
    setPropuestaIA(null);
    setMensajeIA(null);
  };

  const handleInterpretarTarea = async () => {
    if (textoIA.trim().length < 3) {
      Alert.alert('Texto muy corto', 'Describe la tarea con al menos 3 caracteres.');
      return;
    }
    setInterpretandoIA(true);
    setMensajeIA(null);
    setPropuestaIA(null);
    try {
      const res = await apiRequest<InterpretarTareaResponse>('/tasks/interpretar', {
        method: 'POST',
        json: { texto: textoIA.trim() },
      });
      if (res.tarea) {
        setPropuestaIA(res.tarea);
      } else {
        setMensajeIA(res.mensaje || 'No se pudo interpretar la tarea.');
      }
    } catch (err: any) {
      setMensajeIA(err.message || 'Error al interpretar el texto.');
    } finally {
      setInterpretandoIA(false);
    }
  };

  // Pre-rellena el formulario manual con la propuesta de la IA y cambia de tab.
  // El usuario puede editar los campos antes de confirmar (IA pasiva).
  const handleAplicarPropuestaIA = () => {
    if (!propuestaIA) return;
    setNombre(propuestaIA.nombre);
    setAsignadoA(propuestaIA.asignado_a || '');
    setFrecuencia(propuestaIA.frecuencia);
    setPrioridad(propuestaIA.prioridad);
    setPropuestaIA(null);
    setTextoIA('');
    setMensajeIA(null);
    setModoModal('manual');
  };

  // Loader completo solo en carga inicial; en refrescos se usa el spinner nativo.
  if (isLoading && tasks.length === 0)
    return <LoadingView message="Cargando tareas del hogar..." />;
  if (error && tasks.length === 0) return <ErrorView message={error} onRetry={refetch} />;

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
              await addTask(nombre.trim(), asignadoA.trim() || null, frecuencia, prioridad);
              haptics.success();
              setModalVisible(false);
              resetForm();
              Alert.alert('Éxito', 'La tarea ha sido registrada.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo crear la tarea.');
            }
          },
        },
      ]
    );
  };

  const handleToggle = (item: TareaItem) => {
    haptics.light();
    toggleTaskStatus(item.id, item.estado).catch((err: any) => {
      Alert.alert('Error', err.message || 'No se pudo actualizar la tarea.');
    });
  };

  const handleDelete = (item: TareaItem) => {
    Alert.alert('Confirmar eliminación', `¿Deseas eliminar la tarea "${item.nombre}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí',
        style: 'destructive',
        onPress: () => {
          deleteTask(item.id).catch((err: any) => {
            Alert.alert('Error', err.message || 'No se pudo eliminar la tarea.');
          });
        },
      },
    ]);
  };

  const tareasFiltradas = tasks.filter((t) =>
    filtroEstado === 'todas' ? true : t.estado === filtroEstado
  );
  const pendientes = tasks.filter((t) => t.estado === 'pendiente').length;
  const completadas = tasks.filter((t) => t.estado === 'completado').length;

  const filtros: { key: FiltroEstado; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'completado', label: 'Completadas' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen bottomExtra={72} refreshing={isLoading} onRefresh={refetch}>
        <AppText variant="display" style={{ marginBottom: spacing.lg }}>
          Tareas
        </AppText>

        {/* Métricas */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          <StatCard
            label="Pendientes"
            value={String(pendientes)}
            icon="flash-outline"
            accent={colors.tasks}
            accentSoft={colors.tasksSoft}
            footnote="Por completar"
          />
          <StatCard
            label="Completadas"
            value={String(completadas)}
            icon="checkmark-done-outline"
            accent={colors.success}
            accentSoft={colors.successSoft}
            footnote="Finalizadas"
          />
        </View>

        {/* Filtros */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {filtros.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={filtroEstado === f.key}
              onPress={() => setFiltroEstado(f.key)}
              activeColor={colors.tasks}
              flex
            />
          ))}
        </View>

        {/* Listado */}
        {tareasFiltradas.length === 0 ? (
          <Card>
            <EmptyState
              icon="sparkles-outline"
              accent={colors.tasks}
              accentSoft={colors.tasksSoft}
              title={filtroEstado === 'todas' ? 'Sin tareas todavía' : 'Nada en este estado'}
              subtitle={
                filtroEstado === 'todas'
                  ? 'Pulsa el botón + para crear la primera tarea del hogar.'
                  : undefined
              }
            />
          </Card>
        ) : (
          tareasFiltradas.map((item) => {
            const completada = item.estado === 'completado';
            const prio = getPrioridad(item.prioridad);
            return (
              <Card
                key={item.id}
                padding={spacing.lg}
                style={{ marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center' }}
              >
                {/* Checkbox */}
                <Pressable
                  onPress={() => handleToggle(item)}
                  accessibilityLabel={
                    completada ? 'Marcar como pendiente' : 'Marcar como completada'
                  }
                  hitSlop={8}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.pill,
                    marginRight: spacing.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: completada ? 0 : 2,
                    borderColor: colors.borderStrong,
                    backgroundColor: completada ? colors.success : colors.cardAlt,
                  }}
                >
                  {completada ? <Icon name="checkmark" size={17} color={colors.white} /> : null}
                </Pressable>

                {/* Detalles */}
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <AppText
                    variant="bodyStrong"
                    numberOfLines={2}
                    color={completada ? colors.inkFaint : colors.ink}
                    style={completada ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {item.nombre}
                  </AppText>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Icon
                        name={getFrecuenciaIcon(item.frecuencia)}
                        size={12}
                        color={colors.inkFaint}
                      />
                      <AppText
                        variant="micro"
                        color={colors.inkMuted}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {item.frecuencia}
                      </AppText>
                    </View>
                    {item.asignado_a ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Icon name="person-outline" size={12} color={colors.inkFaint} />
                        <AppText variant="micro" color={colors.inkMuted}>
                          {item.asignado_a}
                        </AppText>
                      </View>
                    ) : null}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: radius.pill,
                        backgroundColor: prio.soft,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: prio.color,
                        }}
                      />
                      <AppText variant="micro" color={prio.color} style={{ fontWeight: '700' }}>
                        {prio.label}
                      </AppText>
                    </View>
                  </View>
                </View>

                {/* Eliminar */}
                <IconButton
                  name="trash-outline"
                  size={17}
                  color={colors.danger}
                  bg={colors.dangerSoft}
                  diameter={34}
                  onPress={() => handleDelete(item)}
                  accessibilityLabel="Eliminar tarea"
                />
              </Card>
            );
          })
        )}
      </Screen>

      <Fab
        icon="add"
        color={colors.tasks}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Añadir tarea"
      />

      {/* Modal Añadir Tarea */}
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
            <AppText variant="h2" style={{ marginBottom: spacing.md }}>
              Nueva tarea
            </AppText>

            {/* Tabs: Manual / Con IA */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              <Chip
                label="Manual"
                active={modoModal === 'manual'}
                onPress={() => setModoModal('manual')}
                activeColor={colors.tasks}
                flex
              />
              <Chip
                label="Describir con IA"
                active={modoModal === 'ia'}
                onPress={() => {
                  if (checkPremiumGate()) {
                    setModoModal('ia');
                  }
                }}
                activeColor={colors.brand}
                flex
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {modoModal === 'ia' ? (
                <>
                  <AIDisclaimerBanner texto="La IA interpretará tu frase y propondrá los campos. Podrás editarlos antes de crear la tarea." />
                  <Field
                    label="Describe la tarea"
                    placeholder='Ej: "sacar la basura los lunes, le toca a papá"'
                    value={textoIA}
                    onChangeText={setTextoIA}
                    containerStyle={{ marginBottom: spacing.md }}
                  />
                  <Button
                    label={interpretandoIA ? 'Interpretando...' : 'Interpretar'}
                    icon="sparkles"
                    loading={interpretandoIA}
                    onPress={handleInterpretarTarea}
                    style={{ marginBottom: spacing.md }}
                  />
                  {interpretandoIA ? (
                    <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                      <ActivityIndicator size="small" color={colors.brand} />
                    </View>
                  ) : null}
                  {mensajeIA && !interpretandoIA ? (
                    <AppText
                      variant="caption"
                      color={colors.inkMuted}
                      center
                      style={{ marginBottom: spacing.md }}
                    >
                      {mensajeIA}
                    </AppText>
                  ) : null}
                  {propuestaIA && !interpretandoIA ? (
                    <Card
                      tint={colors.tasksSoft}
                      borderColor={colors.tasks}
                      style={{ marginBottom: spacing.md }}
                    >
                      <AppText
                        variant="label"
                        color={colors.inkMuted}
                        style={{ marginBottom: spacing.sm }}
                      >
                        Propuesta de la IA
                      </AppText>
                      <AppText variant="captionStrong">{propuestaIA.nombre}</AppText>
                      <AppText variant="micro" color={colors.inkMuted} style={{ marginTop: 2 }}>
                        Frecuencia: {propuestaIA.frecuencia} · Prioridad: {propuestaIA.prioridad}
                        {propuestaIA.asignado_a ? ` · Asignado a: ${propuestaIA.asignado_a}` : ''}
                      </AppText>
                      <Button
                        label="Usar esta propuesta"
                        icon="checkmark"
                        onPress={handleAplicarPropuestaIA}
                        style={{ marginTop: spacing.md }}
                      />
                    </Card>
                  ) : null}
                  <Button
                    label="Cancelar"
                    variant="ghost"
                    onPress={() => {
                      setModalVisible(false);
                      resetForm();
                    }}
                  />
                </>
              ) : (
                <>
                  <Field
                    label="Nombre *"
                    placeholder="Ej: Sacar la basura"
                    value={nombre}
                    onChangeText={setNombre}
                  />
                  <Field
                    label="Asignado a"
                    placeholder="Ej: Mamá (opcional)"
                    value={asignadoA}
                    onChangeText={setAsignadoA}
                  />

                  <AppText variant="label" color={colors.inkMuted} style={{ marginBottom: 6 }}>
                    Frecuencia
                  </AppText>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: spacing.sm,
                      marginBottom: spacing.lg,
                    }}
                  >
                    {FRECUENCIAS.map((f) => (
                      <Chip
                        key={f}
                        label={f}
                        active={frecuencia === f}
                        onPress={() => setFrecuencia(f)}
                        activeColor={colors.tasks}
                      />
                    ))}
                  </View>

                  <AppText variant="label" color={colors.inkMuted} style={{ marginBottom: 6 }}>
                    Prioridad
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
                    {PRIORIDADES.map((p) => (
                      <Chip
                        key={p}
                        label={p}
                        active={prioridad === p}
                        onPress={() => setPrioridad(p)}
                        activeColor={colors.tasks}
                        flex
                      />
                    ))}
                  </View>

                  <Button
                    label="Crear tarea"
                    icon="add"
                    onPress={handleAdd}
                    style={{ marginBottom: spacing.sm }}
                  />
                  <Button
                    label="Cancelar"
                    variant="ghost"
                    onPress={() => {
                      setModalVisible(false);
                      resetForm();
                    }}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
