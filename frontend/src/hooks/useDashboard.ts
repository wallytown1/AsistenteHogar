import { useQuery } from '@tanstack/react-query';
import { DashboardData } from '../types/types';
import { apiRequest, TIMEOUT } from '../api/api';
import { programarNotificacionMarce } from '../lib/notifications';

/**
 * Hook para la orquestación asíncrona del Dashboard (Informe de la Mañana).
 * Cacheado con React Query: al volver a la pestaña no se regenera el briefing
 * (llamada IA cara) mientras siga fresco.
 */
export function useDashboard() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: async ({ signal }) => {
      const data = await apiRequest<DashboardData>('/dashboard', {
        signal,
        timeoutMs: TIMEOUT.AI,
      });
      if (data.notificacion_push) {
        programarNotificacionMarce(data.notificacion_push).catch(console.error);
      }
      return data;
    },
  });

  return {
    loading: query.isLoading,
    briefing: query.data ?? null,
    error: query.isError ? mensajeError(query.error) : null,
    refetch: () => query.refetch(),
  };
}

function mensajeError(error: unknown): string {
  const e = error as { name?: string; message?: string };
  if (e?.name === 'TimeoutError') return 'El servidor tardó demasiado. Comprueba tu conexión.';
  return e?.message || 'Error al generar el informe diario del hogar';
}
