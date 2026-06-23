import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { apiRequest, TIMEOUT } from '../api/api';
import { ProductoTicketPdf, TicketPdfResponse } from '../types/types';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText, Button, IconButton, Icon } from '../components/ui';
import { haptics } from '../lib/haptics';
import { usePantry } from '../hooks/usePantry';

type NavProp = NativeStackNavigationProp<any>;

type ProductoSeleccionable = ProductoTicketPdf & { seleccionado: boolean };

export default function TicketImportScreen() {
  const navigation = useNavigation<NavProp>();
  const { addItem } = usePantry();

  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [productos, setProductos] = useState<ProductoSeleccionable[]>([]);
  const [supermercado, setSupermercado] = useState<string | null>(null);
  const [fechaCompra, setFechaCompra] = useState<string | null>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);

  const handleSeleccionarPdf = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (resultado.canceled) return;

      const asset = resultado.assets[0];
      setArchivoNombre(asset.name);
      setProcesando(true);
      setProductos([]);
      setSupermercado(null);
      setFechaCompra(null);

      const pdfBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      });

      const hoy = new Date().toISOString().split('T')[0];
      const respuesta = await apiRequest<TicketPdfResponse>('/pantry/ticket/pdf', {
        method: 'POST',
        json: { pdf_base64: pdfBase64, fecha_referencia: hoy },
        timeoutMs: TIMEOUT.OCR_FULL,
      });

      if (!respuesta.productos.length) {
        Alert.alert(
          'Sin productos',
          respuesta.mensaje ?? 'No se detectaron productos en el ticket.'
        );
        return;
      }

      setProductos(respuesta.productos.map((p) => ({ ...p, seleccionado: true })));
      setSupermercado(respuesta.supermercado);
      setFechaCompra(respuesta.fecha_compra);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo procesar el ticket.');
    } finally {
      setProcesando(false);
    }
  };

  const toggleProducto = (idx: number) => {
    haptics.selection();
    setProductos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, seleccionado: !p.seleccionado } : p))
    );
  };

  const seleccionados = productos.filter((p) => p.seleccionado);

  const handleConfirmar = async () => {
    if (!seleccionados.length) {
      Alert.alert('Sin selección', 'Selecciona al menos un producto para añadir.');
      return;
    }
    setGuardando(true);
    try {
      for (const p of seleccionados) {
        await addItem({
          nombre: p.nombre,
          cantidad: p.cantidad,
          unidad: p.unidad,
          categoria: p.categoria,
          fecha_caducidad: p.fecha_caducidad,
        });
      }
      haptics.success();
      Alert.alert(
        '¡Despensa actualizada!',
        `${seleccionados.length} producto${seleccionados.length === 1 ? '' : 's'} añadido${seleccionados.length === 1 ? '' : 's'}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudieron añadir los productos.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <AppText variant="h2" style={styles.headerTitle}>
          Importar ticket PDF
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      {/* Estado vacío / acción de selección */}
      {!procesando && productos.length === 0 && (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Icon name="document-text-outline" size={40} color={colors.brand} />
          </View>
          <AppText variant="h2" style={styles.emptyTitle}>
            Ticket de Mercadona
          </AppText>
          <AppText variant="body" color="inkFaint" style={styles.emptySubtitle}>
            Selecciona el PDF de tu ticket. Marce leerá los productos y precios automáticamente.
          </AppText>
          <Button
            label="Seleccionar PDF"
            icon="folder-open-outline"
            onPress={handleSeleccionarPdf}
            style={styles.selectButton}
          />
        </View>
      )}

      {/* Spinner de análisis */}
      {procesando && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
          <AppText variant="body" color="inkFaint" style={{ marginTop: spacing.lg }}>
            Analizando ticket…
          </AppText>
          <AppText variant="caption" color="inkFaint" style={{ marginTop: spacing.xs }}>
            Puede tardar hasta 45 segundos.
          </AppText>
        </View>
      )}

      {/* Lista de productos */}
      {!procesando && productos.length > 0 && (
        <>
          {/* Cabecera del resultado */}
          <View style={styles.resultHeader}>
            {supermercado && (
              <View style={styles.badge}>
                <Icon name="storefront-outline" size={13} color={colors.brand} />
                <AppText variant="captionStrong" style={{ color: colors.brand, marginLeft: 4 }}>
                  {supermercado}
                </AppText>
              </View>
            )}
            {fechaCompra && (
              <View style={[styles.badge, { marginLeft: spacing.sm }]}>
                <Icon name="calendar-outline" size={13} color={colors.inkMuted} />
                <AppText variant="caption" color="inkMuted" style={{ marginLeft: 4 }}>
                  {fechaCompra}
                </AppText>
              </View>
            )}
            <AppText variant="caption" color="inkFaint" style={{ marginLeft: 'auto' }}>
              {seleccionados.length}/{productos.length}
            </AppText>
          </View>

          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {productos.map((producto, idx) => (
              <Pressable
                key={idx}
                onPress={() => toggleProducto(idx)}
                style={[styles.productoRow, producto.seleccionado && styles.productoRowActive]}
              >
                <View
                  style={[
                    styles.checkbox,
                    producto.seleccionado && {
                      backgroundColor: colors.brand,
                      borderColor: colors.brand,
                    },
                  ]}
                >
                  {producto.seleccionado && (
                    <Icon name="checkmark" size={13} color={colors.white} />
                  )}
                </View>
                <View style={styles.productoInfo}>
                  <AppText
                    variant="captionStrong"
                    color={producto.seleccionado ? colors.ink : colors.inkFaint}
                    numberOfLines={1}
                  >
                    {producto.nombre}
                  </AppText>
                  <AppText variant="micro" color="inkMuted">
                    {producto.cantidad} {producto.unidad} · {producto.categoria}
                    {producto.fecha_caducidad ? ` · Cad: ${producto.fecha_caducidad}` : ''}
                  </AppText>
                </View>
                {producto.precio_unitario != null && (
                  <View style={styles.priceBadge}>
                    <AppText variant="captionStrong" style={{ color: colors.success }}>
                      {producto.precio_unitario.toFixed(2)} €
                    </AppText>
                  </View>
                )}
              </Pressable>
            ))}

            {/* Botón para cambiar PDF */}
            <Button
              label="Cambiar PDF"
              variant="ghost"
              size="sm"
              icon="folder-open-outline"
              onPress={handleSeleccionarPdf}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={
                guardando
                  ? 'Añadiendo…'
                  : `Añadir ${seleccionados.length} producto${seleccionados.length === 1 ? '' : 's'}`
              }
              icon="checkmark-done"
              loading={guardando}
              disabled={seleccionados.length === 0}
              onPress={handleConfirmar}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: { textAlign: 'center', marginBottom: spacing.sm },
  emptySubtitle: { textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  selectButton: { width: '100%' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  productoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productoRowActive: {
    backgroundColor: 'transparent',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  productoInfo: { flex: 1, gap: 2 },
  priceBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
