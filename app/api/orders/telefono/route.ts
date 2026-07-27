import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed, hashPassword } from "@/lib/auth";
import { emitirEventoPedido } from "@/lib/orderEvents";

// Pedido tomado por teléfono por el personal de tienda. Siempre queda
// enlazado a una cuenta de Cliente (identificada por cédula) para no
// perder el registro de esa venta: si la cédula no tiene cuenta todavía,
// se crea una de una vez con los datos que el cliente dio por teléfono.
// Como quien confirma disponibilidad es el propio personal durante la
// llamada, los artículos entran directo como disponibles y con el total
// ya calculado.
export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const {
    cedula,
    nombre,
    telefono,
    direccion,
    password,
    items,
    estadoInicial,
    notas
  } = body as {
    cedula: string;
    nombre?: string;
    telefono?: string;
    direccion?: string;
    password?: string;
    items: { productId: string; cantidad: number }[];
    estadoInicial?: string;
    notas?: string;
  };

  const cedulaLimpia = cedula?.trim();
  if (!cedulaLimpia) {
    return NextResponse.json({ error: "Falta la cédula del cliente" }, { status: 400 });
  }
  if (!items?.length) {
    return NextResponse.json({ error: "El pedido no tiene artículos" }, { status: 400 });
  }

  let cliente = await prisma.cliente.findUnique({ where: { cedula: cedulaLimpia } });
  let claveGenerada: string | null = null;

  if (!cliente) {
    if (!nombre || !telefono || !direccion) {
      return NextResponse.json(
        { error: "Es un cliente nuevo: hacen falta nombre, teléfono y dirección" },
        { status: 400 }
      );
    }
    const claveFinal =
      password && password.length >= 6 ? password : crypto.randomBytes(5).toString("hex");
    if (!password || password.length < 6) claveGenerada = claveFinal;

    cliente = await prisma.cliente.create({
      data: {
        nombre,
        cedula: cedulaLimpia,
        telefono,
        direccion,
        passwordHash: hashPassword(claveFinal)
      }
    });
  }

  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1 }
  });

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } }
  });

  const itemsValidos = items.filter((i) => products.some((p) => p.id === i.productId) && i.cantidad > 0);
  if (!itemsValidos.length) {
    return NextResponse.json({ error: "Ningún artículo del pedido es válido" }, { status: 400 });
  }

  const totalUsd = itemsValidos.reduce((sum, i) => {
    const p = products.find((pr) => pr.id === i.productId)!;
    return sum + p.precioUsd * i.cantidad;
  }, 0);
  const totalBs = totalUsd * config.tasaCambio;

  const estadosPermitidos = ["ESPERANDO_PAGO", "PAGO_EN_REVISION", "CONFIRMADO", "EN_PREPARACION"];
  const estado = estadosPermitidos.includes(estadoInicial ?? "") ? (estadoInicial as string) : "ESPERANDO_PAGO";

  const order = await prisma.order.create({
    data: {
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
      direccion: cliente.direccion,
      tasaCambio: config.tasaCambio,
      totalUsd,
      totalBs,
      estado,
      origen: "LLAMADA",
      notas: notas?.trim() || null,
      clienteId: cliente.id,
      items: {
        create: itemsValidos.map((i) => {
          const p = products.find((pr) => pr.id === i.productId)!;
          return {
            productId: i.productId,
            cantidad: i.cantidad,
            precioUsd: p.precioUsd,
            disponible: true
          };
        })
      }
    },
    include: { items: { include: { product: true } } }
  });

  await emitirEventoPedido("nuevo_pedido", order);

  return NextResponse.json({
    order,
    cliente: { id: cliente.id, nombre: cliente.nombre, cedula: cliente.cedula },
    claveGenerada
  });
}
