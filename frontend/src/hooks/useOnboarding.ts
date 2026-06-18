import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../api/api';
import { PerfilHogar } from '../types/types';

const PERFIL_DONE_KEY = 'perfil_onboarding_done_v1';

/**
 * Gate de la encuesta de perfil del hogar (F-PIVOT #2).
 *
 * Debe montarse SOLO cuando hay sesión activa: el GET /onboarding requiere token.
 * Lógica robusta sin depender de códigos de estado:
 *  - Flag local `perfil_onboarding_done_v1` ya marcado → no mostrar.
 *  - GET /onboarding con éxito (200) → el hogar ya tiene perfil → marcar y no mostrar.
 *  - GET falla (404 sin perfil, o error de red) → mostrar encuesta (siempre saltable),
 *    para no atrapar al usuario si la red falla.
 */
export function useOnboarding() {
  const [needsProfile, setNeedsProfile] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const done = await SecureStore.getItemAsync(PERFIL_DONE_KEY);
      if (done === '1') {
        if (!cancelado) {
          setNeedsProfile(false);
          setChecked(true);
        }
        return;
      }
      try {
        await apiRequest<PerfilHogar>('/onboarding');
        // 200: el hogar ya completó el onboarding en otro dispositivo.
        await SecureStore.setItemAsync(PERFIL_DONE_KEY, '1');
        if (!cancelado) setNeedsProfile(false);
      } catch {
        // 404 (sin perfil) o error de red: mostramos la encuesta saltable.
        if (!cancelado) setNeedsProfile(true);
      } finally {
        if (!cancelado) setChecked(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const savePerfil = useCallback(
    async (gustos: string[], numComensales: number): Promise<PerfilHogar> => {
      const perfil = await apiRequest<PerfilHogar>('/onboarding', {
        method: 'POST',
        json: { gustos_culinarios: gustos, num_comensales: numComensales },
      });
      await SecureStore.setItemAsync(PERFIL_DONE_KEY, '1');
      setNeedsProfile(false);
      return perfil;
    },
    []
  );

  const skip = useCallback(async () => {
    await SecureStore.setItemAsync(PERFIL_DONE_KEY, '1');
    setNeedsProfile(false);
  }, []);

  return { needsProfile, checked, savePerfil, skip };
}
