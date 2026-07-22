import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// El catálogo y el checkout esperan un campo "precioUsd" en cada producto.
// Ese precio ya viene cargado directamente por el admin (sin costo ni margen).
export async function GET() {
  const products = await prisma.product.findMany({
    where: { activo: true },
    orderBy: { categoria: "asc" }
  });

  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const precioUsd = body.precioUsd !== undefined && body.precioUsd !== null ? Number(body.precioUsd) : 0;

  const product = await prisma.product.create({
    data: {
      codigo: body.codigo ?? `PROD-${Date.now()}`,
      nombre: body.nombre,
      precioUsd,
      categoria: body.categoria,
      imagenUrl: body.imagenUrl ?? null
    }
  });

  return NextResponse.json({ product });
}