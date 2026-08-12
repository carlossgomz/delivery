import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDuenoAuthed } from "@/lib/auth";
import { redondearPrecio } from "@/lib/precio";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isDuenoAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre }),
      ...(body.precioUsd !== undefined && { precioUsd: redondearPrecio(Number(body.precioUsd)) }),
      ...(body.categoria !== undefined && { categoria: body.categoria }),
      ...(body.activo !== undefined && { activo: Boolean(body.activo) }),
      ...(body.porPeso !== undefined && { porPeso: Boolean(body.porPeso) }),
      ...(body.permiteUnidad !== undefined && { permiteUnidad: Boolean(body.permiteUnidad) }),
      ...(body.permiteMedia !== undefined && { permiteMedia: Boolean(body.permiteMedia) }),
      ...(body.pesoEstimadoUnidadGramos !== undefined && {
        pesoEstimadoUnidadGramos: body.pesoEstimadoUnidadGramos === null || body.pesoEstimadoUnidadGramos === "" ? null : Math.round(Number(body.pesoEstimadoUnidadGramos))
      }),
      ...(body.imagenUrl !== undefined && { imagenUrl: body.imagenUrl }),
      ...(body.orden !== undefined && { orden: Number(body.orden) })
    }
  });
  return NextResponse.json({ product });
}