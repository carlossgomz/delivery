import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPosSyncAuthed } from "@/lib/auth";

// Pedidos ya entregados que el POS todavía no registró como venta. Se
// devuelve "precioUsd" de cada línea tal cual está guardado en OrderItem —
// es el precio BASE del producto, sin el recargo de delivery ($0.10 por
// producto, Config.ganancia): ese recargo solo se aplica al calcular el
// total que ve el cliente (ver lib/precio.ts), nunca se guarda en la
// línea. El POS puede usar este precio directo para registrar la venta
// "real", sin tener que restar nada.
export async function GET(req: NextRequest) {
  if (!isPosSyncAuthed(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pedidos = await prisma.order.findMany({
    where: { estado: "ENTREGADO", importadoPos: false },
    include: {
      items: {
        include: { product: { select: { codigo: true, nombre: true } } }
      }
    },
    orderBy: { entregadoAt: "asc" }
  });

  return NextResponse.json({
    pedidos: pedidos.map((p) => ({
      id: p.id,
      clienteNombre: p.clienteNombre,
      direccion: p.direccion,
      tasaCambio: p.tasaCambio,
      totalUsd: p.totalUsd,
      totalBs: p.totalBs,
      entregadoAt: p.entregadoAt,
      items: p.items
        .filter((it) => it.disponible !== false)
        .map((it) => ({
          codigo: it.product.codigo,
          nombre: it.product.nombre,
          cantidad: it.cantidad,
          precioUsd: it.precioUsd
        }))
    }))
  });
}
