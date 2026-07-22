import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { orderEvents } from "@/lib/orderEvents";

// El cliente crea el pedido ANTES de pagar. El estado arranca en
// PENDIENTE_VERIFICACION hasta que el personal de tienda marca
// disponibilidad producto por producto.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clienteNombre, clienteTelefono, direccion, items } = body as {
    clienteNombre: string;
    clienteTelefono: string;
    direccion: string;
    items: { productId: string; cantidad: number }[];
  };

  if (!clienteNombre || !clienteTelefono || !direccion || !items?.length) {
    return NextResponse.json({ error: "Faltan datos del pedido" }, { status: 400 });
  }

  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1 }
  });

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } }
  });

  const order = await prisma.order.create({
    data: {
      clienteNombre,
      clienteTelefono,
      direccion,
      tasaCambio: config.tasaCambio,
      items: {
        create: items.map((i) => {
          const p = products.find((pr) => pr.id === i.productId)!;
          return {
            productId: i.productId,
            cantidad: i.cantidad,
            precioUsd: p.precioUsd
          };
        })
      }
    },
    include: { items: { include: { product: true } } }
  });

  orderEvents.emit("nuevo_pedido", order);

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