import { useState, useEffect, useCallback } from 'react';
import { TareaItem } from '../types/types';
import { apiRequest } from '../api/api';

/**
 * Hook reactivo para la gestión completa y sincronizada de tareas domésticas del hogar actual.
 * Implementa actualizaciones optimistas para una respuesta de interfaz instantánea.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<TareaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<TareaItem[]>('/tasks', { signal });
      setTasks(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(
        err.name === 'TimeoutError'
          ? 'El servidor tardó demasiado. Comprueba tu conexión.'
          : (err.message || 'Error al obtener la lista de tareas domésticas')
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  const addTask = async (
    nombre: string,
    asignado_a: string | null,
    frecuencia: string,
    prioridad: string
  ) => {
    setError(null);
    try {
      const newTask = await apiRequest<TareaItem>('/tasks', {
        method: 'POST',
        json: {
          nombre,
          asignado_a,
          frecuencia,
          prioridad,
          estado: 'pendiente'
        }
      });
      // Insertar al inicio de la colección local
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err: any) {
      setError(err.message || 'Error al crear la nueva tarea doméstica');
      throw err;
    }
  };

  const toggleTaskStatus = async (id: string, estadoActual: string) => {
    setError(null);
    const nuevoEstado = estadoActual === 'pendiente' ? 'completado' : 'pendiente';
    const ultimoCompletado = nuevoEstado === 'completado' ? new Date().toISOString() : null;

    // Snapshot SOLO del item afectado para poder revertirlo de forma aislada.
    // Restaurar el array completo (snapshot global) pisaría cambios optimistas concurrentes
    // de otras tareas que estuvieran en vuelo (B5: stale-closure rollback).
    const tareaPrevia = tasks.find(t => t.id === id);

    // Actualización optimista de 0ms en local
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, estado: nuevoEstado, ultimo_completado: ultimoCompletado }
          : t
      )
    );

    try {
      await apiRequest<TareaItem>(`/tasks/${id}`, {
        method: 'PATCH',
        json: {
          estado: nuevoEstado,
          ultimo_completado: ultimoCompletado
        }
      });
    } catch (err: any) {
      // Reversión SOLO del item afectado, preservando cambios concurrentes en otras tareas
      if (tareaPrevia) {
        setTasks(prev => prev.map(t => (t.id === id ? tareaPrevia : t)));
      }
      const errMsg = err.message || 'Error al actualizar el estado de la tarea';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const deleteTask = async (id: string) => {
    setError(null);
    // Snapshot del item borrado y su posición, para reinsertarlo de forma aislada si falla.
    // Evita restaurar el array completo (que pisaría cambios concurrentes — B5).
    const tareaPrevia = tasks.find(t => t.id === id);
    const indicePrevio = tasks.findIndex(t => t.id === id);

    // Remoción lógica optimista de 0ms en local
    setTasks(prev => prev.filter(t => t.id !== id));

    try {
      await apiRequest<TareaItem>(`/tasks/${id}`, {
        method: 'DELETE'
      });
    } catch (err: any) {
      // Reversión: reinsertar SOLO la tarea borrada en su posición original
      if (tareaPrevia) {
        setTasks(prev => {
          if (prev.some(t => t.id === id)) return prev; // ya presente, nada que hacer
          const copia = [...prev];
          copia.splice(Math.min(indicePrevio, copia.length), 0, tareaPrevia);
          return copia;
        });
      }
      const errMsg = err.message || 'Error al eliminar la tarea doméstica';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchTasks(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchTasks]);

  return {
    tasks,
    isLoading,
    error,
    refetch: () => fetchTasks(),
    addTask,
    toggleTaskStatus,
    deleteTask
  };
}
