import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre }),
      ...(body.precioUsd !== undefined && { precioUsd: Number(body.precioUsd) }),
      ...(body.categoria !== undefined && { categoria: body.categoria }),
      ...(body.activo !== undefined && { activo: Boolean(body.activo) })
    }
  });
  return NextResponse.json({ product });
}