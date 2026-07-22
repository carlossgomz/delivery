import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function GET() {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const conversaciones = await prisma.conversacion.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      mensajes: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  const conNoLeidos = await Promise.all(
    conversaciones.map(async (c) => {
      const noLeidos = await prisma.mensaje.count({
        where: { conversacionId: c.id, remitente: "CLIENTE", leido: false }
      });
      return {
        id: c.id,
        clienteNombre: c.clienteNombre,
        clienteTelefono: c.clienteTelefono,
        updatedAt: c.updatedAt,
        ultimoMensaje: c.mensajes[0]?.texto ?? null,
        noLeidos
      };
    })
  );

  return NextResponse.json({ conversaciones: conNoLeidos });
}
