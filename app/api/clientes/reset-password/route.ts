import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed, hashPassword } from "@/lib/auth";

// El cliente que olvidó su contraseña contacta a la tienda (llamada, chat,
// etc.) y da su cédula para identificarse. El personal la busca en
// /admin/clientes y define aquí una contraseña nueva, que le dicta o
// escribe al cliente. No hay "recuperación" automática por correo/SMS
// porque el registro de cliente no pide ni correo ni verifica el teléfono.
export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { cedula, newPassword } = body as { cedula: string; newPassword: string };

  if (!cedula || !newPassword) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const cliente = await prisma.cliente.findUnique({ where: { cedula: cedula.trim() } });
  if (!cliente) {
    return NextResponse.json({ error: "No existe una cuenta con esa cédula" }, { status: 404 });
  }

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { passwordHash: hashPassword(newPassword) }
  });

  return NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono
    }
  });
}
