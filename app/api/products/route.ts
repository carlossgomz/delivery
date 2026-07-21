import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

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
  const product = await prisma.product.create({
    data: {
      nombre: body.nombre,
      precioUsd: Number(body.precioUsd),
      categoria: body.categoria,
      imagenUrl: body.imagenUrl ?? null
    }
  });
  return NextResponse.json({ product });
}
