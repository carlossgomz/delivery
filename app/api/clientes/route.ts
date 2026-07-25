import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLIENTE_COOKIE_NAME, hashPassword } from "@/lib/auth";

// Registro de cliente. Lo deja logueado de una vez (misma cookie que login).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, cedula, telefono, direccion, password } = body as {
    nombre: string;
    cedula: string;
    telefono: string;
    direccion: string;
    password: string;
  };

  if (!nombre || !cedula || !telefono || !direccion || !password) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const existente = await prisma.cliente.findUnique({ where: { cedula } });
  if (existente) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con esa cédula" },
      { status: 409 }
    );
  }

  const cliente = await prisma.cliente.create({
    data: { nombre, cedula, telefono, direccion, passwordHash: hashPassword(password) }
  });

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
    maxAge: 60 * 60 * 24 * 180 // 180 días
  });
  return res;
}
