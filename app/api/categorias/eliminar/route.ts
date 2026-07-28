import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Elimina una categoría completa. Como nunca se borra un producto que ya
// fue pedido (rompería el historial de esos pedidos), esta ruta separa los
// productos de la categoría en dos grupos:
// - Los que NUNCA aparecieron en un pedido: se borran de verdad.
// - Los que sí tienen pedidos asociados: se dejan, pero se marcan "sin
//   stock" (activo = false), así dejan de poder pedirse aunque el
//   historial de esos pedidos siga intacto.
// La imagen asignada a la categoría (si tenía) también se borra.
export async function POST(req: NextRequest) {
    if (!isAdminAuthed()) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";

    if (!nombre) {
        return NextResponse.json({ error: "Falta el nombre de la categoría" }, { status: 400 });
    }

    const productos = await prisma.product.findMany({
        where: { categoria: nombre },
        select: { id: true }
    });
    const ids = productos.map((p) => p.id);

    let eliminados = 0;
    let desactivados = 0;

    if (ids.length > 0) {
        const conPedidos = await prisma.orderItem.findMany({
            where: { productId: { in: ids } },
            select: { productId: true },
            distinct: ["productId"]
        });
        const idsConPedidos = new Set(conPedidos.map((o) => o.productId));
        const idsSinPedidos = ids.filter((id) => !idsConPedidos.has(id));

        if (idsSinPedidos.length > 0) {
            const resultado = await prisma.product.deleteMany({ where: { id: { in: idsSinPedidos } } });
            eliminados = resultado.count;
        }
        if (idsConPedidos.size > 0) {
            const resultado = await prisma.product.updateMany({
                where: { id: { in: Array.from(idsConPedidos) } },
                data: { activo: false }
            });
            desactivados = resultado.count;
        }
    }

    // Tabla aparte, con SQL crudo: ver /api/categorias/imagen para el motivo.
    await prisma.$executeRaw`DELETE FROM "Categoria" WHERE "nombre" = ${nombre}`;

    return NextResponse.json({ ok: true, eliminados, desactivados });
}