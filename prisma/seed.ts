import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      tasaCambio: 40,
      margenPorcentaje: 30
    }
  });

  const productos = [
    { nombre: "Harina de maíz 1kg", costoUsd: 1.2, categoria: "Despensa" },
    { nombre: "Aceite de girasol 1L", costoUsd: 2.5, categoria: "Despensa" },
    { nombre: "Queso blanco 1kg", costoUsd: 4.8, categoria: "Lácteos" },
    { nombre: "Pollo entero", costoUsd: 5.5, categoria: "Carnes" },
    { nombre: "Refresco 2L", costoUsd: 1.8, categoria: "Bebidas" }
  ];

  // Agregamos 'as any[]' al iterar para saltar la validación estricta de TypeScript solo en la siembra
  for (const p of (productos as any[])) {
    await prisma.product.create({
      data: {
        nombre: p.nombre,
        categoria: p.categoria,
        costoUsd: Number(p.costoUsd)
      }
    });
  }

  console.log("Seed completo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());