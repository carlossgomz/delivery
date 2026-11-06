import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CLIENTE_COOKIE_NAME,
  DURACION_SESION_CLIENTE_SEGUNDOS,
  crearSesionCliente,
  verifyPassword
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { cedula, password } = await req.json();
  if (!cedula || !password) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { cedula } });
  if (!cliente || !verifyPassword(password, cliente.passwordHash)) {
    return NextResponse.json({ error: "Cédula o contraseña incorrectos" }, { status: 401 });
  }

  const sesion = crearSesionCliente(cliente.id);
  if (!sesion) {
    console.error("SESSION_SECRET falta o tiene menos de 32 caracteres");
    return NextResponse.json(
      { error: "No se pudo iniciar sesión. Intenta más tarde." },
      { status: 500 }
    );
  }

  const res = NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      direccion: cliente.direccion
    }
  });
  res.cookies.set(CLIENTE_COOKIE_NAME, sesion, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: DURACION_SESION_CLIENTE_SEGUNDOS
  });
  return res;
}
