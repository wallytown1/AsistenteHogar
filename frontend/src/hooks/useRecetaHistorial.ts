import { useState } from 'react';
import { apiRequest } from '../api/api';
import { RecetaHistorial } from '../types/types';

export function useRecetaHistorial() {
  const [loadingReceta, setLoadingReceta] = useState<string | null>(null);

  const registrarAccion = async (
    nombre_receta: string,
    accion: 'cocinada' | 'rechazada'
  ): Promise<RecetaHistorial | null> => {
    setLoadingReceta(`${nombre_receta}:${accion}`);
    try {
      return await apiRequest<RecetaHistorial>('/pantry/recetas/historial', {
        method: 'POST',
        json: { nombre_receta, accion },
      });
    } catch {
      return null;
    } finally {
      setLoadingReceta(null);
    }
  };

  const isLoading = (nombre_receta: string, accion: 'cocinada' | 'rechazada') =>
    loadingReceta === `${nombre_receta}:${accion}`;

  return { registrarAccion, isLoading };
}
