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

  // 1) Si el cliente está enviando su comprobante/referencia de pago desde la vista pública:
  const esEstadoAdmin = ["CONFIRMADO", "EN_PREPARACION", "ENTREGADO", "CANCELADO", "ESPERANDO_PAGO"].includes(body.estado);

  if (
    !esEstadoAdmin &&
    (body.comprobanteUrl !== undefined ||
      body.comprobante !== undefined ||
      body.notaPago !== undefined ||
      body.nota !== undefined ||
      body.referencia !== undefined ||
      body.estado === "PAGO_RECIBIDO" ||
      body.estado === "PAGO_EN_REVISION")
  ) {
    const notaGuardar = body.notaPago || body.nota || body.referencia || null;
    const urlComprobante = body.comprobanteUrl || body.comprobante || null;
    const nuevoEstado = body.estado || "PAGO_RECIBIDO";

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        comprobanteUrl: urlComprobante,
        notaPago: notaGuardar,
        estado: nuevoEstado
      },
      include: { items: { include: { product: true } } }
    });

    orderEvents.emit("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  // 2) De aquí en adelante REQUIERE sesión de admin.
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 3) El personal marca disponible/no disponible producto por producto.
  if (body.items) {
    for (const it of body.items as { id: string; disponible: boolean }[]) {
      await prisma.orderItem.update({ where: { id: it.id }, data: { disponible: it.disponible } });
    }
    return NextResponse.json({ ok: true });
  }

  // 4) El personal confirma la verificación de stock.
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
      },
      include: { items: { include: { product: true } } }
    });

    orderEvents.emit("pedido_actualizado", updated);
    return NextResponse.json({ order: updated });
  }

  // 5) Rechazar comprobante explícitamente desde el Admin
  if (body.action === "rechazar_pago") {
    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        estado: "ESPERANDO_PAGO",
        comprobanteUrl: null, // Borra el archivo previo para solicitar uno nuevo al cliente
        notaPago: null
      },
      include: { items: { include: { product: true } } }
    });

    orderEvents.emit("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  // 6) Cambios de estado directos desde el admin (Aprobar pago -> CONFIRMADO, EN_PREPARACION, etc.)
  if (body.estado) {
    const order = await prisma.order.update({
      where: { id: params.id },
      data: { estado: body.estado },
      include: { items: { include: { product: true } } }
    });

    orderEvents.emit("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
}