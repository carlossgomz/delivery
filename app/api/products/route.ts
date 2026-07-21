import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { calcularPrecioFinal } from "@/lib/pricing";

export async function GET() {
  const admin = isAdminAuthed();

  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1, margenPorcentaje: 30 }
  });

  const products = await prisma.product.findMany({
    where: { activo: true },
    orderBy: { categoria: "asc" }
  });

  const mapped = products.map((p) => {
    const precioUsd = calcularPrecioFinal(p.costoUsd, p.margenPorcentaje, config.margenPorcentaje);
    return {
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      imagenUrl: p.imagenUrl,
      precioUsd,
      // El costo y el margen solo se exponen al personal de tienda logueado.
      ...(admin
        ? { codigo: p.codigo, costoUsd: p.costoUsd, margenPorcentaje: p.margenPorcentaje }
        : {})
    };
  });

  return NextResponse.json({ products: mapped });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const product = await prisma.product.create({
    data: {
      nombre: body.nombre,
      costoUsd: Number(body.costoUsd),
      margenPorcentaje: body.margenPorcentaje != null ? Number(body.margenPorcentaje) : null,
      categoria: body.categoria,
      imagenUrl: body.imagenUrl ?? null,
      codigo: body.codigo ?? null
    }
  });
  return NextResponse.json({ product });
}