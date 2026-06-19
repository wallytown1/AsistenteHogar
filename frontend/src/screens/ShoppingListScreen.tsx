import React, { useState } from 'react';
import { View, ScrollView, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useListaCompra } from '../hooks/useListaCompra';
import { ListaCompraItem } from '../types/types';
import { colors, spacing, radius, typography } from '../theme/tokens';
import {
  Screen,
  AppText,
  SectionHeader,
  Card,
  Button,
  LoadingView,
  ErrorView,
} from '../components/ui';
import { haptics } from '../lib/haptics';

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ListaCompraItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const cantidad =
    item.cantidad != null ? `${item.cantidad}${item.unidad ? ' ' + item.unidad : ''}` : null;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.check}
        accessibilityLabel={
          item.is_checked ? `Desmarcar ${item.nombre}` : `Marcar ${item.nombre} como comprado`
        }
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_checked }}
      >
        <Ionicons
          name={item.is_checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={item.is_checked ? colors.success : colors.inkFaint}
        />
      </TouchableOpacity>
      <View style={styles.rowContent}>
        <AppText
          variant="body"
          style={item.is_checked ? styles.strikethrough : undefined}
          color={item.is_checked ? colors.inkFaint : colors.ink}
        >
          {item.nombre}
        </AppText>
        {cantidad && (
          <AppText variant="caption" color={colors.inkFaint}>
            {cantidad}
          </AppText>
        )}
      </View>
      <TouchableOpacity
        onPress={onDelete}
        hitSlop={13}
        accessibilityLabel={`Eliminar ${item.nombre}`}
      >
        <Ionicons name="trash-outline" size={18} color={colors.inkFaint} />
      </TouchableOpacity>
    </View>
  );
}

export default function ShoppingListScreen() {
  const { pendientes, comprados, isLoading, error, addItem, toggleItem, deleteItem, clearChecked } =
    useListaCompra();
  const [texto, setTexto] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const nombre = texto.trim();
    if (!nombre) return;
    setAdding(true);
    try {
      await addItem(nombre);
      setTexto('');
      haptics.success();
    } catch {
      Alert.alert('Error', 'No se pudo añadir el producto.');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (item: ListaCompraItem) => {
    haptics.light();
    try {
      await toggleItem(item.id, !item.is_checked);
    } catch {
      /* silent */
    }
  };

  const handleDelete = (item: ListaCompraItem) => {
    Alert.alert('Eliminar', `¿Quitar "${item.nombre}" de la lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          haptics.light();
          try {
            await deleteItem(item.id);
          } catch {
            /* silent */
          }
        },
      },
    ]);
  };

  const handleClearChecked = () => {
    Alert.alert('Limpiar comprados', '¿Eliminar todos los productos marcados?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpiar',
        style: 'destructive',
        onPress: async () => {
          haptics.light();
          try {
            await clearChecked();
          } catch {
            /* silent */
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;

  const empty = pendientes.length === 0 && comprados.length === 0;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <AppText variant="title">Lista de la compra</AppText>
        {comprados.length > 0 && (
          <TouchableOpacity onPress={handleClearChecked} style={styles.clearBtn}>
            <AppText variant="captionStrong" color={colors.danger}>
              Limpiar marcados
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, empty && styles.scrollEmpty]}
        showsVerticalScrollIndicator={false}
      >
        {empty ? (
          <View style={styles.empty}>
            <Ionicons name="cart-outline" size={48} color={colors.inkFaint} />
            <AppText variant="body" color={colors.inkFaint} style={styles.emptyText}>
              Lista vacía — añade lo que necesites
            </AppText>
          </View>
        ) : (
          <>
            {pendientes.length > 0 && (
              <>
                <SectionHeader
                  title={`Por comprar (${pendientes.length})`}
                  style={styles.section}
                />
                <Card>
                  {pendientes.map((item, idx) => (
                    <View key={item.id} style={idx > 0 ? styles.divider : undefined}>
                      <ItemRow
                        item={item}
                        onToggle={() => handleToggle(item)}
                        onDelete={() => handleDelete(item)}
                      />
                    </View>
                  ))}
                </Card>
              </>
            )}

            {comprados.length > 0 && (
              <>
                <SectionHeader title={`Comprados (${comprados.length})`} style={styles.section} />
                <Card>
                  {comprados.map((item, idx) => (
                    <View key={item.id} style={idx > 0 ? styles.divider : undefined}>
                      <ItemRow
                        item={item}
                        onToggle={() => handleToggle(item)}
                        onDelete={() => handleDelete(item)}
                      />
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Añadir producto..."
          placeholderTextColor={colors.inkFaint}
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          editable={!adding}
        />
        <TouchableOpacity
          onPress={handleAdd}
          disabled={adding || !texto.trim()}
          style={[styles.addBtn, (!texto.trim() || adding) && styles.addBtnDisabled]}
        >
          <Ionicons name="add" size={24} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  clearBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  scrollEmpty: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
    gap: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  check: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
});
