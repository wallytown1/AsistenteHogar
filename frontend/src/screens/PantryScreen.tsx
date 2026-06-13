import React, { useState } from 'react';
import { View, Modal, ScrollView, Alert, Switch, Pressable, ActivityIndicator } from 'react-native';
import { usePantry, getDiasParaCaducar } from '../hooks/usePantry';
import { AlimentoItem, RecetaSugerida, RecetasSugeridasResponse } from '../types/types';
import { apiRequest } from '../api/api';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';
import { colors, radius, spacing } from '../theme/tokens';
import {
  Screen,
  Card,
  StatCard,
  Button,
  IconButton,
  Field,
  Fab,
  AppText,
  Icon,
  FoodIcon,
  Badge,
  EmptyState,
  LoadingView,
  ErrorView,
} from '../components/ui';
import { getCategoriaIcon } from '../lib/categoria';
import { haptics } from '../lib/haptics';

const UMBRAL_BAJO_STOCK = 1;

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
    refetch,
  } = usePantry();
  const [modalVisible, setModalVisible] = useState(false);

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
  const [recetasLoading, setRecetasLoading] = useState(false);
  const [recetasGeneradasPorIA, setRecetasGeneradasPorIA] = useState(false);

  const fetchRecetas = async () => {
    setRecetasLoading(true);
    setRecetasMensaje(null);
    try {
      const res = await apiRequest<RecetasSugeridasResponse>('/pantry/recetas');
      setRecetas(res.recetas);
      setRecetasGeneradasPorIA(res.generado_por_ia);
      if (res.recetas.length === 0) {
        setRecetasMensaje(res.mensaje || 'No hay sugerencias disponibles en este momento.');
      }
    } catch (err: any) {
      setRecetas([]);
      setRecetasGeneradasPorIA(false);
      setRecetasMensaje(err.message || 'No se pudieron generar las recetas.');
    } finally {
      setRecetasLoading(false);
    }
  };

  if (isLoading) return <LoadingView message="Cargando inventario de la despensa..." />;
  if (error) return <ErrorView message={error} onRetry={refetch} />;

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
      Alert.alert('Valor no válido', 'La cantidad del producto debe ser un número estrictamente mayor que 0.');
      return;
    }

    // IA Pasiva - Confirmar adición manual del usuario
    Alert.alert('Confirmar adición', `¿Deseas agregar ${qty} ${unidad} de "${nombre}" al inventario?`, [
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
          setModalVisible(false);
          setNombre(''); setCantidad(''); setFechaCaducidad('');
          Alert.alert('Éxito', 'El producto ha sido registrado.');
        },
      },
    ]);
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
              const promises = selectedItems.map((id) => apiRequest(`/pantry/${id}`, { method: 'DELETE' }));
              Promise.all(promises)
                .then(() => { refetch(); Alert.alert('Inventario actualizado', 'Los artículos seleccionados han sido marcados como usados.'); })
                .catch((err) => { Alert.alert('Error', err.message || 'Error al eliminar artículos.'); })
                .finally(() => { setSelectedItems([]); });
            } else {
              const promises = selectedItems.map((id) => {
                const item = items.find((i) => i.id === id);
                const currentQty = item ? item.cantidad : 0;
                return apiRequest(`/pantry/${id}`, { method: 'PATCH', json: { cantidad: currentQty + 1 } });
              });
              Promise.all(promises)
                .then(() => { refetch(); Alert.alert('Inventario actualizado', 'Se ha incrementado el stock de los artículos seleccionados.'); })
                .catch((err) => { Alert.alert('Error', err.message || 'Error al incrementar el stock.'); })
                .finally(() => { setSelectedItems([]); });
            }
          },
        },
      ]
    );
  };

  const itemsBajoStock = items.filter((i) => i.cantidad <= UMBRAL_BAJO_STOCK);

  const itemsFiltrados = items.filter((item) => {
    if (filtroCategoria && !item.categoria.toLowerCase().includes(filtroCategoria.toLowerCase())) return false;
    if (soloBajoStock) return item.cantidad <= UMBRAL_BAJO_STOCK;
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen bottomExtra={72} refreshing={isLoading} onRefresh={refetch}>
        <AppText variant="display" style={{ marginBottom: spacing.lg }}>Despensa</AppText>

        {/* Métricas */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          <StatCard label="Stock total" value={`${porcentajeStock}%`} icon="cube-outline" accent={colors.pantry} accentSoft={colors.pantrySoft} progress={porcentajeStock} footnote={`${itemsDisponibles} items disponibles`} />
          <StatCard label="A caducar" value={String(alertasCaducidad.length)} icon="alert-circle-outline" accent={colors.warning} accentSoft={colors.warningSoft} footnote="Notificaciones activas" />
        </View>

        {/* Recomendaciones de compra */}
        {itemsBajoStock.length > 0 ? (
          <Card style={{ marginBottom: spacing.lg }} tint={colors.warningSoft} borderColor="#FBE7BE">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="cart-outline" size={16} color={colors.warning} />
              <AppText variant="label" color="#B45309">Recomendaciones de compra</AppText>
            </View>
            <AppText variant="captionStrong" color="#92400E">{itemsBajoStock.map((i) => i.nombre).join(', ')}</AppText>
          </Card>
        ) : null}

        {/* Filtros */}
        <Card style={{ marginBottom: spacing.lg }}>
          <AppText variant="captionStrong" style={{ marginBottom: spacing.md }}>Filtros</AppText>
          <Field placeholder="Categoría (ej. Lácteos)" value={filtroCategoria} onChangeText={setFiltroCategoria} containerStyle={{ marginBottom: spacing.md }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="caption" color={colors.inkMuted}>Solo mostrar bajo stock</AppText>
            <Switch
              value={soloBajoStock}
              onValueChange={(v) => { haptics.selection(); setSoloBajoStock(v); }}
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
            <View style={{ flex: 1 }}><Button label="Marcar usado" icon="checkmark-done-outline" variant="secondary" size="sm" onPress={() => handleBatchAction('usar')} /></View>
            <View style={{ flex: 1 }}><Button label="Agregar más" icon="add" variant="secondary" size="sm" onPress={() => handleBatchAction('agregar')} /></View>
          </View>
        </View>

        {/* Listado */}
        {itemsFiltrados.length === 0 ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <EmptyState icon="basket-outline" accent={colors.pantry} accentSoft={colors.pantrySoft} title="Sin productos" subtitle="Pulsa + para añadir el primer producto a tu despensa." />
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
                    style={{ width: 22, height: 22, borderRadius: 7, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: isSelected ? 0 : 2, borderColor: colors.borderStrong, backgroundColor: isSelected ? colors.pantry : colors.cardAlt }}
                  >
                    {isSelected ? <Icon name="checkmark" size={14} color={colors.white} /> : null}
                  </Pressable>

                  {/* Icono categoría */}
                  <View style={{ width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.pantrySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                    <FoodIcon name={getCategoriaIcon(item.categoria)} size={24} color={colors.pantry} />
                  </View>

                  {/* Detalles */}
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <AppText variant="captionStrong" numberOfLines={1}>{item.nombre}</AppText>
                    <AppText variant="micro" color={colors.inkMuted} style={{ marginTop: 1 }}>{item.cantidad} {item.unidad} · {item.categoria}</AppText>
                    <AppText variant="micro" color={colors.inkFaint} style={{ marginTop: 1 }}>Caduca: {item.fecha_caducidad || 'Indefinido'}</AppText>
                  </View>

                  {/* Eliminar */}
                  <IconButton name="trash-outline" size={16} color={colors.danger} bg={colors.dangerSoft} diameter={32} accessibilityLabel={`Eliminar ${item.nombre}`} onPress={() => {
                    Alert.alert('Confirmar eliminación', `¿Deseas eliminar "${item.nombre}" del inventario?`, [
                      { text: 'No', style: 'cancel' },
                      { text: 'Sí', style: 'destructive', onPress: () => deleteItem(item.id) },
                    ]);
                  }} />
                </View>

                {/* Fila inferior: estado + stepper */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
                  <View style={{ flex: 1, marginRight: spacing.md }}>
                    <View style={{ height: 5, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${Math.min(100, Math.round((item.cantidad / 5) * 100))}%`, backgroundColor: status.color, borderRadius: radius.pill }} />
                    </View>
                    <AppText variant="micro" color={status.color} style={{ marginTop: 4, fontWeight: '700' }}>{status.text}</AppText>
                  </View>

                  {/* Stepper */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 4, paddingVertical: 3, gap: spacing.sm }}>
                    <Pressable
                      onPress={() => {
                        const nuevaCant = item.cantidad - 1;
                        if (nuevaCant <= 0) {
                          Alert.alert('Cantidad inválida', 'La cantidad debe ser mayor que 0. Usa el botón de eliminar si deseas borrar el producto.');
                          return;
                        }
                        Alert.alert('Confirmar decremento', `¿Deseas disminuir la cantidad de "${item.nombre}" a ${nuevaCant} ${item.unidad}?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Confirmar', onPress: () => { haptics.light(); updateQuantity(item.id, nuevaCant); } },
                        ]);
                      }}
                      hitSlop={6}
                      style={{ width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="remove" size={16} color={colors.ink} />
                    </Pressable>
                    <AppText variant="captionStrong" style={{ minWidth: 18, textAlign: 'center' }}>{item.cantidad}</AppText>
                    <Pressable
                      onPress={() => {
                        const nuevaCant = item.cantidad + 1;
                        Alert.alert('Confirmar incremento', `¿Deseas aumentar la cantidad de "${item.nombre}" a ${nuevaCant} ${item.unidad}?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Confirmar', onPress: () => { haptics.light(); updateQuantity(item.id, nuevaCant); } },
                        ]);
                      }}
                      hitSlop={6}
                      style={{ width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.pantry, alignItems: 'center', justifyContent: 'center' }}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Icon name="sparkles" size={16} color={colors.brand} />
              <AppText variant="h2">Recetas sugeridas</AppText>
            </View>
            <Button
              label={recetasLoading ? 'Pensando...' : recetas.length > 0 ? 'Actualizar' : 'Sugerir con IA'}
              size="sm"
              variant="secondary"
              loading={recetasLoading}
              onPress={fetchRecetas}
              fullWidth={false}
            />
          </View>

          {recetasLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <ActivityIndicator size="small" color={colors.brand} />
              <AppText variant="micro" color={colors.inkMuted} style={{ marginTop: spacing.sm }}>El chef IA está revisando tu despensa...</AppText>
            </View>
          ) : null}

          {!recetasLoading && recetasMensaje ? (
            <AppText variant="caption" color={colors.inkMuted} center style={{ paddingVertical: spacing.md }}>{recetasMensaje}</AppText>
          ) : null}

          {!recetasLoading && recetas.length === 0 && !recetasMensaje ? (
            <AppText variant="caption" color={colors.inkFaint} center style={{ paddingVertical: spacing.md, lineHeight: 18 }}>
              Pulsa "Sugerir con IA" para recibir recetas que aprovechen tu despensa, priorizando lo que caduca pronto.
            </AppText>
          ) : null}

          {/* Transparencia IA (EU AI Act): solo cuando las recetas provienen del modelo */}
          {!recetasLoading && recetas.length > 0 && recetasGeneradasPorIA ? (
            <AIDisclaimerBanner texto="Estas recetas han sido generadas por IA y pueden contener imprecisiones." />
          ) : null}

          {!recetasLoading && recetas.map((receta, idx) => (
            <View key={`${receta.titulo}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <AppText variant="captionStrong" numberOfLines={1}>{receta.titulo}</AppText>
                <AppText variant="micro" color={colors.inkMuted} numberOfLines={1} style={{ marginTop: 1 }}>
                  {receta.tiempo_min} min · {receta.ingredientes_usados.slice(0, 3).join(', ')}
                </AppText>
              </View>
              <Button
                label="Ver"
                size="sm"
                variant="ghost"
                fullWidth={false}
                onPress={() => Alert.alert(
                  receta.titulo,
                  `Ingredientes: ${receta.ingredientes_usados.join(', ')}\n\nPasos:\n${receta.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
                )}
              />
            </View>
          ))}
        </Card>
      </Screen>

      <Fab icon="add" color={colors.pantry} onPress={() => setModalVisible(true)} accessibilityLabel="Añadir producto a la despensa" />

      {/* Modal Añadir Producto */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: spacing.xxxl, maxHeight: '88%' }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
            </View>
            <AppText variant="h2" style={{ marginBottom: spacing.lg }}>Añadir producto</AppText>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Field label="Nombre *" placeholder="Ej: Leche entera" value={nombre} onChangeText={setNombre} />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}><Field label="Cantidad *" placeholder="1" keyboardType="numeric" value={cantidad} onChangeText={setCantidad} /></View>
                <View style={{ flex: 1 }}><Field label="Unidad" placeholder="unidades" value={unidad} onChangeText={setUnidad} /></View>
              </View>
              <Field label="Categoría" placeholder="Despensa" value={categoria} onChangeText={setCategoria} />
              <Field label="Caducidad (YYYY-MM-DD)" placeholder="2026-06-15" value={fechaCaducidad} onChangeText={setFechaCaducidad} containerStyle={{ marginBottom: spacing.xl }} />
              <Button label="Añadir producto" icon="add" onPress={handleAdd} style={{ marginBottom: spacing.sm }} />
              <Button label="Cancelar" variant="ghost" onPress={() => setModalVisible(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
