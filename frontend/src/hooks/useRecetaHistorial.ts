import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/api';
import { RecetaHistorial, Valoracion } from '../types/types';

export function useRecetaHistorial() {
  const queryClient = useQueryClient();
  const [loadingReceta, setLoadingReceta] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['historial'],
    queryFn: ({ signal }) => apiRequest<RecetaHistorial[]>('/pantry/recetas/historial', { signal }),
  });

  const registrarAccion = async (
    nombre_receta: string,
    accion: 'cocinada' | 'rechazada',
    valoracion?: Valoracion,
    categoria?: string
  ): Promise<RecetaHistorial | null> => {
    setLoadingReceta(`${nombre_receta}:${accion}`);
    try {
      const item = await apiRequest<RecetaHistorial>('/pantry/recetas/historial', {
        method: 'POST',
        json: { nombre_receta, accion, valoracion, categoria },
      });
      // El historial cacheado queda obsoleto tras registrar una acción.
      queryClient.invalidateQueries({ queryKey: ['historial'] });
      return item;
    } catch {
      return null;
    } finally {
      setLoadingReceta(null);
    }
  };

  const isLoading = (nombre_receta: string, accion: 'cocinada' | 'rechazada') =>
    loadingReceta === `${nombre_receta}:${accion}`;

  return {
    registrarAccion,
    isLoading,
    historial: query.data ?? [],
    loadingHistorial: query.isLoading || query.isRefetching,
    fetchHistorial: () => query.refetch(),
  };
}
