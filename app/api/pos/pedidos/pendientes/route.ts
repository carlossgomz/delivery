import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPosSyncAuthed } from "@/lib/auth";

// El POS consulta esto cada ~30s para mostrar un aviso en su encabezado —
// "PENDIENTE_VERIFICACION" es específicamente el pedido recién llegado que
// todavía nadie del staff de delivery revisó (no cuenta pedidos que ya
// están en curso, esos ya los está atendiendo alguien).
export async function GET(req: NextRequest) {
  if (!isPosSyncAuthed(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pedidos = await prisma.order.findMany({
    where: { estado: "PENDIENTE_VERIFICACION" },
    select: { id: true, clienteNombre: true, direccion: true, createdAt: true },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({ total: pedidos.length, pedidos });
}
