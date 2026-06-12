import { useState, useEffect, useCallback } from 'react';
import { AlimentoItem, PantryStockMetrics } from '../types/types';
import { apiRequest } from '../api/api';

/**
 * Retorna los días restantes para la caducidad de un alimento.
 */
export function getDiasParaCaducar(fechaCaducidad: string | null): number | null {
  if (!fechaCaducidad) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaCaducidad);
  fecha.setHours(0, 0, 0, 0);
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
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(
        err.name === 'TimeoutError'
          ? 'El servidor tardó demasiado. Comprueba tu conexión.'
          : (err.message || 'Error al obtener los datos de la despensa')
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  const addItem = async (item: Omit<AlimentoItem, 'id' | 'is_deleted' | 'hogar_id' | 'created_at' | 'updated_at'>) => {
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
    refetch: () => fetchPantry(),
  };
}
