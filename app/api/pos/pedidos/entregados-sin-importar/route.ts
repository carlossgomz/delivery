import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPosSyncAuthed } from "@/lib/auth";
import { totalBsLinea } from "@/lib/precio";

// Pedidos ya entregados que el POS todavía no registró como venta. Cada
// línea trae "totalBsLinea": el monto en bolívares YA CON el recargo de
// delivery ($0.10 por producto, Config.ganancia) incluido — el mismo
// cálculo que usa confirmar_disponibilidad para fijar Order.totalBs (ver
// lib/precio.ts::totalBsLinea). El POS necesita el monto CON recargo, no
// el precio base del producto: ese $0.10 sí es dinero real que entró por
// pago móvil y tiene que cuadrar en la caja, aunque no sea ganancia del
// producto en sí.
export async function GET(req: NextRequest) {
  if (!isPosSyncAuthed(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const config = await prisma.config.upsert({ where: { id: 1 }, update: {}, create: { id: 1, tasaCambio: 1 } });

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
          totalBsLinea: totalBsLinea(it.precioUsd, config.ganancia, p.tasaCambio, it.cantidad, it.vendidoPorUnidad)
        }))
    }))
  });
}
