import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, StaffRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  // Dos claves distintas dan dos roles distintos:
  // - ADMIN_PASSWORD    -> dueños de la empresa (configuración y productos)
  // - DELIVERY_PASSWORD -> empleado autorizado de delivery (pedidos, mensajes,
  //   clientes y llamadas)
  let role: StaffRole | null = null;
  if (password && password === process.env.ADMIN_PASSWORD) {
    role = "admin";
  } else if (password && password === process.env.DELIVERY_PASSWORD) {
    role = "delivery";
  }

  if (!role) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(ADMIN_COOKIE_NAME, role, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 12
  });
  return res;
}
