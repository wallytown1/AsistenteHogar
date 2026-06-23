import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlimentoItem, PantryStockMetrics } from '../types/types';
import { apiRequest, TIMEOUT } from '../api/api';
import { useToast } from '../components/ui/Toast';

/**
 * Payload para crear un alimento. Los campos de ticket (precio_unitario,
 * fecha_compra) son opcionales: solo se rellenan al confirmar productos
 * importados de un PDF de ticket, y alimentan el Informe de Ahorro.
 */
export type NuevoAlimento = Omit<
  AlimentoItem,
  'id' | 'is_deleted' | 'hogar_id' | 'created_at' | 'updated_at'
> & {
  precio_unitario?: number | null;
  fecha_compra?: string | null;
};

/**
 * Retorna los días restantes para la caducidad de un alimento.
 * Construye la fecha en hora LOCAL para evitar off-by-one UTC en fechas "YYYY-MM-DD".
 */
export function getDiasParaCaducar(fechaCaducidad: string | null): number | null {
  if (!fechaCaducidad) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = fechaCaducidad.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const fecha = new Date(y, m - 1, d);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
}

export function usePantry() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [ocrLoading, setOcrLoading] = useState(false);

  const query = useQuery({
    queryKey: ['pantry'],
    queryFn: ({ signal }) => apiRequest<PantryStockMetrics>('/pantry', { signal }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pantry'] });

  const patchItems = (updater: (old: PantryStockMetrics) => PantryStockMetrics) =>
    queryClient.setQueryData<PantryStockMetrics>(['pantry'], (old) => (old ? updater(old) : old));

  const addMutation = useMutation({
    mutationFn: (item: NuevoAlimento) =>
      apiRequest<AlimentoItem>('/pantry', { method: 'POST', json: item }),
    onError: () => toast.show({ tipo: 'error', mensaje: 'No se pudo añadir el producto' }),
    onSettled: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, cantidad }: { id: string; cantidad: number }) =>
      apiRequest<AlimentoItem>(`/pantry/${id}`, { method: 'PATCH', json: { cantidad } }),
    onMutate: async ({ id, cantidad }) => {
      await queryClient.cancelQueries({ queryKey: ['pantry'] });
      const prev = queryClient.getQueryData<PantryStockMetrics>(['pantry']);
      patchItems((old) => ({
        ...old,
        items: old.items.map((i) => (i.id === id ? { ...i, cantidad } : i)),
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['pantry'], ctx.prev);
      toast.show({ tipo: 'error', mensaje: 'No se pudo actualizar la cantidad' });
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/pantry/${id}`, { method: 'DELETE' }),
    onError: () => toast.show({ tipo: 'error', mensaje: 'No se pudo eliminar el producto' }),
    onSettled: invalidate,
  });

  const agotarMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<AlimentoItem>(`/pantry/${id}/agotar`, { method: 'POST' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['pantry'] });
      const prev = queryClient.getQueryData<PantryStockMetrics>(['pantry']);
      patchItems((old) => ({ ...old, items: old.items.filter((i) => i.id !== id) }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['pantry'], ctx.prev);
      toast.show({ tipo: 'error', mensaje: 'No se pudo registrar el consumo' });
    },
    onSettled: invalidate,
  });

  const confirmarMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<AlimentoItem>(`/pantry/${id}/confirmar`, { method: 'POST' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['pantry'] });
      const prev = queryClient.getQueryData<PantryStockMetrics>(['pantry']);
      patchItems((old) => ({
        ...old,
        items: old.items.map((i) => (i.id === id ? { ...i, incierto: false } : i)),
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['pantry'], ctx.prev);
      toast.show({ tipo: 'error', mensaje: 'No se pudo confirmar el artículo' });
    },
    onSettled: invalidate,
  });

  const addItem = async (item: NuevoAlimento) => {
    await addMutation.mutateAsync(item);
  };

  const updateQuantity = async (id: string, cantidad: number) => {
    if (cantidad <= 0)
      throw new Error('La cantidad del producto debe ser estrictamente mayor que 0.');
    await updateMutation.mutateAsync({ id, cantidad });
  };

  const deleteItem = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const agotarItem = async (id: string) => {
    await agotarMutation.mutateAsync(id);
  };

  const confirmarItem = async (id: string) => {
    await confirmarMutation.mutateAsync(id);
  };

  const escanearTicketOcr = async (imagenBase64: string): Promise<any[]> => {
    setOcrLoading(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const data = await apiRequest<{ alimentos: any[] }>('/pantry/ocr-ticket', {
        method: 'POST',
        json: { imagen_base64: imagenBase64, fecha_referencia: hoy },
        timeoutMs: TIMEOUT.OCR,
      });
      return data.alimentos || [];
    } catch (err: any) {
      toast.show({ tipo: 'error', mensaje: err.message || 'Error al procesar el ticket' });
      throw err;
    } finally {
      setOcrLoading(false);
    }
  };

  const d = query.data;

  return {
    items: d?.items ?? [],
    porcentajeStock: d?.porcentaje_stock ?? 100,
    itemsDisponibles: d?.items_disponibles ?? 0,
    alertasCaducidad: d?.alertas_caducidad ?? [],
    isLoading: query.isLoading || ocrLoading,
    error: query.isError ? mensajeError(query.error) : null,
    addItem,
    updateQuantity,
    deleteItem,
    agotarItem,
    confirmarItem,
    escanearTicketOcr,
    refetch: () => query.refetch(),
  };
}

function mensajeError(error: unknown): string {
  const e = error as { name?: string; message?: string };
  if (e?.name === 'TimeoutError') return 'El servidor tardó demasiado. Comprueba tu conexión.';
  return e?.message || 'Error al obtener los datos de la despensa';
}
