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
import { usePantry, getDiasParaCaducar } from '../hooks/usePantry';
import { AlimentoItem, RecetaSugerida, RecetasSugeridasResponse } from '../types/types';
import { apiRequest } from '../api/api';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';

const UMBRAL_BAJO_STOCK = 1;

function getItemStatus(item: AlimentoItem): { text: string; color: string; bar: string } {
  const dias = getDiasParaCaducar(item.fecha_caducidad);
  if (dias !== null && dias <= 0) return { text: 'Caducado', color: 'text-red-600', bar: 'bg-red-600' };
  if (dias !== null && dias <= 2) return { text: 'Caduca pronto', color: 'text-amber-500', bar: 'bg-amber-500' };
  if (item.cantidad <= UMBRAL_BAJO_STOCK) return { text: 'Bajo stock', color: 'text-red-500', bar: 'bg-red-500' };
  return { text: 'Stock correcto', color: 'text-green-500', bar: 'bg-green-500' };
}

function getCategoriaEmoji(categoria: string): string {
  const c = categoria.toLowerCase();
  if (c.includes('lácteo') || c.includes('lacteo')) return '🥛';
  if (c.includes('carne')) return '🥩';
  if (c.includes('fruta')) return '🍎';
  if (c.includes('verdura') || c.includes('vegetal')) return '🥦';
  if (c.includes('bebida')) return '🧃';
  return '🥫';
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
    refetch
  } = usePantry();
  const [modalVisible, setModalVisible] = useState(false);
  
  // Inputs de Filtros
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [soloBajoStock, setSoloBajoStock] = useState(false);

  // Formulario nuevo producto
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('unidades');
  const [categoria, setCategoria] = useState('Despensa');
  const [fechaCaducidad, setFechaCaducidad] = useState('');

  // Checkbox de selección por lote
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Recetas sugeridas por IA
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

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#fafafa] justify-center items-center">
        <ActivityIndicator size="large" color="#000000" />
        <Text className="text-gray-500 mt-4 text-sm font-medium">Cargando inventario de la despensa...</Text>
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
          accessibilityLabel="Reintentar carga de despensa"
        >
          <Text className="text-white font-bold">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleSelectProduct = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre del producto es obligatorio.');
      return;
    }
    
    const qty = parseFloat(cantidad);
    // Validación estricta equivalente a Pydantic: cantidad no negativa ni cero
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Valor no válido', 'La cantidad del producto debe ser un número estrictamente mayor que 0.');
      return;
    }

    // IA Pasiva - Confirmar adición manual del usuario
    Alert.alert(
      "Confirmar adición",
      `¿Deseas agregar ${qty} ${unidad} de "${nombre}" al inventario?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Aceptar", onPress: () => {
          addItem({
            nombre: nombre.trim(),
            cantidad: qty,
            unidad: unidad.trim(),
            categoria: categoria.trim(),
            fecha_caducidad: fechaCaducidad || null,
          });
          setModalVisible(false);
          setNombre(''); setCantidad(''); setFechaCaducidad('');
          Alert.alert("Éxito", "El producto ha sido registrado.");
        }}
      ]
    );
  };

  const handleBatchAction = (action: string) => {
    if (selectedItems.length === 0) {
      Alert.alert("Selección vacía", "Por favor, selecciona al menos un artículo.");
      return;
    }

    Alert.alert(
      "Confirmar acción por lote",
      `¿Deseas aplicar la acción "${action}" sobre los ${selectedItems.length} artículos seleccionados?`,
      [
        { text: "No", style: "cancel" },
        { text: "Sí", onPress: () => {
          if (action === 'usar') {
            const promises = selectedItems.map(id => apiRequest(`/pantry/${id}`, { method: 'DELETE' }));
            Promise.all(promises)
              .then(() => {
                refetch();
                Alert.alert("Inventario actualizado", "Los artículos seleccionados han sido marcados como usados.");
              })
              .catch(err => {
                Alert.alert("Error", err.message || "Error al eliminar artículos.");
              })
              .finally(() => {
                setSelectedItems([]);
              });
          } else {
            const promises = selectedItems.map(id => {
              const item = items.find(i => i.id === id);
              const currentQty = item ? item.cantidad : 0;
              return apiRequest(`/pantry/${id}`, {
                method: 'PATCH',
                json: { cantidad: currentQty + 1 }
              });
            });
            Promise.all(promises)
              .then(() => {
                refetch();
                Alert.alert("Inventario actualizado", "Se ha incrementado el stock de los artículos seleccionados.");
              })
              .catch(err => {
                Alert.alert("Error", err.message || "Error al incrementar el stock.");
              })
              .finally(() => {
                setSelectedItems([]);
              });
          }
        }}
      ]
    );
  };

  // Productos con bajo stock real (para recomendaciones de compra)
  const itemsBajoStock = items.filter(i => i.cantidad <= UMBRAL_BAJO_STOCK);

  return (
    <View className="flex-1 bg-[#fafafa]">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 }}>
        
        {/* Cabecera del Gestor de Despensa */}
        <View className="flex-row justify-between items-center mb-5">
          <Text className="text-black text-xl font-bold">Despensa</Text>
        </View>

        {/* Bloque de Métricas */}
        <View className="flex-row gap-3 mb-5">
          {/* Stock Total */}
          <View className="flex-1 bg-white border border-gray-100 rounded-3xl p-4 shadow-sm items-center">
            <View className="flex-row justify-between items-center w-full mb-2">
              <Text className="text-gray-400 text-[10px] font-bold uppercase">Stock total</Text>
              <Text className="text-base">📦</Text>
            </View>
            <View className="w-16 h-16 rounded-full bg-black justify-center items-center mb-2">
              <Text className="text-white text-lg font-bold">{porcentajeStock}%</Text>
            </View>
            <Text className="text-black text-xs font-bold">Items disponibles: {itemsDisponibles}</Text>
            {/* Barra de progreso horizontal */}
            <View className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <View className="h-full bg-black" style={{ width: `${porcentajeStock}%` }} />
            </View>
          </View>

          {/* A caducar pronto */}
          <View className="flex-1 bg-white border border-gray-100 rounded-3xl p-4 shadow-sm items-center justify-between">
            <View className="flex-row justify-between items-center w-full mb-2">
              <Text className="text-gray-400 text-[10px] font-bold uppercase">A caducar pronto</Text>
              <Text className="text-base">⚠️</Text>
            </View>
            <View className="w-16 h-16 rounded-full bg-black justify-center items-center mb-2">
              <Text className="text-white text-lg font-bold">{alertasCaducidad.length}</Text>
            </View>
            <Text className="text-black text-[10px] text-center font-bold">Notificaciones activas para {alertasCaducidad.length} artículos</Text>
          </View>
        </View>

        {/* Recomendaciones de Compra (calculadas del stock real) */}
        {itemsBajoStock.length > 0 && (
          <View className="bg-white border border-gray-100 rounded-3xl p-4 mb-5 shadow-sm">
            <Text className="text-gray-400 text-[10px] font-bold uppercase mb-0.5">Recomendaciones de compra</Text>
            <Text className="text-black text-xs font-bold">
              {itemsBajoStock.map(i => i.nombre).join(', ')}
            </Text>
            <Text className="text-gray-400 text-[9px] mt-1">Artículos con stock bajo en tu inventario</Text>
          </View>
        )}

        {/* Sección de Filtros */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-5 shadow-sm">
          <Text className="text-black text-xs font-bold mb-3">Filtros</Text>

          <TextInput
            placeholder="Categoría (ej. Lácteos)"
            placeholderTextColor="#94a3b8"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-black text-xs mb-3 font-medium"
            value={filtroCategoria}
            onChangeText={setFiltroCategoria}
          />

          <View className="flex-row justify-between items-center">
            <Text className="text-gray-600 text-xs font-semibold">Solo mostrar bajo stock</Text>
            <TouchableOpacity
              onPress={() => setSoloBajoStock(!soloBajoStock)}
              className="w-5 h-5 rounded border border-gray-300 items-center justify-center bg-gray-50"
            >
              {soloBajoStock && <View className="w-3 h-3 bg-black rounded" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Acciones por Lote */}
        <View className="mb-5">
          <Text className="text-gray-400 text-[10px] font-bold uppercase mb-2">Acciones por lote</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity 
              onPress={() => handleBatchAction('usar')}
              className="flex-1 bg-black rounded-full py-3 items-center"
            >
              <Text className="text-white text-xs font-bold">Marcar como usado</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleBatchAction('agregar')}
              className="flex-1 bg-black rounded-full py-3 items-center"
            >
              <Text className="text-white text-xs font-bold">Agregar más</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Listado de Tarjetas de Inventario */}
        <View className="mb-6">
          {items
            .filter(item => {
              if (filtroCategoria && !item.categoria.toLowerCase().includes(filtroCategoria.toLowerCase())) return false;
              if (soloBajoStock) return item.cantidad <= UMBRAL_BAJO_STOCK;
              return true;
            })
            .map(item => {
              const status = getItemStatus(item);
              const isSelected = selectedItems.includes(item.id);

              return (
                <View key={item.id} className="bg-white border border-gray-100 rounded-3xl p-4 mb-3 shadow-sm flex-row items-center">
                  
                  {/* Checkbox selección lote */}
                  <TouchableOpacity 
                    onPress={() => toggleSelectProduct(item.id)}
                    className="w-5 h-5 rounded border border-gray-300 mr-3 items-center justify-center bg-gray-50"
                  >
                    {isSelected && <View className="w-3 h-3 bg-black rounded" />}
                  </TouchableOpacity>

                  {/* Icono por categoría */}
                  <View className="w-14 h-14 rounded-2xl mr-3 bg-gray-100 items-center justify-center">
                    <Text className="text-2xl">{getCategoriaEmoji(item.categoria)}</Text>
                  </View>

                  {/* Detalles */}
                  <View className="flex-1 mr-2">
                    <Text className="text-black text-xs font-bold" numberOfLines={1}>{item.nombre}</Text>
                    <Text className="text-gray-500 text-[10px] mt-0.5">
                      Cantidad: {item.cantidad} {item.unidad} · {item.categoria}
                    </Text>
                    <Text className="text-gray-400 text-[9px] mt-1">
                      Caduca: {item.fecha_caducidad || 'Indefinido'}
                    </Text>

                    {/* Barra de nivel de stock (proporcional a la cantidad) */}
                    <View className="w-full h-1 bg-gray-100 rounded-full mt-2 overflow-hidden relative">
                      <View
                        className={`h-full ${status.bar}`}
                        style={{ width: `${Math.min(100, Math.round((item.cantidad / 5) * 100))}%` }}
                      />
                    </View>

                    <Text className={`${status.color} text-[9px] font-bold mt-1`}>
                      {status.text}
                    </Text>
                  </View>

                  {/* Botones de incremento/decremento de stock */}
                  <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-full px-1.5 py-0.5 gap-1.5 mr-2">
                    <TouchableOpacity
                      onPress={() => {
                        const nuevaCant = item.cantidad - 1;
                        if (nuevaCant <= 0) {
                          Alert.alert("Cantidad inválida", "La cantidad debe ser mayor que 0.0. Usa el botón de eliminar si deseas borrar el producto.");
                          return;
                        }
                        Alert.alert(
                          "Confirmar decremento",
                          `¿Deseas disminuir la cantidad de "${item.nombre}" a ${nuevaCant} ${item.unidad}?`,
                          [
                            { text: "Cancelar", style: "cancel" },
                            { text: "Confirmar", onPress: () => updateQuantity(item.id, nuevaCant) }
                          ]
                        );
                      }}
                      className="w-5 h-5 rounded-full bg-white border border-gray-200 items-center justify-center"
                    >
                      <Text className="text-black text-xs font-bold">-</Text>
                    </TouchableOpacity>
                    
                    <Text className="text-black text-xs font-bold px-0.5">{item.cantidad}</Text>

                    <TouchableOpacity
                      onPress={() => {
                        const nuevaCant = item.cantidad + 1;
                        Alert.alert(
                          "Confirmar incremento",
                          `¿Deseas aumentar la cantidad de "${item.nombre}" a ${nuevaCant} ${item.unidad}?`,
                          [
                            { text: "Cancelar", style: "cancel" },
                            { text: "Confirmar", onPress: () => updateQuantity(item.id, nuevaCant) }
                          ]
                        );
                      }}
                      className="w-5 h-5 rounded-full bg-black items-center justify-center"
                    >
                      <Text className="text-white text-xs font-bold">+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Botón de eliminación manual */}
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        "Confirmar eliminación",
                        `¿Deseas eliminar "${item.nombre}" del inventario?`,
                        [
                          { text: "No", style: "cancel" },
                          { text: "Sí", onPress: () => deleteItem(item.id) }
                        ]
                      );
                    }}
                    className="bg-gray-100 rounded-full w-7 h-7 items-center justify-center border border-gray-200"
                  >
                    <Text className="text-xs">🗑️</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
        </View>

        {/* Sección: Recetas sugeridas por IA */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-black text-sm font-bold">Recetas sugeridas ✨</Text>
            <TouchableOpacity
              onPress={fetchRecetas}
              disabled={recetasLoading}
              className="bg-black rounded-full px-4 py-1.5"
              accessibilityLabel="Generar sugerencias de recetas con IA"
            >
              <Text className="text-white text-xs font-bold">
                {recetasLoading ? 'Pensando...' : recetas.length > 0 ? 'Actualizar' : 'Sugerir con IA'}
              </Text>
            </TouchableOpacity>
          </View>

          {recetasLoading && (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color="#000000" />
              <Text className="text-gray-400 text-[10px] mt-2 font-medium">El chef IA está revisando tu despensa...</Text>
            </View>
          )}

          {!recetasLoading && recetasMensaje && (
            <Text className="text-gray-500 text-xs text-center py-3 font-medium">{recetasMensaje}</Text>
          )}

          {!recetasLoading && recetas.length === 0 && !recetasMensaje && (
            <Text className="text-gray-400 text-xs text-center py-3 font-medium">
              Pulsa "Sugerir con IA" para recibir recetas que aprovechen tu despensa, priorizando lo que caduca pronto.
            </Text>
          )}

          {/* Transparencia IA (EU AI Act): solo cuando las recetas provienen del modelo */}
          {!recetasLoading && recetas.length > 0 && recetasGeneradasPorIA && (
            <AIDisclaimerBanner texto="Estas recetas han sido generadas por IA y pueden contener imprecisiones." />
          )}

          {!recetasLoading && recetas.map((receta, idx) => (
            <View key={`${receta.titulo}-${idx}`} className="flex-row items-center justify-between mb-3">
              <View className="flex-1 pr-3">
                <Text className="text-black text-xs font-bold">{receta.titulo}</Text>
                <Text className="text-gray-400 text-[10px] mt-0.5">
                  Tiempo: {receta.tiempo_min} min • Usa {receta.ingredientes_usados.slice(0, 3).join(', ')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert(
                  receta.titulo,
                  `Ingredientes: ${receta.ingredientes_usados.join(', ')}\n\nPasos:\n${receta.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
                )}
                className="bg-black rounded-full px-4 py-1.5"
              >
                <Text className="text-white text-xs font-bold">Ver</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* FAB Añadir Producto */}
      <TouchableOpacity
        className="absolute bottom-6 right-5 bg-black rounded-full w-14 h-14 justify-center items-center shadow-2xl"
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Añadir producto a la despensa"
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </TouchableOpacity>

      {/* Modal Añadir Producto */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-black text-lg font-bold mb-4">Añadir producto</Text>
            <ScrollView>
              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Nombre *</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black mb-3 text-xs"
                placeholder="Ej: Leche entera"
                placeholderTextColor="#94a3b8"
                value={nombre}
                onChangeText={setNombre}
              />
              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Cantidad *</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black text-xs"
                    placeholder="1"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={cantidad}
                    onChangeText={setCantidad}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Unidad</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black text-xs"
                    placeholder="unidades"
                    placeholderTextColor="#94a3b8"
                    value={unidad}
                    onChangeText={setUnidad}
                  />
                </View>
              </View>
              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Categoría</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black mb-3 text-xs"
                placeholder="Despensa"
                placeholderTextColor="#94a3b8"
                value={categoria}
                onChangeText={setCategoria}
              />
              <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Fecha de caducidad (YYYY-MM-DD)</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black mb-5 text-xs"
                placeholder="2026-06-15"
                placeholderTextColor="#94a3b8"
                value={fechaCaducidad}
                onChangeText={setFechaCaducidad}
              />
              <TouchableOpacity
                className="bg-black rounded-full py-4 items-center mb-3"
                onPress={handleAdd}
                accessibilityLabel="Confirmar añadir producto"
              >
                <Text className="text-white font-bold text-sm">Añadir producto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="items-center py-2"
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Cancelar añadir producto"
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
