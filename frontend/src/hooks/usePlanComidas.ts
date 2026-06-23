import { useQuery } from '@tanstack/react-query';
import { PlanComidasResponse } from '../types/types';
import { apiRequest, TIMEOUT } from '../api/api';

export function usePlanComidas() {
  const query = useQuery({
    queryKey: ['plan-comidas'],
    queryFn: ({ signal }) =>
      apiRequest<PlanComidasResponse>('/pantry/plan-comidas', {
        signal,
        timeoutMs: TIMEOUT.AI,
      }),
  });

  return {
    loading: query.isLoading,
    plan: query.data ?? null,
    error: query.isError ? mensajeError(query.error) : null,
    refetch: () => query.refetch(),
  };
}

function mensajeError(error: unknown): string {
  const e = error as { name?: string; message?: string };
  if (e?.name === 'TimeoutError')
    return 'El servidor tardó demasiado en responder. Comprueba tu conexión.';
  return e?.message || 'No se pudo cargar el plan de comidas.';
}
