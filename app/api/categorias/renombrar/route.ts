import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Como las categorías no son una tabla propia (son solo un texto libre en
// cada Product), "editar una categoría" significa renombrarla en todos los
// productos que la tengan asignada de una sola vez, en vez de tener que
// editar producto por producto (o borrar y volver a cargar, como antes).
export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const anterior = typeof body.anterior === "string" ? body.anterior.trim() : "";
  const nueva = typeof body.nueva === "string" ? body.nueva.trim() : "";

  if (!anterior || !nueva) {
    return NextResponse.json({ error: "Falta el nombre anterior o el nuevo" }, { status: 400 });
  }

  if (anterior === nueva) {
    return NextResponse.json({ ok: true, actualizados: 0 });
  }

  const resultado = await prisma.product.updateMany({
    where: { categoria: anterior },
    data: { categoria: nueva }
  });

  return NextResponse.json({ ok: true, actualizados: resultado.count });
}
