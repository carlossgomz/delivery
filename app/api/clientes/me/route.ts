import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClienteIdFromSession } from "@/lib/auth";

export async function GET() {
  const clienteId = getClienteIdFromSession();
  if (!clienteId) {
    return NextResponse.json({ cliente: null });
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) {
    return NextResponse.json({ cliente: null });
  }

  return NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      direccion: cliente.direccion
    }
  });
}

// Editar nombre/dirección desde "Mi cuenta" (el teléfono no se cambia aquí
// porque es el identificador de la cuenta).
export async function PATCH(req: NextRequest) {
  const clienteId = getClienteIdFromSession();
  if (!clienteId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const cliente = await prisma.cliente.update({
    where: { id: clienteId },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre }),
      ...(body.direccion !== undefined && { direccion: body.direccion })
    }
  });

  return NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      direccion: cliente.direccion
    }
  });
}
