import { useState, useEffect, useCallback } from 'react';
import { ListaCompraItem } from '../types/types';
import { apiRequest } from '../api/api';

export function useListaCompra() {
  const [items, setItems] = useState<ListaCompraItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ListaCompraItem[]>('/lista-compra', { signal });
      setItems(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Error al cargar la lista');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(ctrl.signal);
    return () => ctrl.abort();
  }, [fetch]);

  const addItem = async (nombre: string, cantidad?: number, unidad?: string) => {
    const item = await apiRequest<ListaCompraItem>('/lista-compra', {
      method: 'POST',
      json: { nombre, cantidad: cantidad ?? null, unidad: unidad ?? null },
    });
    setItems((prev) => [...prev, item]);
  };

  const toggleItem = async (id: string, is_checked: boolean) => {
    const updated = await apiRequest<ListaCompraItem>(`/lista-compra/${id}`, {
      method: 'PATCH',
      json: { is_checked },
    });
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  };

  const deleteItem = async (id: string) => {
    await apiRequest(`/lista-compra/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearChecked = async () => {
    await apiRequest('/lista-compra', { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => !i.is_checked));
  };

  const pendientes = items.filter((i) => !i.is_checked);
  const comprados = items.filter((i) => i.is_checked);

  return {
    items,
    pendientes,
    comprados,
    isLoading,
    error,
    addItem,
    toggleItem,
    deleteItem,
    clearChecked,
    refetch: () => fetch(),
  };
}
