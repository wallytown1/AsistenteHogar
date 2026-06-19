import { useState, useEffect, useCallback } from 'react';
import { AlimentoItem, PantryStockMetrics } from '../types/types';
import { apiRequest, TIMEOUT } from '../api/api';
import { programarAlertasCaducidad } from '../lib/notifications';

/**
 * Retorna los días restantes para la caducidad de un alimento.
 */
export function getDiasParaCaducar(fechaCaducidad: string | null): number | null {
  if (!fechaCaducidad) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  // fecha_caducidad llega como "YYYY-MM-DD" (date-only). `new Date(str)` lo interpretaría
  // como medianoche UTC, lo que en husos horarios negativos lo desplaza al día anterior
  // (off-by-one). Construimos la fecha con los componentes Y-M-D en hora LOCAL para evitarlo.
  const [y, m, d] = fechaCaducidad.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const fecha = new Date(y, m - 1, d);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
}

/**
 * Hook para la gestión asíncrona de la despensa de alimentos.
 */
export function usePantry() {
  const [items, setItems] = useState<AlimentoItem[]>([]);
  const [porcentajeStock, setPorcentajeStock] = useState<number>(100);
  const [itemsDisponibles, setItemsDisponibles] = useState<number>(0);
  const [alertasCaducidad, setAlertasCaducidad] = useState<AlimentoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPantry = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<PantryStockMetrics>('/pantry', { signal });
      setItems(data.items || []);
      setPorcentajeStock(data.porcentaje_stock);
      setItemsDisponibles(data.items_disponibles);
      setAlertasCaducidad(data.alertas_caducidad || []);
      programarAlertasCaducidad(data.alertas_caducidad || []).catch(() => {});
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(
        err.name === 'TimeoutError'
          ? 'El servidor tardó demasiado. Comprueba tu conexión.'
          : err.message || 'Error al obtener los datos de la despensa'
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  const addItem = async (
    item: Omit<AlimentoItem, 'id' | 'is_deleted' | 'hogar_id' | 'created_at' | 'updated_at'>
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest<AlimentoItem>('/pantry', {
        method: 'POST',
        json: item,
      });
      await fetchPantry();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el producto');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (id: string, cantidad: number) => {
    // Sanitización local preventiva: validación local de cantidad > 0
    if (cantidad <= 0) {
      const errorMsg = 'La cantidad del producto debe ser estrictamente mayor que 0.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest<AlimentoItem>(`/pantry/${id}`, {
        method: 'PATCH',
        json: { cantidad },
      });
      await fetchPantry();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la cantidad');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest<AlimentoItem>(`/pantry/${id}`, {
        method: 'DELETE',
      });
      await fetchPantry();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el producto');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPantry(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchPantry]);

  const escanearTicketOcr = async (imagenBase64: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      // Asumimos que el backend devuelve un objeto con { alimentos: AlimentoItem[] }
      const data = await apiRequest<{ alimentos: any[] }>('/pantry/ocr-ticket', {
        method: 'POST',
        json: { imagen_base64: imagenBase64, fecha_referencia: hoy },
        timeoutMs: TIMEOUT.OCR,
      });
      return data.alimentos || [];
    } catch (err: any) {
      setError(err.message || 'Error al procesar la imagen del ticket');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
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
    refetch: () => fetchPantry(),
  };
}
