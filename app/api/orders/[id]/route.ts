import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { orderEvents } from "@/lib/orderEvents";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: { include: { product: true } } }
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();

  // 1) El cliente sube su comprobante O su nota/referencia de pago (no requiere sesión de admin,
  //    solo conocer el id del pedido, que es un identificador largo y único).
  if (body.comprobanteUrl || body.notaPago || body.nota || body.referencia) {
    const notaGuardar = body.notaPago || body.nota || body.referencia;

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        ...(body.comprobanteUrl && { comprobanteUrl: body.comprobanteUrl }),
        ...(notaGuardar && { notaPago: notaGuardar }),
        estado: "PAGO_EN_REVISION"
      }
    });
    orderEvents.emit("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  // Todo lo demás (marcar disponibilidad, confirmar pago, cambiar estado)
  // lo hace el personal de tienda desde /admin.
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2) El personal marca disponible/no disponible producto por producto.
  if (body.items) {
    for (const it of body.items as { id: string; disponible: boolean }[]) {
      await prisma.orderItem.update({ where: { id: it.id }, data: { disponible: it.disponible } });
    }
    return NextResponse.json({ ok: true });
  }

  // 3) El personal confirma la verificación: calcula el total solo con lo
  //    disponible, y pasa el pedido a ESPERANDO_PAGO (o lo cancela si nada
  //    quedó disponible).
  if (body.action === "confirmar_disponibilidad") {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true }
    });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

    const disponibles = order.items.filter((i) => i.disponible);
    const totalUsd = disponibles.reduce((sum, i) => sum + i.precioUsd * i.cantidad, 0);
    const totalBs = totalUsd * order.tasaCambio;

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: {
        totalUsd,
        totalBs,
        estado: disponibles.length > 0 ? "ESPERANDO_PAGO" : "CANCELADO"
      }
    });
    orderEvents.emit("pedido_actualizado", updated);
    return NextResponse.json({ order: updated });
  }

  // 4) Cambios de estado directos (confirmar pago, pasar a preparación, entregado, cancelar).
  if (body.estado) {
    const order = await prisma.order.update({
      where: { id: params.id },
      data: { estado: body.estado }
    });
    orderEvents.emit("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
}