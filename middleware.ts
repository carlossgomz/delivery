import { NextRequest, NextResponse } from "next/server";

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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get(COOKIE_NAME)?.value;
  const staffOk = role === "admin" || role === "delivery";

  if (!staffOk) {
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
