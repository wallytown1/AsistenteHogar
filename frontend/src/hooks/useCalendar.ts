import { useState, useEffect, useCallback } from 'react';
import { EventoItem, ConflictoEvento, ConflictoDetalle, CalendarAgendaResponse } from '../types/types';
import { apiRequest } from '../api/api';

/**
 * Hook para la gestión del calendario familiar y detección de solapamientos horarios.
 */
export function useCalendar() {
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [conflictos, setConflictos] = useState<ConflictoDetalle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<CalendarAgendaResponse>('/calendar', { signal });
      setEventos(data.eventos || []);
      setConflictos(data.conflictos || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(
        err.name === 'TimeoutError'
          ? 'El servidor tardó demasiado. Comprueba tu conexión.'
          : (err.message || 'Error al cargar la agenda de la casa')
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  /**
   * Agrega un evento. Primero valida si colisiona con eventos existentes en el calendario
   * cargado desde el backend. Si hay conflicto, lo retorna para confirmación del usuario.
   * Si bypassConflictCheck es true, fuerza la creación en base de datos de manera inmediata.
   */
  const addEvento = async (
    evento: Omit<EventoItem, 'id' | 'is_deleted' | 'hogar_id' | 'created_at' | 'updated_at'>,
    bypassConflictCheck = false
  ): Promise<ConflictoEvento | null> => {
    setIsLoading(true);
    setError(null);
    try {
      if (!bypassConflictCheck) {
        const startNew = new Date(evento.fecha_inicio).getTime();
        const endNew = new Date(evento.fecha_fin).getTime();

        // Buscar conflictos locales con el listado activo
        const conflicto = eventos.find((e: EventoItem) => {
          const s = new Date(e.fecha_inicio).getTime();
          const f = new Date(e.fecha_fin).getTime();
          return startNew < f && endNew > s;
        });

        if (conflicto) {
          return {
            evento_nuevo: {
              ...evento,
              id: 'temp_new',
              hogar_id: '',
              is_deleted: false,
              created_at: '',
              updated_at: ''
            } as EventoItem,
            evento_conflictivo: conflicto
          };
        }
      }

      // Si no colisiona o se decidió forzar la creación (bypass), se persiste en base de datos
      await apiRequest<EventoItem>('/calendar', {
        method: 'POST',
        json: evento,
      });
      await fetchCalendar();
      return null;
    } catch (err: any) {
      setError(err.message || 'Error al registrar el evento en el calendario');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Elimina un evento de forma lógica (soft delete).
   */
  const deleteEvento = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest<EventoItem>(`/calendar/${id}`, {
        method: 'DELETE',
      });
      await fetchCalendar();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el evento de la agenda');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchCalendar(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchCalendar]);

  return {
    eventos,
    conflictos,
    isLoading,
    error,
    addEvento,
    deleteEvento,
    refetch: () => fetchCalendar(),
  };
}
