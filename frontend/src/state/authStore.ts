import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { TokenResponse, Usuario, Hogar, CuentaEliminadaResponse } from '../types/types';
import { apiRequest } from '../api/api';

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
  /**
   * Destrucción definitiva de la cuenta y todos los datos del hogar (RGPD art. 17).
   * Exige la contraseña actual (re-autenticación en el backend). Si la petición
   * falla (contraseña errónea, red), lanza el error y NO cierra la sesión local.
   */
  deleteAccount: (password: string) => Promise<void>;
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
    // La sesión en memoria se actualiza primero; la persistencia es best-effort.
    // SecureStore no está disponible en react-native-web: silenciamos el error
    // para que el registro/login funcione igualmente (la sesión vive en memoria).
    set({ token: session.access_token, usuario: session.usuario, hogar: session.hogar });
    try {
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, session.access_token),
        SecureStore.setItemAsync(USUARIO_KEY, JSON.stringify(session.usuario)),
        SecureStore.setItemAsync(HOGAR_KEY, JSON.stringify(session.hogar)),
      ]);
    } catch {
      // Plataforma sin SecureStore (web): sesión activa solo durante la sesión
    }
  },

  logout: async () => {
    set({ token: null, usuario: null, hogar: null });
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(USUARIO_KEY),
        SecureStore.deleteItemAsync(HOGAR_KEY),
      ]);
    } catch {
      // Plataforma sin SecureStore (web): nada que limpiar
    }
  },

  deleteAccount: async (password: string) => {
    // El backend re-autentica con la contraseña y borra físicamente el hogar
    // (cascade a usuarios, despensa, tareas y eventos). Un 401 aquí significa
    // contraseña incorrecta: se propaga sin tocar la sesión local.
    await apiRequest<CuentaEliminadaResponse>('/auth/cuenta', {
      method: 'DELETE',
      json: { password },
    });
    // Éxito: misma limpieza que logout. El gate de AppNavigator volverá al Login.
    set({ token: null, usuario: null, hogar: null });
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(USUARIO_KEY),
        SecureStore.deleteItemAsync(HOGAR_KEY),
      ]);
    } catch {
      // Plataforma sin SecureStore (web): nada que limpiar
    }
  },
}));
