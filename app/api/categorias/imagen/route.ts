import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Guarda (o reemplaza) la imagen representativa de una categoría entera —
// la que se ve en los círculos del catálogo del cliente. Si la categoría
// todavía no tiene fila propia en "Categoria" (nadie le había puesto foto
// antes), la crea; si ya existe, solo actualiza la imagen.
export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const imagenUrl = typeof body.imagenUrl === "string" ? body.imagenUrl.trim() : "";

  if (!nombre || !imagenUrl) {
    return NextResponse.json({ error: "Falta el nombre de la categoría o la imagen" }, { status: 400 });
  }

  const categoria = await prisma.categoria.upsert({
    where: { nombre },
    update: { imagenUrl },
    create: { nombre, imagenUrl },
  });

  return NextResponse.json({ ok: true, categoria });
}
