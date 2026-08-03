import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

// Exporta TODOS los productos que hay hoy en la base de datos a un archivo
// JSON, para poder compararlos (por ejemplo contra un Excel de precios)
// sin tener que conectarse directo a la base de datos.
//
// Uso: npx tsx scripts/exportarProductos.ts
// Genera: productosActuales.json (en la raíz del proyecto)

async function main() {
    const productos = await prisma.product.findMany({
        select: {
            codigo: true,
            nombre: true,
            precioUsd: true,
            categoria: true,
            activo: true,
            imagenUrl: true,
        },
        orderBy: { nombre: "asc" },
    });

    fs.writeFileSync("productosActuales.json", JSON.stringify(productos, null, 2), "utf-8");

    console.log(`✓ Exportados ${productos.length} productos a productosActuales.json`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());