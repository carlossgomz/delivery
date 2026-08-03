import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed, isDuenoAuthed, getClienteIdFromSession } from "@/lib/auth";
import { emitirEventoPedido } from "@/lib/orderEvents";
import { notificarClientePorChat } from "@/lib/chatNotify";
import { formatCantidad } from "@/lib/peso";
import { totalBsLinea } from "@/lib/precio";

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

  // 0) El cliente cancela su propio pedido (para agregar más artículos o
  // porque ya no lo quiere) mientras todavía no ha enviado el pago. No
  // requiere sesión de admin, pero solo funciona en los estados previos al
  // pago para no permitir cancelar algo ya confirmado por la tienda.
  if (body.action === "cancelar_cliente") {
    const existente = await prisma.order.findUnique({ where: { id: params.id } });
    if (!existente) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const cancelablePorCliente = ["PENDIENTE_VERIFICACION", "ESPERANDO_PAGO"].includes(existente.estado);
    if (!cancelablePorCliente) {
      return NextResponse.json(
        { error: "Este pedido ya no se puede cancelar desde aquí" },
        { status: 400 }
      );
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data: { estado: "CANCELADO" },
      include: { items: { include: { product: true } } }
    });

    await emitirEventoPedido("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  // 0.5) El cliente elige pagar después (crédito autorizado por la tienda)
  // en vez de subir comprobante ya mismo. No requiere sesión de admin,
  // pero sí que el pedido sea del cliente logueado y que la tienda le haya
  // habilitado el crédito de antemano — nunca se confía en un flag que
  // mande el propio navegador para esto.
  if (body.action === "usar_credito") {
    const clienteId = getClienteIdFromSession();
    if (!clienteId) {
      return NextResponse.json({ error: "Debes iniciar sesión para usar crédito" }, { status: 401 });
    }

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente || !(cliente as any).creditoAutorizado) {
      return NextResponse.json({ error: "No tienes crédito autorizado por la tienda" }, { status: 403 });
    }

    const existente = await prisma.order.findUnique({ where: { id: params.id } });
    if (!existente || existente.clienteId !== clienteId) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (existente.estado !== "ESPERANDO_PAGO") {
      return NextResponse.json({ error: "Este pedido no está listo para pagar" }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data: { estado: "CONFIRMADO", esCredito: true, creditoPagado: false } as any,
      include: { items: { include: { product: true } } }
    });

    await emitirEventoPedido("pedido_actualizado", order);
    return NextResponse.json({ order });
  }
  // 0.6) El cliente confirma que ya recibió su pedido (solo disponible
  // mientras está "En camino"). Es la otra mitad de la confirmación de
  // entrega: la tienda también puede marcarlo "Entregado" directo desde el
  // admin (paso 6 más abajo) — cualquiera de las dos formas llega al mismo
  // estado final.
  if (body.action === "confirmar_recibido") {
    const existente = await prisma.order.findUnique({ where: { id: params.id } });
    if (!existente) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (existente.estado !== "EN_CAMINO") {
      return NextResponse.json(
        { error: "Este pedido todavía no está en camino, no se puede confirmar la recepción" },
        { status: 400 }
      );
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data: { estado: "ENTREGADO", entregadoAt: new Date() },
      include: { items: { include: { product: true } } }
    });

    await emitirEventoPedido("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  // 0.7) El dueño cancela un pedido en cualquier momento, sin importar en
  // qué estado esté (a diferencia de "cancelar_cliente", que solo funciona
  // antes de pagar). Es una acción propia del rol "admin" — el empleado de
  // delivery no la ve ni puede usarla, para no cancelar pedidos por error.
  if (body.action === "cancelar_pedido_dueno") {
    if (!isDuenoAuthed()) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const existente = await prisma.order.findUnique({ where: { id: params.id } });
    if (!existente) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data: { estado: "CANCELADO" },
      include: { items: { include: { product: true } } }
    });

    await emitirEventoPedido("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  const esEstadoAdmin = ["CONFIRMADO", "EN_PREPARACION", "EN_CAMINO", "ENTREGADO", "CANCELADO", "ESPERANDO_PAGO"].includes(body.estado);

  const tieneCamposCliente =
    body.comprobanteUrl !== undefined ||
    body.comprobante !== undefined ||
    body.notaPago !== undefined ||
    body.nota !== undefined ||
    body.referencia !== undefined ||
    body.estado === "PAGO_RECIBIDO" ||
    body.estado === "PAGO_EN_REVISION";

  if (!esEstadoAdmin && tieneCamposCliente) {
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

    await emitirEventoPedido("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  // 2) De aquí en adelante REQUIERE sesión de admin.
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 3) El personal marca disponible/no disponible producto por producto, y
  // opcionalmente corrige la cantidad real (ej. pidieron 3 mayonesas y solo
  // hay 1, o pidieron 200g de queso y al pesar salieron 220g). La primera
  // vez que se ajusta, se guarda la cantidad que el cliente pidió
  // originalmente en "cantidadOriginal" para poder mostrarle el cambio; si
  // se vuelve a ajustar antes de confirmar, esa cantidad original no se
  // pisa (siempre refleja lo que el cliente pidió de entrada).
  if (body.items) {
    const idsRecibidos = (body.items as { id: string }[]).map((it) => it.id);
    const existentes = await prisma.orderItem.findMany({ where: { id: { in: idsRecibidos } } });

    for (const it of body.items as {
      id: string;
      disponible: boolean;
      cantidad?: number;
    }[]) {
      const actual = existentes.find((e) => e.id === it.id);
      const data: Record<string, unknown> = { disponible: it.disponible };

      // Para líneas vendidoPorUnidad = true (ej. "3 tomates"), esto es
      // donde la tienda confirma el PESO REAL (en kg, aunque en la
      // pantalla del admin se escriba/vea en gramos) — reemplaza el peso
      // estimado con el que se calculó al crear el pedido. Mismo mecanismo
      // que para cualquier producto por peso: no hace falta un campo aparte.
      if (
        actual &&
        typeof it.cantidad === "number" &&
        it.cantidad > 0 &&
        it.cantidad !== actual.cantidad
      ) {
        data.cantidadOriginal = (actual as any).cantidadOriginal ?? actual.cantidad;
        data.cantidad = it.cantidad;
      }

      await prisma.orderItem.update({ where: { id: it.id }, data: data as any });
    }
    return NextResponse.json({ ok: true });
  }

  // 4) El personal confirma la verificación de stock.
  if (body.action === "confirmar_disponibilidad") {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: true } } }
    });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

    const disponibles = order.items.filter((i) => i.disponible);
    const totalUsd = disponibles.reduce((sum, i) => sum + i.precioUsd * i.cantidad, 0);
    // La ganancia se suma por producto antes de convertir a Bs (ver
    // lib/precio.ts), por eso el total en Bs no sale de totalUsd * tasa
    // directo, sino sumando línea por línea con la ganancia ya incluida.
    // Excepción: una línea pedida "por unidad" de un producto híbrido (ej.
    // "3 tomates") suma la ganancia UNA sola vez por línea, no por kilo.
    const config = await prisma.config.upsert({ where: { id: 1 }, update: {}, create: { id: 1, tasaCambio: 1 } });
    const totalBs = disponibles.reduce(
      (sum, i) => sum + totalBsLinea(i.precioUsd, config.ganancia, order.tasaCambio, i.cantidad, i.vendidoPorUnidad),
      0
    );

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: {
        totalUsd,
        totalBs,
        estado: disponibles.length > 0 ? "ESPERANDO_PAGO" : "CANCELADO"
      },
      include: { items: { include: { product: true } } }
    });

    await emitirEventoPedido("pedido_actualizado", updated);

    // Aviso por chat si hubo ajustes de cantidad/peso: el cliente lo ve la
    // próxima vez que abra "Contacto", y además la propia pantalla de
    // checkout/pedidos ya le muestra el cambio para que lo confirme antes
    // de pagar. Solo aplica a cuentas registradas (ver notificarClientePorChat).
    const itemsAjustados = disponibles.filter((i: any) => i.cantidadOriginal != null);
    if (updated.clienteId && itemsAjustados.length > 0) {
      const detalle = itemsAjustados
        .map(
          (i: any) =>
            `${i.product.nombre}: pediste ${formatCantidad(i.cantidadOriginal, i.product.porPeso)}, quedó en ${formatCantidad(i.cantidad, i.product.porPeso)}`
        )
        .join(" · ");
      await notificarClientePorChat(
        updated.clienteId,
        `📝 Ajustamos tu pedido según el stock real disponible: ${detalle}. Revisa el detalle antes de pagar.`
      );
    }

    return NextResponse.json({ order: updated });
  }

  // 5) Rechazar comprobante explícitamente desde el Admin
  if (body.action === "rechazar_pago") {
    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        estado: "ESPERANDO_PAGO",
        comprobanteUrl: null,
        notaPago: null
      },
      include: { items: { include: { product: true } } }
    });

    await emitirEventoPedido("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  // 5.5) La tienda marca un pedido a crédito como ya cobrado (solo lleva
  // registro de la deuda; no cambia el estado de preparación/entrega).
  if (body.action === "marcar_credito_pagado") {
    const order = await prisma.order.update({
      where: { id: params.id },
      data: { creditoPagado: true } as any,
      include: { items: { include: { product: true } } }
    });

    await emitirEventoPedido("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  // 6) Cambios de estado directos desde el admin (Aprobar pago -> CONFIRMADO, EN_PREPARACION, etc.)
  if (body.estado) {
    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        estado: body.estado,
        // Se guarda la primera vez que el pedido llega a "ENTREGADO", para
        // el cronómetro de tiempo de entrega en /admin/pedidos.
        ...(body.estado === "ENTREGADO" ? { entregadoAt: new Date() } : {})
      },
      include: { items: { include: { product: true } } }
    });

    await emitirEventoPedido("pedido_actualizado", order);
    return NextResponse.json({ order });
  }

  return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
}

// Elimina un pedido definitivamente (junto con sus items, por la cascada
// en Prisma). Es una acción propia del dueño ("admin"): borra el historial
// del pedido, así que el empleado de delivery no tiene acceso — para eso
// existe cancelar, que conserva el registro. Funciona en cualquier estado,
// sin restricción.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isDuenoAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const existente = await prisma.order.findUnique({ where: { id: params.id } });
  if (!existente) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  await prisma.order.delete({ where: { id: params.id } });

  await emitirEventoPedido("pedido_eliminado", { id: params.id });
  return NextResponse.json({ ok: true });
}