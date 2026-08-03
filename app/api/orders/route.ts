import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed, getClienteIdFromSession } from "@/lib/auth";
import { emitirEventoPedido } from "@/lib/orderEvents";

// El cliente crea el pedido ANTES de pagar. El estado arranca en
// PENDIENTE_VERIFICACION hasta que el personal de tienda marca
// disponibilidad producto por producto.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clienteNombre, clienteTelefono, direccion, items } = body as {
    clienteNombre: string;
    clienteTelefono: string;
    direccion: string;
    items: { productId: string; cantidad: number; vendidoPorUnidad?: boolean }[];
  };

  if (!clienteNombre || !clienteTelefono || !direccion || !items?.length) {
    return NextResponse.json({ error: "Faltan datos del pedido" }, { status: 400 });
  }

  // Si el navegador trae una sesión de cliente válida, el pedido queda
  // enlazado a su cuenta para que aparezca en su historial. Esto se lee de
  // la cookie del servidor, no de lo que mande el body, para que nadie
  // pueda "regalarle" un pedido a otra cuenta.
  const sessionClienteId = getClienteIdFromSession();
  const clienteId = sessionClienteId
    ? (await prisma.cliente.findUnique({ where: { id: sessionClienteId }, select: { id: true } }))?.id ?? null
    : null;

  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1 }
  });

  // Interruptor del admin: si está cerrado, no se crea el pedido aunque
  // la petición llegue directo a la API (sin pasar por el checkout).
  if (!config.pedidosHabilitados) {
    return NextResponse.json(
      { error: "PEDIDOS_DESHABILITADOS", message: "En estos momentos no estamos atendiendo pedidos." },
      { status: 403 }
    );
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } }
  });

  const order = await prisma.order.create({
    data: {
      clienteNombre,
      clienteTelefono,
      direccion,
      tasaCambio: config.tasaCambio,
      ...(clienteId && { clienteId }),
      items: {
        create: items.map((i) => {
          const p = products.find((pr) => pr.id === i.productId)!;
          // El precio SIEMPRE es por peso (p.precioUsd, precio por kilo) —
          // nunca hay un precio fijo por unidad. Si el producto es híbrido
          // y esta línea se pidió "por unidad" (ej. "3 tomates"), lo que
          // mandó el cliente en "cantidad" es la CANTIDAD DE UNIDADES, no
          // kilos: se convierte a un peso ESTIMADO usando el peso promedio
          // por unidad que cargó la tienda (Product.pesoEstimadoUnidadGramos).
          // Ese estimado es solo para mostrar un precio aproximado — la
          // tienda confirma el peso real al chequear disponibilidad.
          const esPorUnidadHibrida = Boolean(p.porPeso && p.permiteUnidad && i.vendidoPorUnidad);
          const unidadesPedidas = esPorUnidadHibrida ? Math.round(i.cantidad) : null;
          const cantidadKg = esPorUnidadHibrida
            ? (unidadesPedidas! * (p.pesoEstimadoUnidadGramos ?? 0)) / 1000
            : i.cantidad;
          return {
            productId: i.productId,
            cantidad: cantidadKg,
            precioUsd: p.precioUsd,
            vendidoPorUnidad: esPorUnidadHibrida,
            ...(unidadesPedidas != null && { unidadesPedidas })
          };
        })
      }
    },
    include: { items: { include: { product: true } } }
  });

  await emitirEventoPedido("nuevo_pedido", order);

  return NextResponse.json({ order });
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const estado = req.nextUrl.searchParams.get("estado");
  const orders = await prisma.order.findMany({
    where: estado ? { estado: estado as any } : undefined,
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } }
  });
  return NextResponse.json({ orders });
}