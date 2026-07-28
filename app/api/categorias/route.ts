import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Devuelve todas las categorías que existen hoy (según los productos) junto
// con su imagen representativa si tiene una asignada. Las categorías sin
// fila propia en "Categoria" (todavía nadie les puso foto) se devuelven
// igual, con imagenUrl: null, para que el catálogo sepa mostrarles el
// ícono genérico mientras tanto.
export async function GET() {
  const categoriasDeProductos = await prisma.product.findMany({
    select: { categoria: true },
    distinct: ["categoria"]
  });
  const nombres = categoriasDeProductos.map((p) => p.categoria);

  // Tabla aparte, consultada con SQL crudo: así esta ruta funciona incluso
  // antes de regenerar el cliente de Prisma después de la migración.
  const filas = await prisma.$queryRaw<{ nombre: string; imagenUrl: string | null }[]>`
    SELECT "nombre", "imagenUrl" FROM "Categoria"
  `;
  const imagenPorNombre = new Map(filas.map((f) => [f.nombre, f.imagenUrl]));

  const categorias = nombres.map((nombre) => ({
    nombre,
    imagenUrl: imagenPorNombre.get(nombre) ?? null
  }));

  return NextResponse.json({ categorias });
}
