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

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<TareaItem[]>('/tasks');
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Error al obtener la lista de tareas domésticas');
    } finally {
      setIsLoading(false);
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

    // Respaldo de seguridad del estado previo para rollback
    const previousTasks = [...tasks];

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
      // Reversión del estado ante fallos del servidor o red
      setTasks(previousTasks);
      const errMsg = err.message || 'Error al actualizar el estado de la tarea';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const deleteTask = async (id: string) => {
    setError(null);
    // Respaldo de seguridad del estado previo para rollback
    const previousTasks = [...tasks];

    // Remoción lógica optimista de 0ms en local
    setTasks(prev => prev.filter(t => t.id !== id));

    try {
      await apiRequest<TareaItem>(`/tasks/${id}`, {
        method: 'DELETE'
      });
    } catch (err: any) {
      // Reversión ante fallos del servidor o red
      setTasks(previousTasks);
      const errMsg = err.message || 'Error al eliminar la tarea doméstica';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    isLoading,
    error,
    refetch: fetchTasks,
    addTask,
    toggleTaskStatus,
    deleteTask
  };
}
