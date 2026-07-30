import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed, isDuenoAuthed } from "@/lib/auth";

export async function GET() {
  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1 }
  });

  return NextResponse.json({
    tasaCambio: config.tasaCambio,
    telefonoTienda: config.telefonoTienda,
    pedidosHabilitados: config.pedidosHabilitados,
    updatedAt: config.updatedAt
  });
}

export async function POST(req: NextRequest) {
  // Cualquier personal autenticado puede llegar hasta acá (el interruptor
  // "atendiendo en tienda" lo opera el empleado de delivery desde la
  // pantalla de Pedidos); la tasa y el teléfono siguen siendo solo del dueño.
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const data: { tasaCambio?: number; telefonoTienda?: string; pedidosHabilitados?: boolean } = {};

  if (body.tasaCambio !== undefined || body.telefonoTienda !== undefined) {
    if (!isDuenoAuthed()) {
      return NextResponse.json(
        { error: "Solo el administrador puede cambiar la tasa o el teléfono de la tienda" },
        { status: 403 }
      );
    }
  }

  if (body.tasaCambio !== undefined) {
    const tasaCambio = Number(body.tasaCambio);
    if (!tasaCambio || tasaCambio <= 0) {
      return NextResponse.json({ error: "Tasa inválida" }, { status: 400 });
    }
    data.tasaCambio = tasaCambio;
  }

  if (body.telefonoTienda !== undefined) {
    data.telefonoTienda = String(body.telefonoTienda).trim();
  }

  if (body.pedidosHabilitados !== undefined) {
    data.pedidosHabilitados = Boolean(body.pedidosHabilitados);
  }

  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: data,
    create: {
      id: 1,
      tasaCambio: data.tasaCambio ?? 1,
      telefonoTienda: data.telefonoTienda,
      pedidosHabilitados: data.pedidosHabilitados ?? true
    }
  });

  return NextResponse.json({
    tasaCambio: config.tasaCambio,
    telefonoTienda: config.telefonoTienda,
    pedidosHabilitados: config.pedidosHabilitados
  });
}
