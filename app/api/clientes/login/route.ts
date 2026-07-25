import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLIENTE_COOKIE_NAME, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { cedula, password } = await req.json();
  if (!cedula || !password) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { cedula } });
  if (!cliente || !verifyPassword(password, cliente.passwordHash)) {
    return NextResponse.json({ error: "Cédula o contraseña incorrectos" }, { status: 401 });
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
  res.cookies.set(CLIENTE_COOKIE_NAME, cliente.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180
  });
  return res;
}
