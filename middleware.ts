import { NextRequest, NextResponse } from "next/server";
import { leerSesion, secretoDeSesion, type StaffRole } from "./lib/sesion-personal";

const COOKIE_NAME = "admin_session";

// Pantallas que son SOLO de los dueños (rol "admin"): configuración
// (tasa, teléfono) y productos. El empleado de delivery no debe poder
// entrar aquí ni por URL directa.
function esRutaSoloDueno(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/productos") ||
    pathname.startsWith("/admin/estadisticas")
  );
}

// Misma comprobación que getStaffRole en lib/auth.ts, con Web Crypto porque
// en Edge no existe el crypto de Node.
async function rolVerificado(valor: string | undefined): Promise<StaffRole | null> {
  const sesion = leerSesion(valor);
  const secreto = secretoDeSesion();
  if (!sesion || !secreto) return null;

  const codificador = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const firma = Uint8Array.from(sesion.firma.match(/../g)!, (par) => parseInt(par, 16));
  const valida = await crypto.subtle.verify("HMAC", clave, firma, codificador.encode(sesion.carga));
  return valida ? sesion.rol : null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await rolVerificado(req.cookies.get(COOKIE_NAME)?.value);

  if (!role) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (role === "delivery" && esRutaSoloDueno(pathname)) {
    // El empleado de delivery no tiene acceso a configuración/productos:
    // se le manda directo a su sección (pedidos).
    const pedidosUrl = new URL("/admin/pedidos", req.url);
    return NextResponse.redirect(pedidosUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
