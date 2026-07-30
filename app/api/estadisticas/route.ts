import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDuenoAuthed } from "@/lib/auth";

// Estadísticas de ventas para el dueño. Solo rol "admin" (ver
// app/admin/estadisticas y el middleware, que además bloquea la URL
// directa para el empleado de delivery).
export async function GET() {
  if (!isDuenoAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 1 }
  });

  // "Vendido" = pedidos que realmente se ENTREGARON (no pendientes, no
  // cancelados). Es la venta real, no solo lo que el cliente pidió.
  //
  // Los productos que se venden POR PESO (Product.porPeso) cuentan como 1
  // producto vendido por cada línea del pedido, sin importar los kilos
  // exactos (0.5kg de queso = 1 producto, igual que 1 unidad de cualquier
  // otro artículo). Así la ganancia y el conteo de unidades reflejan
  // "cuántas veces se vendió", no el peso.
  const entregados = await prisma.order.findMany({
    where: { estado: "ENTREGADO" },
    include: { items: { include: { product: true } } }
  });

  // --- 1) Productos vendidos + ganancia total ---
  // Solo cuentan los renglones que sí se marcaron disponibles (lo que
  // realmente salió de la tienda).
  let totalUnidadesVendidas = 0;
  const vendidosPorProducto = new Map<string, { nombre: string; unidades: number }>();

  for (const order of entregados) {
    for (const item of order.items) {
      if (item.disponible === false) continue;
      const unidadesLinea = item.product?.porPeso ? 1 : item.cantidad;
      totalUnidadesVendidas += unidadesLinea;

      const key = item.productId;
      const nombre = item.product?.nombre ?? "Producto eliminado";
      const actual = vendidosPorProducto.get(key);
      if (actual) {
        actual.unidades += unidadesLinea;
      } else {
        vendidosPorProducto.set(key, { nombre, unidades: unidadesLinea });
      }
    }
  }

  const gananciaTotalUsd = totalUnidadesVendidas * (config.ganancia || 0);

  // --- 2) Récord de tiempo de entrega ---
  // Entre los pedidos entregados que sí tienen entregadoAt guardado
  // (los marcados como entregados antes de este cambio no lo tendrán).
  const tiempos = entregados
    .filter((o) => o.entregadoAt)
    .map((o) => ({
      orderId: o.id,
      clienteNombre: o.clienteNombre,
      ms: new Date(o.entregadoAt as Date).getTime() - new Date(o.createdAt).getTime()
    }))
    .filter((t) => t.ms >= 0);

  let recordEntrega: { orderId: string; clienteNombre: string; ms: number } | null = null;
  let promedioEntregaMs: number | null = null;
  if (tiempos.length > 0) {
    recordEntrega = tiempos.reduce((mejor, t) => (t.ms < mejor.ms ? t : mejor), tiempos[0]);
    promedioEntregaMs = tiempos.reduce((sum, t) => sum + t.ms, 0) / tiempos.length;
  }

  // --- 3) Tier list de productos más vendidos a menos vendidos ---
  const ranking = Array.from(vendidosPorProducto.entries())
    .map(([productId, v]) => ({ productId, nombre: v.nombre, unidades: v.unidades }))
    .sort((a, b) => b.unidades - a.unidades);

  const maxUnidades = ranking.length > 0 ? ranking[0].unidades : 0;
  function calcularTier(unidades: number): string {
    if (maxUnidades <= 0) return "D";
    const pct = unidades / maxUnidades;
    if (pct >= 0.8) return "S";
    if (pct >= 0.6) return "A";
    if (pct >= 0.4) return "B";
    if (pct >= 0.2) return "C";
    return "D";
  }
  const tierList = ranking.map((r) => ({ ...r, tier: calcularTier(r.unidades) }));

  // --- 4) Clientes frecuentes ---
  // Se cuentan TODOS los pedidos (cualquier estado): mide qué tan seguido
  // pide un cliente, no solo lo que se le llegó a entregar. Se agrupa por
  // teléfono para que también cuenten los pedidos de invitados sin cuenta.
  const todosLosPedidos = await prisma.order.findMany({
    select: { clienteNombre: true, clienteTelefono: true, createdAt: true }
  });

  const porCliente = new Map<string, { nombre: string; telefono: string; pedidos: number; ultimoPedido: Date }>();
  for (const o of todosLosPedidos) {
    const key = o.clienteTelefono;
    const actual = porCliente.get(key);
    if (actual) {
      actual.pedidos += 1;
      actual.nombre = o.clienteNombre; // se queda con el nombre más reciente
      if (o.createdAt > actual.ultimoPedido) actual.ultimoPedido = o.createdAt;
    } else {
      porCliente.set(key, {
        nombre: o.clienteNombre,
        telefono: o.clienteTelefono,
        pedidos: 1,
        ultimoPedido: o.createdAt
      });
    }
  }

  const clientesFrecuentes = Array.from(porCliente.values())
    .sort((a, b) => b.pedidos - a.pedidos)
    .slice(0, 20);

  return NextResponse.json({
    totalUnidadesVendidas,
    gananciaTotalUsd,
    ganancia: config.ganancia,
    recordEntrega,
    promedioEntregaMs,
    tierList,
    clientesFrecuentes
  });
}
