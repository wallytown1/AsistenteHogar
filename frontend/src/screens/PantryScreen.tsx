import React, { useState, useEffect, useRef } from 'react';
import { View, Modal, ScrollView, Alert, Switch, Pressable, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { usePantry, getDiasParaCaducar } from '../hooks/usePantry';
import { useExpiryNotifications } from '../hooks/useExpiryNotifications';
import {
  AlimentoItem,
  AlimentoInterpretado,
  InterpretarDespensaResponse,
  SugerenciaMetadataResponse,
  DiaPlanComidas,
  RecetaSugerida,
  SugerenciasResponse,
} from '../types/types';
import { apiRequest, TIMEOUT } from '../api/api';
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
  FoodIcon,
  EmptyState,
  LoadingView,
  ErrorView,
} from '../components/ui';
import { getCategoriaIcon } from '../lib/categoria';
import { haptics } from '../lib/haptics';
import { usePurchasesStore } from '../state/purchasesStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const UMBRAL_BAJO_STOCK = 1;

type OcrItem = AlimentoInterpretado & { seleccionado: boolean };

function getItemStatus(item: AlimentoItem): { text: string; color: string } {
  const dias = getDiasParaCaducar(item.fecha_caducidad);
  if (dias !== null && dias <= 0) return { text: 'Caducado', color: colors.danger };
  if (dias !== null && dias <= 2) return { text: 'Caduca pronto', color: colors.warning };
  if (item.cantidad <= UMBRAL_BAJO_STOCK) return { text: 'Bajo stock', color: colors.danger };
  return { text: 'Stock correcto', color: colors.success };
}

export default function PantryScreen() {
  const {
    items,
    porcentajeStock,
    itemsDisponibles,
    alertasCaducidad,
    isLoading,
    error,
    addItem,
    updateQuantity,
    deleteItem,
    escanearTicketOcr,
    refetch,
  } = usePantry();
  // Programa notificaciones locales para alimentos próximos a caducar (≤3 días).
  useExpiryNotifications(items);
  const [modalVisible, setModalVisible] = useState(false);

  const isPremium = usePurchasesStore((s) => s.isPremium);
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const checkPremiumGate = () => {
    if (!isPremium) {
      navigation.navigate('Paywall');
      return false;
    }
    return true;
  };

  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [soloBajoStock, setSoloBajoStock] = useState(false);

  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('unidades');
  const [categoria, setCategoria] = useState('Despensa');
  const [fechaCaducidad, setFechaCaducidad] = useState('');

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [recetas, setRecetas] = useState<RecetaSugerida[]>([]);
  const [recetasMensaje, setRecetasMensaje] = useState<string | null>(null);
  const [recetasGeneradasPorIA, setRecetasGeneradasPorIA] = useState(false);

  // --- Modo del modal: manual o IA ---
  const [modoModal, setModoModal] = useState<'manual' | 'ia'>('manual');

  // --- Interpretar despensa en lenguaje natural ---
  const [textoIA, setTextoIA] = useState('');
  const [propuestasIA, setPropuestasIA] = useState<AlimentoInterpretado[]>([]);
  const [interpretandoIA, setInterpretandoIA] = useState(false);
  const [mensajeIA, setMensajeIA] = useState<string | null>(null);

  // --- Sugerir metadatos de alimento (categoría + caducidad estimada) ---
  const [sugirendoMetadata, setSugirendoMetadata] = useState(false);

  // --- Plan de comidas semanal ---
  const [planDias, setPlanDias] = useState<DiaPlanComidas[]>([]);
  const [planMensaje, setPlanMensaje] = useState<string | null>(null);
  const [planGeneradoPorIA, setPlanGeneradoPorIA] = useState(false);

  // Estado de carga unificado para recetas + plan (se cargan juntos desde /pantry/sugerencias)
  const [sugerenciasLoading, setSugerenciasLoading] = useState(false);
  const autoFetchedRef = useRef(false);

  // --- OCR en lote (flujo directo desde FAB de cámara) ---
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrReviewVisible, setOcrReviewVisible] = useState(false);
  const [ocrReviewItems, setOcrReviewItems] = useState<OcrItem[]>([]);
  const [ocrAdding, setOcrAdding] = useState(false);

  const resetModal = () => {
    setModalVisible(false);
    setModoModal('manual');
    setNombre('');
    setCantidad('');
    setUnidad('unidades');
    setCategoria('Despensa');
    setFechaCaducidad('');
    setTextoIA('');
    setPropuestasIA([]);
    setMensajeIA(null);
  };

  const handleInterpretarDespensa = async () => {
    if (!checkPremiumGate()) return;
    if (textoIA.trim().length < 3) {
      Alert.alert('Texto muy corto', 'Describe al menos 3 caracteres.');
      return;
    }
    setInterpretandoIA(true);
    setMensajeIA(null);
    setPropuestasIA([]);
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const res = await apiRequest<InterpretarDespensaResponse>('/pantry/interpretar', {
        method: 'POST',
        json: { texto: textoIA.trim(), fecha_referencia: hoy },
        timeoutMs: TIMEOUT.AI,
      });
      if (res.alimentos.length > 0) {
        setPropuestasIA(res.alimentos);
      } else {
        setMensajeIA(res.mensaje || 'No se identificaron productos en esa frase.');
      }
    } catch (err: any) {
      setMensajeIA(err.message || 'Error al interpretar el texto.');
    } finally {
      setInterpretandoIA(false);
    }
  };

  const handleEscanearTicketFab = async () => {
    if (!checkPremiumGate()) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para escanear tickets.');
        return;
      }
      Alert.alert('Escanear Ticket', '¿Cómo quieres añadir el ticket?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cámara',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
            procesarImagenParaRevision(result);
          },
        },
        {
          text: 'Galería',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              base64: true,
              quality: 0.6,
            });
            procesarImagenParaRevision(result);
          },
        },
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    }
  };

  const procesarImagenParaRevision = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0].base64) return;
    setOcrScanning(true);
    try {
      const alimentos = await escanearTicketOcr(result.assets[0].base64);
      if (alimentos.length > 0) {
        setOcrReviewItems(alimentos.map((a) => ({ ...a, seleccionado: true })));
        setOcrReviewVisible(true);
      } else {
        Alert.alert(
          'Sin resultados',
          'No se detectaron alimentos en el ticket. Intenta con una foto más nítida.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error analizando la imagen.');
    } finally {
      setOcrScanning(false);
    }
  };

  const toggleOcrItem = (idx: number) => {
    setOcrReviewItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, seleccionado: !item.seleccionado } : item))
    );
  };

  const handleConfirmarLote = async () => {
    const seleccionados = ocrReviewItems.filter((i) => i.seleccionado);
    if (seleccionados.length === 0) {
      Alert.alert('Sin selección', 'Selecciona al menos un producto para añadir.');
      return;
    }
    setOcrAdding(true);
    try {
      for (const alimento of seleccionados) {
        await addItem({
          nombre: alimento.nombre,
          cantidad: alimento.cantidad,
          unidad: alimento.unidad,
          categoria: alimento.categoria,
          fecha_caducidad: alimento.fecha_caducidad,
        });
      }
      haptics.success();
      setOcrReviewVisible(false);
      setOcrReviewItems([]);
      Alert.alert(
        'Productos añadidos',
        `${seleccionados.length} producto${seleccionados.length === 1 ? '' : 's'} añadido${seleccionados.length === 1 ? '' : 's'} a tu despensa.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al añadir los productos.');
    } finally {
      setOcrAdding(false);
    }
  };

  const handleConfirmarAlimento = async (alimento: AlimentoInterpretado, idx: number) => {
    try {
      await addItem({
        nombre: alimento.nombre,
        cantidad: alimento.cantidad,
        unidad: alimento.unidad,
        categoria: alimento.categoria,
        fecha_caducidad: alimento.fecha_caducidad,
      });
      haptics.success();
      setPropuestasIA((prev) => prev.filter((_, i) => i !== idx));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo añadir el producto.');
    }
  };

  const handleSugerirMetadata = async () => {
    if (!checkPremiumGate()) return;
    if (nombre.trim().length < 2) return;
    setSugirendoMetadata(true);
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const res = await apiRequest<SugerenciaMetadataResponse>('/pantry/sugerir-metadata', {
        method: 'POST',
        json: { nombre: nombre.trim(), fecha_referencia: hoy },
      });
      if (res.categoria) setCategoria(res.categoria);
      if (res.fecha_caducidad_estimada) setFechaCaducidad(res.fecha_caducidad_estimada);
    } catch {
      // Sugerencia de metadatos es best-effort: fallo silencioso
    } finally {
      setSugirendoMetadata(false);
    }
  };

  const fetchSugerencias = async (manual = false) => {
    if (manual && !checkPremiumGate()) return;
    setSugerenciasLoading(true);
    setRecetasMensaje(null);
    setPlanMensaje(null);
    try {
      const res = await apiRequest<SugerenciasResponse>('/pantry/sugerencias', {
        timeoutMs: TIMEOUT.OCR_FULL,
      });
      setRecetas(res.recetas.recetas);
      setRecetasGeneradasPorIA(res.recetas.generado_por_ia);
      if (res.recetas.recetas.length === 0)
        setRecetasMensaje(res.recetas.mensaje || 'No hay sugerencias disponibles.');
      setPlanDias(res.plan_comidas.dias);
      setPlanGeneradoPorIA(res.plan_comidas.generado_por_ia);
      if (res.plan_comidas.dias.length === 0)
        setPlanMensaje(res.plan_comidas.mensaje || 'No hay suficientes datos para el plan.');
    } catch (err: any) {
      const msg = err.message || 'Error al cargar las sugerencias.';
      setRecetasMensaje(msg);
      setPlanMensaje(msg);
    } finally {
      setSugerenciasLoading(false);
    }
  };

  // Precarga en background cuando los items están listos y el usuario es premium
  useEffect(() => {
    if (items.length > 0 && isPremium && !autoFetchedRef.current) {
      autoFetchedRef.current = true;
      fetchSugerencias();
    }
    // fetchSugerencias es estable dentro del render; autoFetchedRef garantiza ejecución única
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, isPremium]);

  // Loader completo solo en carga inicial; en refrescos se usa el spinner nativo.
  if (isLoading && items.length === 0)
    return <LoadingView message="Cargando inventario de la despensa..." />;
  if (error && items.length === 0) return <ErrorView message={error} onRetry={refetch} />;

  const toggleSelectProduct = (id: string) => {
    haptics.selection();
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleAdd = () => {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre del producto es obligatorio.');
      return;
    }
    const qty = parseFloat(cantidad);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert(
        'Valor no válido',
        'La cantidad del producto debe ser un número estrictamente mayor que 0.'
      );
      return;
    }

    // IA Pasiva - Confirmar adición manual del usuario
    Alert.alert(
      'Confirmar adición',
      `¿Deseas agregar ${qty} ${unidad} de "${nombre}" al inventario?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: () => {
            addItem({
              nombre: nombre.trim(),
              cantidad: qty,
              unidad: unidad.trim(),
              categoria: categoria.trim(),
              fecha_caducidad: fechaCaducidad || null,
            });
            haptics.success();
            resetModal();
            Alert.alert('Éxito', 'El producto ha sido registrado.');
          },
        },
      ]
    );
  };

  const handleBatchAction = (action: string) => {
    if (selectedItems.length === 0) {
      Alert.alert('Selección vacía', 'Por favor, selecciona al menos un artículo.');
      return;
    }
    Alert.alert(
      'Confirmar acción por lote',
      `¿Deseas aplicar la acción "${action}" sobre los ${selectedItems.length} artículos seleccionados?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          onPress: () => {
            if (action === 'usar') {
              const promises = selectedItems.map((id) =>
                apiRequest(`/pantry/${id}`, { method: 'DELETE' })
              );
              Promise.all(promises)
                .then(() => {
                  refetch();
                  Alert.alert(
                    'Inventario actualizado',
                    'Los artículos seleccionados han sido marcados como usados.'
                  );
                })
                .catch((err) => {
                  Alert.alert('Error', err.message || 'Error al eliminar artículos.');
                })
                .finally(() => {
                  setSelectedItems([]);
                });
            } else {
              const promises = selectedItems.map((id) => {
                const item = items.find((i) => i.id === id);
                const currentQty = item ? item.cantidad : 0;
                return apiRequest(`/pantry/${id}`, {
                  method: 'PATCH',
                  json: { cantidad: currentQty + 1 },
                });
              });
              Promise.all(promises)
                .then(() => {
                  refetch();
                  Alert.alert(
                    'Inventario actualizado',
                    'Se ha incrementado el stock de los artículos seleccionados.'
                  );
                })
                .catch((err) => {
                  Alert.alert('Error', err.message || 'Error al incrementar el stock.');
                })
                .finally(() => {
                  setSelectedItems([]);
                });
            }
          },
        },
      ]
    );
  };

  const itemsBajoStock = items.filter((i) => i.cantidad <= UMBRAL_BAJO_STOCK);

  const itemsFiltrados = items.filter((item) => {
    if (filtroCategoria && !item.categoria.toLowerCase().includes(filtroCategoria.toLowerCase()))
      return false;
    if (soloBajoStock) return item.cantidad <= UMBRAL_BAJO_STOCK;
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen bottomExtra={72} refreshing={isLoading} onRefresh={refetch}>
        <AppText variant="display" style={{ marginBottom: spacing.lg }}>
          Despensa
        </AppText>

        {/* Métricas */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          <StatCard
            label="Stock total"
            value={`${porcentajeStock}%`}
            icon="cube-outline"
            accent={colors.pantry}
            accentSoft={colors.pantrySoft}
            progress={porcentajeStock}
            footnote={`${itemsDisponibles} items disponibles`}
          />
          <StatCard
            label="A caducar"
            value={String(alertasCaducidad.length)}
            icon="alert-circle-outline"
            accent={colors.warning}
            accentSoft={colors.warningSoft}
            footnote="Notificaciones activas"
          />
        </View>

        {/* Recomendaciones de compra */}
        {itemsBajoStock.length > 0 ? (
          <Card
            style={{ marginBottom: spacing.lg }}
            tint={colors.warningSoft}
            borderColor="#FBE7BE"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="cart-outline" size={16} color={colors.warning} />
              <AppText variant="label" color="#B45309">
                Recomendaciones de compra
              </AppText>
            </View>
            <AppText variant="captionStrong" color="#92400E">
              {itemsBajoStock.map((i) => i.nombre).join(', ')}
            </AppText>
          </Card>
        ) : null}

        {/* Filtros */}
        <Card style={{ marginBottom: spacing.lg }}>
          <AppText variant="captionStrong" style={{ marginBottom: spacing.md }}>
            Filtros
          </AppText>
          <Field
            placeholder="Categoría (ej. Lácteos)"
            value={filtroCategoria}
            onChangeText={setFiltroCategoria}
            containerStyle={{ marginBottom: spacing.md }}
          />
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <AppText variant="caption" color={colors.inkMuted}>
              Solo mostrar bajo stock
            </AppText>
            <Switch
              value={soloBajoStock}
              onValueChange={(v) => {
                haptics.selection();
                setSoloBajoStock(v);
              }}
              trackColor={{ false: colors.track, true: colors.pantry }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.track}
            />
          </View>
        </Card>

        {/* Acciones por lote */}
        <View style={{ marginBottom: spacing.lg }}>
          <AppText variant="label" color={colors.inkFaint} style={{ marginBottom: spacing.sm }}>
            Acciones por lote{selectedItems.length > 0 ? ` (${selectedItems.length})` : ''}
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Marcar usado"
                icon="checkmark-done-outline"
                variant="secondary"
                size="sm"
                onPress={() => handleBatchAction('usar')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Agregar más"
                icon="add"
                variant="secondary"
                size="sm"
                onPress={() => handleBatchAction('agregar')}
              />
            </View>
          </View>
        </View>

        {/* Listado */}
        {itemsFiltrados.length === 0 ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <EmptyState
              icon="basket-outline"
              accent={colors.pantry}
              accentSoft={colors.pantrySoft}
              title="Sin productos"
              subtitle="Pulsa + para añadir el primer producto a tu despensa."
            />
          </Card>
        ) : (
          itemsFiltrados.map((item) => {
            const status = getItemStatus(item);
            const isSelected = selectedItems.includes(item.id);
            return (
              <Card key={item.id} padding={spacing.lg} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* Checkbox de lote */}
                  <Pressable
                    onPress={() => toggleSelectProduct(item.id)}
                    hitSlop={8}
                    accessibilityLabel={`Seleccionar ${item.nombre}`}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      marginRight: spacing.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isSelected ? 0 : 2,
                      borderColor: colors.borderStrong,
                      backgroundColor: isSelected ? colors.pantry : colors.cardAlt,
                    }}
                  >
                    {isSelected ? <Icon name="checkmark" size={14} color={colors.white} /> : null}
                  </Pressable>

                  {/* Icono categoría */}
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: radius.md,
                      backgroundColor: colors.pantrySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: spacing.md,
                    }}
                  >
                    <FoodIcon
                      name={getCategoriaIcon(item.categoria)}
                      size={24}
                      color={colors.pantry}
                    />
                  </View>

                  {/* Detalles */}
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <AppText variant="captionStrong" numberOfLines={1}>
                      {item.nombre}
                    </AppText>
                    <AppText variant="micro" color={colors.inkMuted} style={{ marginTop: 1 }}>
                      {item.cantidad} {item.unidad} · {item.categoria}
                    </AppText>
                    <AppText variant="micro" color={colors.inkFaint} style={{ marginTop: 1 }}>
                      Caduca: {item.fecha_caducidad || 'Indefinido'}
                    </AppText>
                  </View>

                  {/* Eliminar */}
                  <IconButton
                    name="trash-outline"
                    size={16}
                    color={colors.danger}
                    bg={colors.dangerSoft}
                    diameter={32}
                    accessibilityLabel={`Eliminar ${item.nombre}`}
                    onPress={() => {
                      Alert.alert(
                        'Confirmar eliminación',
                        `¿Deseas eliminar "${item.nombre}" del inventario?`,
                        [
                          { text: 'No', style: 'cancel' },
                          { text: 'Sí', style: 'destructive', onPress: () => deleteItem(item.id) },
                        ]
                      );
                    }}
                  />
                </View>

                {/* Fila inferior: estado + stepper */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: spacing.md,
                  }}
                >
                  <View style={{ flex: 1, marginRight: spacing.md }}>
                    <View
                      style={{
                        height: 5,
                        backgroundColor: colors.track,
                        borderRadius: radius.pill,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round((item.cantidad / 5) * 100))}%`,
                          backgroundColor: status.color,
                          borderRadius: radius.pill,
                        }}
                      />
                    </View>
                    <AppText
                      variant="micro"
                      color={status.color}
                      style={{ marginTop: 4, fontWeight: '700' }}
                    >
                      {status.text}
                    </AppText>
                  </View>

                  {/* Stepper */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.cardAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.pill,
                      paddingHorizontal: 4,
                      paddingVertical: 3,
                      gap: spacing.sm,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        const nuevaCant = item.cantidad - 1;
                        if (nuevaCant <= 0) {
                          Alert.alert(
                            'Cantidad inválida',
                            'La cantidad debe ser mayor que 0. Usa el botón de eliminar si deseas borrar el producto.'
                          );
                          return;
                        }
                        Alert.alert(
                          'Confirmar decremento',
                          `¿Deseas disminuir la cantidad de "${item.nombre}" a ${nuevaCant} ${item.unidad}?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Confirmar',
                              onPress: () => {
                                haptics.light();
                                updateQuantity(item.id, nuevaCant);
                              },
                            },
                          ]
                        );
                      }}
                      hitSlop={6}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: radius.pill,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.borderStrong,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="remove" size={16} color={colors.ink} />
                    </Pressable>
                    <AppText variant="captionStrong" style={{ minWidth: 18, textAlign: 'center' }}>
                      {item.cantidad}
                    </AppText>
                    <Pressable
                      onPress={() => {
                        const nuevaCant = item.cantidad + 1;
                        Alert.alert(
                          'Confirmar incremento',
                          `¿Deseas aumentar la cantidad de "${item.nombre}" a ${nuevaCant} ${item.unidad}?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Confirmar',
                              onPress: () => {
                                haptics.light();
                                updateQuantity(item.id, nuevaCant);
                              },
                            },
                          ]
                        );
                      }}
                      hitSlop={6}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: radius.pill,
                        backgroundColor: colors.pantry,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="add" size={16} color={colors.white} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        {/* Recetas sugeridas por IA */}
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Icon name="sparkles" size={16} color={colors.brand} />
              <AppText variant="h2">Recetas sugeridas</AppText>
            </View>
            <Button
              label={
                sugerenciasLoading
                  ? 'Cargando...'
                  : recetas.length > 0
                    ? 'Actualizar'
                    : 'Sugerir con IA'
              }
              size="sm"
              variant="secondary"
              loading={sugerenciasLoading}
              onPress={() => fetchSugerencias(true)}
              fullWidth={false}
            />
          </View>

          {sugerenciasLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <ActivityIndicator size="small" color={colors.brand} />
              <AppText variant="micro" color={colors.inkMuted} style={{ marginTop: spacing.sm }}>
                El chef IA está revisando tu despensa...
              </AppText>
            </View>
          ) : null}

          {!sugerenciasLoading && recetasMensaje ? (
            <AppText
              variant="caption"
              color={colors.inkMuted}
              center
              style={{ paddingVertical: spacing.md }}
            >
              {recetasMensaje}
            </AppText>
          ) : null}

          {!sugerenciasLoading && recetas.length === 0 && !recetasMensaje ? (
            <AppText
              variant="caption"
              color={colors.inkFaint}
              center
              style={{ paddingVertical: spacing.md, lineHeight: 18 }}
            >
              Pulsa «Sugerir con IA» para recibir recetas que aprovechen tu despensa, priorizando lo
              que caduca pronto.
            </AppText>
          ) : null}

          {/* Transparencia IA (EU AI Act): solo cuando las recetas provienen del modelo */}
          {!sugerenciasLoading && recetas.length > 0 && recetasGeneradasPorIA ? (
            <AIDisclaimerBanner texto="Estas recetas han sido generadas por IA y pueden contener imprecisiones." />
          ) : null}

          {!sugerenciasLoading &&
            recetas.map((receta, idx) => (
              <View
                key={`${receta.titulo}-${idx}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flex: 1, paddingRight: spacing.md }}>
                  <AppText variant="captionStrong" numberOfLines={1}>
                    {receta.titulo}
                  </AppText>
                  <AppText
                    variant="micro"
                    color={colors.inkMuted}
                    numberOfLines={1}
                    style={{ marginTop: 1 }}
                  >
                    {receta.tiempo_min} min · {receta.ingredientes_usados.slice(0, 3).join(', ')}
                  </AppText>
                </View>
                <Button
                  label="Ver"
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() =>
                    Alert.alert(
                      receta.titulo,
                      `Ingredientes: ${receta.ingredientes_usados.join(', ')}\n\nPasos:\n${receta.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
                    )
                  }
                />
              </View>
            ))}
        </Card>

        {/* Plan de comidas semanal (IA) */}
        <Card style={{ marginTop: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Icon name="restaurant-outline" size={16} color={colors.brand} />
              <AppText variant="h2">Plan semanal</AppText>
            </View>
            <Button
              label={
                sugerenciasLoading
                  ? 'Cargando...'
                  : planDias.length > 0
                    ? 'Actualizar'
                    : 'Generar con IA'
              }
              size="sm"
              variant="secondary"
              loading={sugerenciasLoading}
              onPress={() => fetchSugerencias(true)}
              fullWidth={false}
            />
          </View>

          {sugerenciasLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <ActivityIndicator size="small" color={colors.brand} />
              <AppText variant="micro" color={colors.inkMuted} style={{ marginTop: spacing.sm }}>
                Planificando tu semana...
              </AppText>
            </View>
          ) : null}

          {!sugerenciasLoading && planMensaje ? (
            <AppText
              variant="caption"
              color={colors.inkMuted}
              center
              style={{ paddingVertical: spacing.md }}
            >
              {planMensaje}
            </AppText>
          ) : null}

          {!sugerenciasLoading && planDias.length === 0 && !planMensaje ? (
            <AppText
              variant="caption"
              color={colors.inkFaint}
              center
              style={{ paddingVertical: spacing.md, lineHeight: 18 }}
            >
              Pulsa «Generar con IA» para crear un plan semanal aprovechando tu despensa.
            </AppText>
          ) : null}

          {!sugerenciasLoading && planDias.length > 0 && planGeneradoPorIA ? (
            <AIDisclaimerBanner texto="Este plan ha sido generado por IA y puede contener imprecisiones." />
          ) : null}

          {!sugerenciasLoading &&
            planDias.map((dia, idx) => (
              <View
                key={`${dia.dia}-${idx}`}
                style={{
                  paddingVertical: spacing.sm,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <AppText variant="captionStrong" color={colors.brand} style={{ marginBottom: 2 }}>
                  {dia.dia}
                </AppText>
                <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="micro" color={colors.inkFaint}>
                      Comida
                    </AppText>
                    <AppText variant="caption" color={colors.ink}>
                      {dia.comida}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="micro" color={colors.inkFaint}>
                      Cena
                    </AppText>
                    <AppText variant="caption" color={colors.ink}>
                      {dia.cena}
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
        </Card>
      </Screen>

      {/* FAB principal: añadir producto manualmente */}
      <Fab
        icon="add"
        color={colors.pantry}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Añadir producto a la despensa"
      />
      {/* FAB secundario: escanear ticket con OCR (apilado encima del principal) */}
      <Fab
        icon="receipt-outline"
        color={colors.brand}
        bottom={88}
        onPress={handleEscanearTicketFab}
        accessibilityLabel="Escanear ticket de compra"
      />

      {/* Overlay de escaneo OCR */}
      <Modal visible={ocrScanning} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.overlay,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xxl,
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <ActivityIndicator size="large" color={colors.pantry} />
            <AppText variant="caption" color={colors.inkMuted}>
              Analizando ticket...
            </AppText>
          </View>
        </View>
      </Modal>

      {/* Modal de revisión en lote (resultado del OCR) */}
      <Modal
        visible={ocrReviewVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setOcrReviewVisible(false);
          setOcrReviewItems([]);
        }}
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginBottom: spacing.xs,
              }}
            >
              <Icon name="receipt-outline" size={20} color={colors.pantry} />
              <AppText variant="h2">Productos detectados</AppText>
            </View>
            <AppText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.md }}>
              Desmarca los que no quieras añadir y pulsa «Añadir seleccionados».
            </AppText>
            <AIDisclaimerBanner texto="Productos extraídos por IA. Revisa cantidades y fechas antes de confirmar." />
            <ScrollView showsVerticalScrollIndicator={false}>
              {ocrReviewItems.map((alimento, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => toggleOcrItem(idx)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                    borderBottomWidth: idx < ocrReviewItems.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      marginRight: spacing.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: alimento.seleccionado ? 0 : 2,
                      borderColor: colors.borderStrong,
                      backgroundColor: alimento.seleccionado ? colors.pantry : colors.cardAlt,
                    }}
                  >
                    {alimento.seleccionado ? (
                      <Icon name="checkmark" size={14} color={colors.white} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText
                      variant="captionStrong"
                      color={alimento.seleccionado ? colors.ink : colors.inkFaint}
                    >
                      {alimento.nombre}
                    </AppText>
                    <AppText variant="micro" color={colors.inkMuted}>
                      {alimento.cantidad} {alimento.unidad} · {alimento.categoria}
                      {alimento.fecha_caducidad ? ` · Cad: ${alimento.fecha_caducidad}` : ''}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                label={
                  ocrAdding
                    ? 'Añadiendo...'
                    : `Añadir seleccionados (${ocrReviewItems.filter((i) => i.seleccionado).length})`
                }
                icon="checkmark-done"
                loading={ocrAdding}
                onPress={handleConfirmarLote}
              />
              <Button
                label="Cancelar"
                variant="ghost"
                onPress={() => {
                  setOcrReviewVisible(false);
                  setOcrReviewItems([]);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Añadir Producto */}
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
              Añadir producto
            </AppText>

            {/* Tabs: Manual / Con IA (el ticket va por el FAB de cámara) */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              <Chip
                label="Manual"
                active={modoModal === 'manual'}
                onPress={() => setModoModal('manual')}
                activeColor={colors.pantry}
                flex
              />
              <Chip
                label="Describir con IA"
                active={modoModal === 'ia'}
                onPress={() => setModoModal('ia')}
                activeColor={colors.brand}
                flex
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {modoModal === 'ia' ? (
                <>
                  <AIDisclaimerBanner texto="La IA interpretará tu frase y propondrá los productos. Confirma cada uno antes de añadirlo." />
                  <Field
                    label="¿Qué compraste?"
                    placeholder='Ej: "6 huevos y 1 litro de leche que caduca el viernes"'
                    value={textoIA}
                    onChangeText={setTextoIA}
                    containerStyle={{ marginBottom: spacing.md }}
                  />
                  <Button
                    label={interpretandoIA ? 'Interpretando...' : 'Interpretar'}
                    icon="sparkles"
                    loading={interpretandoIA}
                    onPress={handleInterpretarDespensa}
                    style={{ marginBottom: spacing.md }}
                  />
                  {mensajeIA ? (
                    <AppText
                      variant="caption"
                      color={colors.inkMuted}
                      center
                      style={{ marginBottom: spacing.md }}
                    >
                      {mensajeIA}
                    </AppText>
                  ) : null}
                  {propuestasIA.map((alimento, idx) => (
                    <Card
                      key={idx}
                      tint={colors.pantrySoft}
                      borderColor={colors.pantry}
                      style={{ marginBottom: spacing.sm }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View style={{ flex: 1, marginRight: spacing.md }}>
                          <AppText variant="captionStrong">{alimento.nombre}</AppText>
                          <AppText variant="micro" color={colors.inkMuted}>
                            {alimento.cantidad} {alimento.unidad} · {alimento.categoria}
                            {alimento.fecha_caducidad ? ` · Cad: ${alimento.fecha_caducidad}` : ''}
                          </AppText>
                        </View>
                        <Button
                          label="Añadir"
                          size="sm"
                          variant="secondary"
                          fullWidth={false}
                          onPress={() => handleConfirmarAlimento(alimento, idx)}
                        />
                      </View>
                    </Card>
                  ))}
                  <Button
                    label="Cancelar"
                    variant="ghost"
                    onPress={resetModal}
                    style={{ marginTop: spacing.sm }}
                  />
                </>
              ) : (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <AppText variant="label" color={colors.inkMuted}>
                      Nombre *
                    </AppText>
                    {nombre.trim().length >= 2 ? (
                      <Button
                        label={sugirendoMetadata ? 'Sugiriendo...' : 'Sugerir ✦'}
                        size="sm"
                        variant="ghost"
                        fullWidth={false}
                        loading={sugirendoMetadata}
                        onPress={handleSugerirMetadata}
                      />
                    ) : null}
                  </View>
                  <Field placeholder="Ej: Leche entera" value={nombre} onChangeText={setNombre} />
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Cantidad *"
                        placeholder="1"
                        keyboardType="numeric"
                        value={cantidad}
                        onChangeText={setCantidad}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Unidad"
                        placeholder="unidades"
                        value={unidad}
                        onChangeText={setUnidad}
                      />
                    </View>
                  </View>
                  <Field
                    label="Categoría"
                    placeholder="Despensa"
                    value={categoria}
                    onChangeText={setCategoria}
                  />
                  <Field
                    label="Caducidad (YYYY-MM-DD)"
                    placeholder="2026-06-16"
                    value={fechaCaducidad}
                    onChangeText={setFechaCaducidad}
                    containerStyle={{ marginBottom: spacing.xl }}
                  />
                  <Button
                    label="Añadir producto"
                    icon="add"
                    onPress={handleAdd}
                    style={{ marginBottom: spacing.sm }}
                  />
                  <Button label="Cancelar" variant="ghost" onPress={resetModal} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
