import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, StaffRole, crearSesionPersonal } from "@/lib/auth";
import { DURACION_SESION_SEGUNDOS } from "@/lib/sesion-personal";

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

  const sesion = crearSesionPersonal(role);
  if (!sesion) {
    console.error("SESSION_SECRET falta o tiene menos de 32 caracteres");
    return NextResponse.json(
      { error: "El servidor no tiene configurado SESSION_SECRET" },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(ADMIN_COOKIE_NAME, sesion, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: DURACION_SESION_SEGUNDOS
  });
  return res;
}
