import { useState, useEffect } from 'react';
import { PerfilIndividual } from '../types/types';
import { apiRequest } from '../api/api';

export function usePerfiles() {
  const [perfiles, setPerfiles] = useState<PerfilIndividual[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiRequest<PerfilIndividual[]>('/perfiles')
      .then(setPerfiles)
      .catch(() => setPerfiles([]))
      .finally(() => setLoading(false));
  }, []);

  return { perfiles, loading };
}
