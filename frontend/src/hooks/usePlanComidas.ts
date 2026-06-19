import { useState, useEffect, useCallback } from 'react';
import { PlanComidasResponse } from '../types/types';
import { apiRequest, TIMEOUT } from '../api/api';

export function usePlanComidas() {
  const [loading, setLoading] = useState<boolean>(true);
  const [plan, setPlan] = useState<PlanComidasResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<PlanComidasResponse>('/pantry/plan-comidas', {
        signal,
        timeoutMs: TIMEOUT.AI,
      });
      setPlan(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(
        err.name === 'TimeoutError'
          ? 'El servidor tardó demasiado en responder. Comprueba tu conexión.'
          : err.message || 'No se pudo cargar el plan de comidas.'
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPlan(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchPlan]);

  return { loading, plan, error, refetch: () => fetchPlan() };
}
