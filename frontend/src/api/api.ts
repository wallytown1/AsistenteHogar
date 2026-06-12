import { Alert } from 'react-native';
import { API_BASE_URL } from '../config/config';
import { useAuthStore } from '../state/authStore';

interface RequestOptions extends RequestInit {
  json?: any;
}

/**
 * Cliente HTTP asíncrono genérico para realizar peticiones a la API del backend.
 * Inyecta automáticamente la cabecera Authorization con el token JWT de la sesión
 * activa y mapea los payloads JSON. Si el backend responde 401, cierra la sesión
 * local para devolver al usuario a la pantalla de acceso.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // AbortSignal.timeout lanza TimeoutError (no AbortError); propagamos para que el
  // caller distinga entre cancelación intencional y timeout de red.
  if (!API_BASE_URL) {
    const errorMsg = 'La configuración de red del entorno no fue cargada adecuadamente. La variable EXPO_PUBLIC_API_URL no está definida.';
    Alert.alert('Error de Configuración', errorMsg);
    throw new Error(errorMsg);
  }

  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(options.headers || {});
  const token = useAuthStore.getState().token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.json);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    let errorMessage = `Error de conexión HTTP: ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.detail) {
        // detail puede ser un string directo o una colección de validación (por ejemplo, errores de Pydantic)
        errorMessage = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
      }
    } catch {
      // Mantener mensaje por defecto si no es JSON estructurado
    }

    // Sesión expirada o token inválido: cerrar sesión local (excepto en los
    // propios endpoints de auth, donde el 401 es un error de credenciales).
    if (response.status === 401 && token && !path.startsWith('/auth/')) {
      await useAuthStore.getState().logout();
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
