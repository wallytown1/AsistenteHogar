import { useState, useEffect, useCallback } from 'react';
import { DashboardData } from '../types/types';
import { apiRequest } from '../api/api';

/**
 * Hook para la orquestación asíncrona del Dashboard (Informe de la Mañana).
 */
export function useDashboard() {
  const [loading, setLoading] = useState<boolean>(true);
  const [briefing, setBriefing] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<DashboardData>('/dashboard', { signal });
      setBriefing(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(
        err.name === 'TimeoutError'
          ? 'El servidor tardó demasiado. Comprueba tu conexión.'
          : (err.message || 'Error al generar el informe diario del hogar')
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchBriefing(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchBriefing]);

  return { loading, briefing, error, refetch: () => fetchBriefing() };
}
