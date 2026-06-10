import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { TokenResponse, Usuario, Hogar } from '../types/types';

const TOKEN_KEY = 'asistente_hogar_token';
const USUARIO_KEY = 'asistente_hogar_usuario';
const HOGAR_KEY = 'asistente_hogar_hogar';

interface AuthState {
  /** Token JWT de acceso, null si no hay sesión iniciada */
  token: string | null;
  usuario: Usuario | null;
  hogar: Hogar | null;
  /** true cuando ya se intentó restaurar la sesión desde SecureStore */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: TokenResponse) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  usuario: null,
  hogar: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const [token, usuarioJson, hogarJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USUARIO_KEY),
        SecureStore.getItemAsync(HOGAR_KEY),
      ]);
      set({
        token: token || null,
        usuario: usuarioJson ? (JSON.parse(usuarioJson) as Usuario) : null,
        hogar: hogarJson ? (JSON.parse(hogarJson) as Hogar) : null,
        hydrated: true,
      });
    } catch {
      // Almacenamiento corrupto o inaccesible: arrancar sin sesión
      set({ token: null, usuario: null, hogar: null, hydrated: true });
    }
  },

  setSession: async (session: TokenResponse) => {
    set({ token: session.access_token, usuario: session.usuario, hogar: session.hogar });
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, session.access_token),
      SecureStore.setItemAsync(USUARIO_KEY, JSON.stringify(session.usuario)),
      SecureStore.setItemAsync(HOGAR_KEY, JSON.stringify(session.hogar)),
    ]);
  },

  logout: async () => {
    set({ token: null, usuario: null, hogar: null });
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USUARIO_KEY),
      SecureStore.deleteItemAsync(HOGAR_KEY),
    ]);
  },
}));
