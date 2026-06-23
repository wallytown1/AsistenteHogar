import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/**
 * Cliente único de React Query para toda la app. Centraliza caché, dedupe de
 * peticiones concurrentes, reintentos y `staleTime` por defecto.
 *
 * - `staleTime` de 30s: al cambiar de pestaña, los datos recién cargados se
 *   reutilizan sin refetch (navegación instantánea).
 * - `retry`: 1 reintento, pero nunca ante errores 4xx (cliente): un 401/402/404
 *   no se arregla reintentando.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
