// scripts/backfill-costo.ts
//
// Migración de una sola vez: copia el precioUsd actual de cada producto
// a costoUsd (con margen 0%), para no perder los precios que ya tenías
// cargados al completar la migración a costo + margen.
//
// Uso: npx tsx scripts/backfill-costo.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();

  for (const p of products as any[]) {
    await prisma.product.update({
      where: { id: p.id },
      data: {
        costoUsd: p.precioUsd,
        margenPorcentaje: 0
      }
    });
    console.log(`${p.nombre}: costoUsd = ${p.precioUsd}`);
  }

  console.log(`\nListo. ${products.length} producto(s) actualizado(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
