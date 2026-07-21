import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

type ConfigRecord = {
  id: number;
  tasaCambio: number;
  margenPorcentaje: number;
  updatedAt: Date;
};

export async function GET() {
  const config = (await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1, margenPorcentaje: 30 }
  })) as ConfigRecord;

  return NextResponse.json({
    tasaCambio: config.tasaCambio,
    margenPorcentaje: config.margenPorcentaje,
    updatedAt: config.updatedAt
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();

  const data: { tasaCambio?: number; margenPorcentaje?: number } = {};

  if (body.tasaCambio !== undefined) {
    const tasaCambio = Number(body.tasaCambio);
    if (!tasaCambio || tasaCambio <= 0) {
      return NextResponse.json({ error: "Tasa inválida" }, { status: 400 });
    }
    data.tasaCambio = tasaCambio;
  }

  if (body.margenPorcentaje !== undefined) {
    const margenPorcentaje = Number(body.margenPorcentaje);
    if (margenPorcentaje < 0) {
      return NextResponse.json({ error: "Margen inválido" }, { status: 400 });
    }
    data.margenPorcentaje = margenPorcentaje;
  }

  const config = (await prisma.config.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, tasaCambio: data.tasaCambio ?? 1, margenPorcentaje: data.margenPorcentaje ?? 30 }
  })) as ConfigRecord;

  // Nota: los precios de cada producto (costo + margen + delivery) se
  // calculan al vuelo en /api/products, así que cambiar la tasa o el margen
  // aquí actualiza automáticamente todos los precios sin tocar cada producto.
  return NextResponse.json({ tasaCambio: config.tasaCambio, margenPorcentaje: config.margenPorcentaje });
}