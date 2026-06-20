import { clearSessionHint } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    // Defensa CSRF: cabecera personalizada que un sitio atacante no puede enviar
    // cross-origin sin un preflight CORS que el backend rechaza.
    "X-Admin-Request": "1",
    ...init?.headers,
  };

  // credentials:include → el navegador envía la cookie HttpOnly de sesión admin
  // (puesta por el backend en su dominio) en cada petición cross-origin.
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 401) clearSessionHint();
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Typed helpers ──────────────────────────────────────────────────────────

export interface AdminInfo {
  id: string;
  email: string;
  nombre: string;
}

export interface AdminTokenResponse {
  access_token: string;
  token_type: string;
  admin: AdminInfo;
}

export interface PromptTemplate {
  id: string;
  clave: string;
  system_instruction: string;
  activo: boolean;
  version: number;
  updated_at: string;
}

export interface RecetaMaestra {
  id: string;
  nombre: string;
  ingredientes: string[];
  pasos: string[];
  categoria: string;
  temporada: string | null;
  aprovechamiento: boolean;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export const adminApi = {
  login: (email: string, password: string) =>
    api.post<AdminTokenResponse>("/admin/auth/login", { email, password }),

  logout: () => api.post<{ success: boolean }>("/admin/auth/logout", {}),

  getPrompts: () => api.get<PromptTemplate[]>("/admin/prompts"),
  getPrompt: (clave: string) => api.get<PromptTemplate>(`/admin/prompts/${clave}`),
  patchPrompt: (
    clave: string,
    body: { system_instruction?: string; activo?: boolean },
  ) => api.patch<PromptTemplate>(`/admin/prompts/${clave}`, body),

  getRecetario: (activaOnly = false) =>
    api.get<RecetaMaestra[]>(`/admin/recetario${activaOnly ? "?activa_only=true" : ""}`),
  getReceta: (id: string) => api.get<RecetaMaestra>(`/admin/recetario/${id}`),
  createReceta: (body: Omit<RecetaMaestra, "id" | "activa" | "created_at" | "updated_at">) =>
    api.post<RecetaMaestra>("/admin/recetario", body),
  patchReceta: (id: string, body: Partial<RecetaMaestra>) =>
    api.patch<RecetaMaestra>(`/admin/recetario/${id}`, body),
  deleteReceta: (id: string) => api.delete<{ success: boolean }>(`/admin/recetario/${id}`),
};
