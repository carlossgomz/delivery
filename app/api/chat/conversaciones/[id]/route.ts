import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { chatEvents } from "@/lib/chatEvents";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const conversacion = await prisma.conversacion.findUnique({
    where: { id: params.id },
    include: { mensajes: { orderBy: { createdAt: "asc" } } }
  });

  if (!conversacion) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  // Al abrir la conversación, se marcan como leídos los mensajes del cliente.
  await prisma.mensaje.updateMany({
    where: { conversacionId: conversacion.id, remitente: "CLIENTE", leido: false },
    data: { leido: true }
  });

  return NextResponse.json({ conversacion });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const texto = (body.texto as string)?.trim();
  if (!texto) {
    return NextResponse.json({ error: "Falta el texto del mensaje" }, { status: 400 });
  }

  const conversacion = await prisma.conversacion.findUnique({ where: { id: params.id } });
  if (!conversacion) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const mensaje = await prisma.mensaje.create({
    data: {
      conversacionId: conversacion.id,
      remitente: "TIENDA",
      texto
    }
  });

  await prisma.conversacion.update({
    where: { id: conversacion.id },
    data: { updatedAt: new Date() }
  });

  chatEvents.emit("nuevo_mensaje", { conversacionId: conversacion.id, remitente: "TIENDA" });

  return NextResponse.json({ mensaje });
}
