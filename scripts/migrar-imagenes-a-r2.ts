import { PrismaClient } from "@prisma/client";
import { subirImagenR2 } from "../lib/r2";

const prisma = new PrismaClient();

// Migra las fotos de producto que HOY están en Vercel Blob hacia
// Cloudflare R2 (y de paso las redimensiona/comprime a 800x800 máx, igual
// que las nuevas). No borra nada de Blob — solo lee de ahí, sube la copia
// a R2, y actualiza imagenUrl en la base de datos para que apunte a R2.
//
// Requiere que las fotos en Blob sean accesibles en este momento (si tu
// cupo de Blob está agotado, primero actives la prueba/plan Pro).
//
// Uso: npx tsx scripts/migrar-imagenes-a-r2.ts

async function main() {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
        console.error("❌ Faltan variables de entorno de Cloudflare R2 en tu .env.");
        process.exit(1);
    }

    const productos = await prisma.product.findMany({
        where: { imagenUrl: { not: null } },
    });

    console.log(`Productos con imagen: ${productos.length}\n`);

    let migrados = 0;
    let saltados = 0;
    let fallidos = 0;
    const conError: string[] = [];

    for (const producto of productos) {
        const url = producto.imagenUrl!;

        // Si ya apunta a R2 (o a tu dominio propio más adelante), no hay
        // nada que migrar — así el script se puede correr varias veces
        // sin re-procesar lo que ya está movido.
        if (url.includes(".r2.dev") || (process.env.R2_PUBLIC_URL && url.startsWith(process.env.R2_PUBLIC_URL))) {
            saltados++;
            continue;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} al descargar desde Blob`);
            }
            const buffer = Buffer.from(await res.arrayBuffer());

            const key = `productos/producto-${producto.id}.jpg`;
            const nuevaUrl = await subirImagenR2(buffer, key);

            await prisma.product.update({
                where: { id: producto.id },
                data: { imagenUrl: nuevaUrl },
            });

            migrados++;
            console.log(`✓ Migrada: ${producto.nombre}`);
        } catch (e: any) {
            fallidos++;
            conError.push(producto.nombre);
            console.log(`⚠ Error migrando "${producto.nombre}": ${e.message || e}`);
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log("¡Migración finalizada!");
    console.log(`✓ Migradas a R2: ${migrados}`);
    console.log(`↷ Ya estaban en R2 (saltadas): ${saltados}`);
    console.log(`✗ Con error: ${fallidos}`);
    console.log("=".repeat(50));

    if (conError.length > 0) {
        console.log("\nProductos que fallaron (probablemente Blob todavía bloqueado — reintenta luego):");
        conError.forEach((n) => console.log(" - " + n));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
