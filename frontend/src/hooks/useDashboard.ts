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

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<DashboardData>('/dashboard');
      setBriefing(data);
    } catch (err: any) {
      setError(err.message || 'Error al generar el informe diario del hogar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  return { loading, briefing, error, refetch: fetchBriefing };
}
