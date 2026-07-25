import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Usado para la burbuja de "mensajes nuevos" en el botón de Contacto del
// catálogo: a diferencia de GET /api/chat/mensajes, este NO marca nada
// como leído (se puede llamar seguido, incluso sin tener el chat abierto).
export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "Falta clienteId" }, { status: 400 });
  }

  const conversacion = await prisma.conversacion.findUnique({ where: { clienteId } });
  if (!conversacion) {
    return NextResponse.json({ noLeidos: 0 });
  }

  const noLeidos = await prisma.mensaje.count({
    where: { conversacionId: conversacion.id, remitente: "TIENDA", leido: false }
  });

  return NextResponse.json({ noLeidos });
}
