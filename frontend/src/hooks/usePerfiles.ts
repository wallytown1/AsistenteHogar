import { useQuery } from '@tanstack/react-query';
import { PerfilIndividual } from '../types/types';
import { apiRequest } from '../api/api';

export function usePerfiles() {
  const query = useQuery({
    queryKey: ['perfiles'],
    queryFn: ({ signal }) => apiRequest<PerfilIndividual[]>('/perfiles', { signal }),
  });

  return {
    perfiles: query.data ?? [],
    loading: query.isLoading,
  };
}
