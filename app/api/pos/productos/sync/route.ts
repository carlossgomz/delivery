import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPosSyncAuthed } from "@/lib/auth";
import { redondearPrecio } from "@/lib/precio";

// El POS de la tienda empuja acá su catálogo completo cada pocos minutos
// (y también cuando el admin toca "sincronizar ahora"). Es la fuente de
// verdad de nombre/precio/categoría/disponibilidad-para-delivery de cada
// producto — este endpoint solo hace upsert por "codigo" (el mismo código
// de barra del POS). Deliberadamente NO toca "activo": ese sigue siendo el
// interruptor manual de "hay/no hay stock ahora mismo" que opera el staff
// de delivery en su propio panel (el POS no controla eso todavía).
type ProductoSync = {
  codigo: string;
  nombre: string;
  precioUsd: number;
  categoria: string;
  disponibleDelivery: boolean;
};

export async function POST(req: NextRequest) {
  if (!isPosSyncAuthed(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const productos: ProductoSync[] = Array.isArray(body.productos) ? body.productos : [];
  if (productos.length === 0) {
    return NextResponse.json({ error: "Falta el arreglo \"productos\"." }, { status: 400 });
  }

  const validos = productos.filter((p) => p.codigo && p.nombre);

  function upsert(p: ProductoSync) {
    return prisma.product.upsert({
      where: { codigo: p.codigo },
      update: {
        nombre: p.nombre,
        precioUsd: redondearPrecio(Number(p.precioUsd) || 0),
        categoria: p.categoria || "Sin categoría",
        disponibleDelivery: Boolean(p.disponibleDelivery)
      },
      create: {
        codigo: p.codigo,
        nombre: p.nombre,
        precioUsd: redondearPrecio(Number(p.precioUsd) || 0),
        categoria: p.categoria || "Sin categoría",
        disponibleDelivery: Boolean(p.disponibleDelivery)
      }
    });
  }

  // Cada producto es independiente (no hace falta que los ~600 upserts
  // sean una sola transacción atómica — si uno falla, se autocorrige solo
  // en el próximo ciclo de sincronización), así que se procesan en
  // paralelo con un límite de concurrencia en vez de un $transaction
  // secuencial: con 597 productos, secuencial tardaba MÁS DE UN MINUTO y
  // medio (cada upsert es un viaje de ida y vuelta a Supabase); en
  // paralelo (acotado para no agotar el pool de conexiones de pgbouncer)
  // baja a unos pocos segundos.
  // El pool de conexiones de Prisma contra Supabase (pgbouncer) es chico
  // (connection_limit por defecto ronda 13) y lo comparte con la otra
  // tarea de fondo del POS (revisar pedidos) — pasarse de esa cantidad
  // hace que Prisma tire "Timed out fetching a new connection" (P2024) en
  // vez de ir más rápido.
  const CONCURRENCIA = 8;
  let cursor = 0;
  async function trabajador() {
    while (cursor < validos.length) {
      const p = validos[cursor++];
      await upsert(p);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, validos.length) }, trabajador));

  return NextResponse.json({ actualizados: validos.length });
}
