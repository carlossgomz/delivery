import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Usado por el panel de "Pedido por llamada": el personal escribe la
// cédula que el cliente dice por teléfono y se busca si ya tiene cuenta.
export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cedula = req.nextUrl.searchParams.get("cedula")?.trim();
  if (!cedula) {
    return NextResponse.json({ error: "Falta la cédula" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { cedula } });
  if (!cliente) {
    return NextResponse.json({ cliente: null });
  }

  return NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      direccion: cliente.direccion
    }
  });
}
