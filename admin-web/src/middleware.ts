import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protección de rutas del panel en el edge (antes de renderizar). Lee la
// "pista" de sesión (cookie no sensible, puesta por el cliente en este dominio)
// y redirige a /login si falta — evita el parpadeo de contenido protegido.
//
// NO es el control de seguridad: el token real es la cookie HttpOnly que la API
// (otro dominio) exige en cada petición. Una pista falseada llega a la página,
// pero todas las llamadas a la API devuelven 401 y se redirige igualmente.

const HINT_COOKIE = "admin_session";

export function middleware(request: NextRequest) {
  const hasHint = request.cookies.get(HINT_COOKIE)?.value === "1";
  if (!hasHint) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/prompts/:path*", "/recetario/:path*"],
};
