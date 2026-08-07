import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPosSyncAuthed } from "@/lib/auth";

// El POS llama esto ANTES de crear la venta local, como un "reclamo"
// atómico: si updateMany afecta 0 filas es porque otra PC del POS ya lo
// importó primero (o el pedido no existe/no está en el estado esperado),
// así que el POS debe descartarlo y no crear una venta duplicada.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isPosSyncAuthed(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await prisma.order.updateMany({
    where: { id: params.id, estado: "ENTREGADO", importadoPos: false },
    data: { importadoPos: true }
  });

  if (resultado.count === 0) {
    return NextResponse.json({ reclamado: false }, { status: 409 });
  }

  return NextResponse.json({ reclamado: true });
}
