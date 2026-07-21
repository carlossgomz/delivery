import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function GET() {
  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1 }
  });
  return NextResponse.json({ tasaCambio: config.tasaCambio, updatedAt: config.updatedAt });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const tasaCambio = Number(body.tasaCambio);
  if (!tasaCambio || tasaCambio <= 0) {
    return NextResponse.json({ error: "Tasa inválida" }, { status: 400 });
  }
  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: { tasaCambio },
    create: { id: 1, tasaCambio }
  });
  // Nota: los precios en Bs de cada producto se calculan al vuelo
  // (precioUsd * tasaCambio) en el frontend y en los pedidos nuevos,
  // así que no hace falta actualizar cada producto uno por uno.
  return NextResponse.json({ tasaCambio: config.tasaCambio });
}
