import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatEvents } from "@/lib/chatEvents";

// El cliente no tiene login: se identifica con un "clienteId" aleatorio que
// el navegador genera una sola vez y guarda en localStorage. Cualquiera con
// ese id puede leer esa conversación, igual que un link "no listado" —
// alcanza para este caso de uso (no hay datos sensibles de otros clientes).

export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "Falta clienteId" }, { status: 400 });
  }

  const conversacion = await prisma.conversacion.findUnique({
    where: { clienteId },
    include: { mensajes: { orderBy: { createdAt: "asc" } } }
  });

  if (!conversacion) {
    return NextResponse.json({ mensajes: [] });
  }

  return NextResponse.json({ mensajes: conversacion.mensajes });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clienteId, texto, clienteNombre, clienteTelefono } = body as {
    clienteId: string;
    texto: string;
    clienteNombre?: string;
    clienteTelefono?: string;
  };

  if (!clienteId || !texto?.trim()) {
    return NextResponse.json({ error: "Falta clienteId o texto" }, { status: 400 });
  }

  const conversacion = await prisma.conversacion.upsert({
    where: { clienteId },
    update: {
      ...(clienteNombre ? { clienteNombre } : {}),
      ...(clienteTelefono ? { clienteTelefono } : {}),
      updatedAt: new Date()
    },
    create: {
      clienteId,
      clienteNombre: clienteNombre ?? null,
      clienteTelefono: clienteTelefono ?? null
    }
  });

  const mensaje = await prisma.mensaje.create({
    data: {
      conversacionId: conversacion.id,
      remitente: "CLIENTE",
      texto: texto.trim()
    }
  });

  chatEvents.emit("nuevo_mensaje", { conversacionId: conversacion.id, remitente: "CLIENTE" });

  return NextResponse.json({ mensaje });
}
