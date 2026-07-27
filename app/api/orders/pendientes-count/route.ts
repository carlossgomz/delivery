import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Estados en los que un pedido necesita que el personal haga algo ya
// (verificar stock recién llegado, o revisar un comprobante de pago que
// mandó el cliente). Se usa para la burbuja de "Pedidos" en la barra de
// navegación del admin y para las alertas de sonido/notificación.
const ESTADOS_PENDIENTES = ["PENDIENTE_VERIFICACION", "PAGO_RECIBIDO", "PAGO_EN_REVISION"];

export async function GET() {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const items = await prisma.order.findMany({
    where: { estado: { in: ESTADOS_PENDIENTES } },
    select: { id: true, clienteNombre: true, estado: true },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ count: items.length, items });
}
