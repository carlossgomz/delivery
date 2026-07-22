import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { calcularPrecioFinalUsd } from "@/lib/pricing";

// El catálogo y el checkout esperan un campo "precioUsd" en cada producto.
export async function GET() {
  const products = await prisma.product.findMany({
    where: { activo: true },
    orderBy: { categoria: "asc" }
  });

  const withPrecio = products.map((p) => ({
    ...p,
    precioUsd: calcularPrecioFinalUsd(p.costoUsd ?? 0, p.margenPorcentaje ?? 0)
  }));

  return NextResponse.json({ products: withPrecio });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const costoUsd = body.costoUsd !== undefined && body.costoUsd !== null ? Number(body.costoUsd) : null;
  const margenPorcentaje = body.margenPorcentaje !== undefined && body.margenPorcentaje !== null ? Number(body.margenPorcentaje) : 30;

  const precioUsd =
    body.precioUsd !== undefined && body.precioUsd !== null
      ? Number(body.precioUsd)
      : costoUsd !== null
        ? costoUsd * (1 + margenPorcentaje / 100) + 0.15
        : 0;

  const product = await prisma.product.create({
    data: {
      codigo: body.codigo ?? `PROD-${Date.now()}`,
      nombre: body.nombre,
      costoUsd: costoUsd ?? undefined, // <-- Si es null, pasa undefined a Prisma
      margenPorcentaje,
      precioUsd,
      categoria: body.categoria,
      imagenUrl: body.imagenUrl ?? null
    }
  });

  return NextResponse.json({ product });
}