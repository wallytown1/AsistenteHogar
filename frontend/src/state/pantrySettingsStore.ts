import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const UMBRAL_KEY = 'pantry-settings-umbral';

export const OPCIONES_UMBRAL = [3, 6, 10, 14] as const;
export type DiasUmbral = (typeof OPCIONES_UMBRAL)[number];

interface PantrySettingsState {
  diasUmbral: DiasUmbral;
  hydrate: () => Promise<void>;
  setDiasUmbral: (days: DiasUmbral) => void;
}

export const usePantrySettingsStore = create<PantrySettingsState>((set) => ({
  diasUmbral: 6,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(UMBRAL_KEY);
      const parsed = stored ? (parseInt(stored, 10) as DiasUmbral) : null;
      if (parsed && (OPCIONES_UMBRAL as readonly number[]).includes(parsed)) {
        set({ diasUmbral: parsed });
      }
    } catch {
      // SecureStore no disponible en web — usa el valor por defecto
    }
  },

  setDiasUmbral: (days) => {
    set({ diasUmbral: days });
    SecureStore.setItemAsync(UMBRAL_KEY, String(days)).catch(() => {});
  },
}));
