// Sesión del panel admin.
//
// El token JWT real viaja en una cookie HttpOnly que pone el backend (en el
// dominio de la API), inaccesible a JavaScript → mitiga la exfiltración por XSS.
// Aquí solo guardamos una "pista" NO sensible (un flag) para el gating de UX:
// evitar el parpadeo de contenido y redirigir a /login. Esto NO es un control de
// seguridad — la protección real es la cookie HttpOnly que la API exige en cada
// petición. Si alguien falsea esta pista, las llamadas a la API devuelven 401 y
// la página redirige igualmente.

const HINT_COOKIE = "admin_session";
const HINT_MAX_AGE = 2 * 60 * 60; // 2h, igual que el TTL del token admin

export function setSessionHint(): void {
  // Legible (no HttpOnly) para que el middleware del edge pueda leerla.
  document.cookie = `${HINT_COOKIE}=1; path=/; max-age=${HINT_MAX_AGE}; SameSite=Lax`;
}

export function clearSessionHint(): void {
  document.cookie = `${HINT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${HINT_COOKIE}=1`));
}
