import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function GET() {
  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1 }
  });

  return NextResponse.json({
    tasaCambio: config.tasaCambio,
    telefonoTienda: config.telefonoTienda,
    updatedAt: config.updatedAt
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const data: { tasaCambio?: number; telefonoTienda?: string } = {};

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

  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, tasaCambio: data.tasaCambio ?? 1, telefonoTienda: data.telefonoTienda }
  });

  return NextResponse.json({
    tasaCambio: config.tasaCambio,
    telefonoTienda: config.telefonoTienda
  });
}
