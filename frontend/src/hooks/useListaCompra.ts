import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListaCompraItem, SugerenciaCompra } from '../types/types';
import { apiRequest } from '../api/api';
import { useToast } from '../components/ui/Toast';

export function useListaCompra() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const itemsQuery = useQuery({
    queryKey: ['lista-compra'],
    queryFn: ({ signal }) => apiRequest<ListaCompraItem[]>('/lista-compra', { signal }),
  });

  // Las sugerencias son un extra: sus errores se suprimen intencionalmente.
  const sugerenciasQuery = useQuery({
    queryKey: ['lista-compra', 'sugerencias'],
    queryFn: ({ signal }) =>
      apiRequest<SugerenciaCompra[]>('/lista-compra/sugerencias', { signal }),
  });

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ['lista-compra'] });

  const patchItems = (updater: (old: ListaCompraItem[]) => ListaCompraItem[]) =>
    queryClient.setQueryData<ListaCompraItem[]>(['lista-compra'], (old) =>
      old ? updater(old) : old
    );

  const addMutation = useMutation({
    mutationFn: ({
      nombre,
      cantidad,
      unidad,
    }: {
      nombre: string;
      cantidad?: number;
      unidad?: string;
    }) =>
      apiRequest<ListaCompraItem>('/lista-compra', {
        method: 'POST',
        json: { nombre, cantidad: cantidad ?? null, unidad: unidad ?? null },
      }),
    onError: () => toast.show({ tipo: 'error', mensaje: 'No se pudo añadir el artículo' }),
    onSettled: invalidateItems,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_checked }: { id: string; is_checked: boolean }) =>
      apiRequest<ListaCompraItem>(`/lista-compra/${id}`, { method: 'PATCH', json: { is_checked } }),
    onMutate: async ({ id, is_checked }) => {
      await queryClient.cancelQueries({ queryKey: ['lista-compra'] });
      const prev = queryClient.getQueryData<ListaCompraItem[]>(['lista-compra']);
      patchItems((old) => old.map((i) => (i.id === id ? { ...i, is_checked } : i)));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['lista-compra'], ctx.prev);
      toast.show({ tipo: 'error', mensaje: 'No se pudo actualizar el artículo' });
    },
    onSettled: invalidateItems,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/lista-compra/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['lista-compra'] });
      const prev = queryClient.getQueryData<ListaCompraItem[]>(['lista-compra']);
      patchItems((old) => old.filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['lista-compra'], ctx.prev);
      toast.show({ tipo: 'error', mensaje: 'No se pudo eliminar el artículo' });
    },
    onSettled: invalidateItems,
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest('/lista-compra', { method: 'DELETE' }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['lista-compra'] });
      const prev = queryClient.getQueryData<ListaCompraItem[]>(['lista-compra']);
      patchItems((old) => old.filter((i) => !i.is_checked));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['lista-compra'], ctx.prev);
      toast.show({ tipo: 'error', mensaje: 'No se pudo limpiar la lista' });
    },
    onSettled: invalidateItems,
  });

  const addItem = async (nombre: string, cantidad?: number, unidad?: string) =>
    addMutation.mutateAsync({ nombre, cantidad, unidad });

  const toggleItem = async (id: string, is_checked: boolean) =>
    toggleMutation.mutateAsync({ id, is_checked });

  const deleteItem = async (id: string) => deleteMutation.mutateAsync(id);

  const clearChecked = async () => clearMutation.mutateAsync();

  const items = itemsQuery.data ?? [];

  return {
    items,
    pendientes: items.filter((i) => !i.is_checked),
    comprados: items.filter((i) => i.is_checked),
    sugerencias: sugerenciasQuery.data ?? [],
    isLoading: itemsQuery.isLoading,
    error: itemsQuery.isError
      ? ((itemsQuery.error as any)?.message ?? 'Error al cargar la lista')
      : null,
    addItem,
    toggleItem,
    deleteItem,
    clearChecked,
    refetch: () => itemsQuery.refetch(),
  };
}
