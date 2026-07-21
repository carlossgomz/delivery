import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tasaCambio: 40 }
  });

  const productos = [
    { nombre: "Harina de maíz 1kg", precioUsd: 1.2, categoria: "Despensa" },
    { nombre: "Aceite de girasol 1L", precioUsd: 2.5, categoria: "Despensa" },
    { nombre: "Queso blanco 1kg", precioUsd: 4.8, categoria: "Lácteos" },
    { nombre: "Pollo entero", precioUsd: 5.5, categoria: "Carnes" },
    { nombre: "Refresco 2L", precioUsd: 1.8, categoria: "Bebidas" }
  ];

  for (const p of productos) {
    await prisma.product.create({ data: p });
  }

  console.log("Seed completo");
}

main().finally(() => prisma.$disconnect());
