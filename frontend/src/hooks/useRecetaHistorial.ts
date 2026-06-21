import { useState, useCallback } from 'react';
import { apiRequest } from '../api/api';
import { RecetaHistorial, Valoracion } from '../types/types';

export function useRecetaHistorial() {
  const [loadingReceta, setLoadingReceta] = useState<string | null>(null);
  const [historial, setHistorial] = useState<RecetaHistorial[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const registrarAccion = async (
    nombre_receta: string,
    accion: 'cocinada' | 'rechazada',
    valoracion?: Valoracion,
    categoria?: string
  ): Promise<RecetaHistorial | null> => {
    setLoadingReceta(`${nombre_receta}:${accion}`);
    try {
      return await apiRequest<RecetaHistorial>('/pantry/recetas/historial', {
        method: 'POST',
        json: { nombre_receta, accion, valoracion, categoria },
      });
    } catch {
      return null;
    } finally {
      setLoadingReceta(null);
    }
  };

  const isLoading = (nombre_receta: string, accion: 'cocinada' | 'rechazada') =>
    loadingReceta === `${nombre_receta}:${accion}`;

  const fetchHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const data = await apiRequest<RecetaHistorial[]>('/pantry/recetas/historial');
      setHistorial(data);
    } catch {
      // silencioso — pantalla muestra EmptyState
    } finally {
      setLoadingHistorial(false);
    }
  }, []);

  return { registrarAccion, isLoading, historial, loadingHistorial, fetchHistorial };
}
