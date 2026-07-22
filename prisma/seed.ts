import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      tasaCambio: 40,
    }
  });

  const productos = [
    { codigo: "PROD-001", nombre: "Harina de maíz 1kg", costoUsd: 1.2, categoria: "Despensa" },
    { codigo: "PROD-002", nombre: "Aceite de girasol 1L", costoUsd: 2.5, categoria: "Despensa" },
    { codigo: "PROD-003", nombre: "Queso blanco 1kg", costoUsd: 4.8, categoria: "Lácteos" },
    { codigo: "PROD-004", nombre: "Pollo entero", costoUsd: 5.5, categoria: "Carnes" },
    { codigo: "PROD-005", nombre: "Refresco 2L", costoUsd: 1.8, categoria: "Bebidas" }
  ];

  for (const p of productos) {
    const existente = await prisma.product.findFirst({
      where: { codigo: p.codigo }
    });

    if (!existente) {
      await prisma.product.create({
        data: {
          codigo: p.codigo,
          nombre: p.nombre,
          categoria: p.categoria,
          costoUsd: Number(p.costoUsd)
        }
      });
    }
  }

  console.log("Seed completo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());