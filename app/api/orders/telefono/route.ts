import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed, hashPassword } from "@/lib/auth";
import { emitirEventoPedido } from "@/lib/orderEvents";
import { totalBsLinea } from "@/lib/precio";

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
    items: { productId: string; cantidad: number; vendidoPorUnidad?: boolean }[];
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

  // El precio SIEMPRE es por peso (p.precioUsd, precio por kilo). Si el
  // producto es híbrido y el artículo se marcó "por unidad", lo que llega
  // en "cantidad" es la CANTIDAD DE UNIDADES, no kilos: se convierte a un
  // peso estimado con el peso promedio por unidad que cargó la tienda.
  function cantidadKgEfectiva(p: (typeof products)[number], cantidad: number, vendidoPorUnidad?: boolean) {
    const esPorUnidadHibrida = Boolean(p.porPeso && p.permiteUnidad && vendidoPorUnidad);
    if (!esPorUnidadHibrida) return cantidad;
    return (Math.round(cantidad) * (p.pesoEstimadoUnidadGramos ?? 0)) / 1000;
  }

  const totalUsd = itemsValidos.reduce((sum, i) => {
    const p = products.find((pr) => pr.id === i.productId)!;
    return sum + p.precioUsd * cantidadKgEfectiva(p, i.cantidad, i.vendidoPorUnidad);
  }, 0);
  // Igual que en el resto del sitio: la ganancia se suma por producto antes
  // de convertir a Bs (ver lib/precio.ts) — salvo la excepción de un
  // artículo pedido "por unidad" de un producto híbrido (ej. "3 tomates"),
  // donde la ganancia se suma UNA sola vez por línea, no por kilo.
  const totalBs = itemsValidos.reduce((sum, i) => {
    const p = products.find((pr) => pr.id === i.productId)!;
    const esPorUnidadHibrida = Boolean(p.porPeso && p.permiteUnidad && i.vendidoPorUnidad);
    return sum + totalBsLinea(p.precioUsd, config.ganancia, config.tasaCambio, cantidadKgEfectiva(p, i.cantidad, i.vendidoPorUnidad), esPorUnidadHibrida);
  }, 0);

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
          const esPorUnidadHibrida = Boolean(p.porPeso && p.permiteUnidad && i.vendidoPorUnidad);
          return {
            productId: i.productId,
            cantidad: cantidadKgEfectiva(p, i.cantidad, i.vendidoPorUnidad),
            precioUsd: p.precioUsd,
            vendidoPorUnidad: esPorUnidadHibrida,
            ...(esPorUnidadHibrida && { unidadesPedidas: Math.round(i.cantidad) }),
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
