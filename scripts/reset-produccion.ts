// scripts/reset-produccion.ts
//
// Limpieza de una sola vez antes de arrancar en producción: borra TODOS
// los pedidos (Order, y en cascada sus OrderItem) y todas las fotos de
// comprobantes de pago subidas a Vercel Blob (carpeta "comprobantes/").
// NO toca productos, categorías, clientes registrados ni la configuración
// (tasa de cambio, ganancia, teléfono, etc.).
//
// ⚠️ ES IRREVERSIBLE. Antes de correrlo:
//   1) Asegúrate de que ya no necesitas los pedidos de prueba/pruebas
//      internas (ni como referencia, ni como respaldo).
//   2) Si tienes dudas, haz un respaldo de la base de datos primero
//      (por ejemplo, desde el panel de tu proveedor de Postgres).
//
// Uso (desde la raíz del proyecto, con las variables de entorno de
// producción cargadas — DATABASE_URL, DIRECT_URL, BLOB_READ_WRITE_TOKEN):
//
//   npx tsx scripts/reset-produccion.ts --confirmar
//
// Si lo corres sin "--confirmar" solo te muestra cuántos pedidos y
// comprobantes hay, sin borrar nada.

import { PrismaClient } from "@prisma/client";
import { list, del } from "@vercel/blob";

const prisma = new PrismaClient();

const CONFIRMADO = process.argv.includes("--confirmar");

async function borrarComprobantesDeBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log(
      "⚠️  No hay BLOB_READ_WRITE_TOKEN configurado: se omite el borrado de fotos de comprobantes en Vercel Blob."
    );
    return 0;
  }

  let borrados = 0;
  let cursor: string | undefined = undefined;

  do {
    const resultado: Awaited<ReturnType<typeof list>> = await list({
      prefix: "comprobantes/",
      cursor,
      limit: 1000
    });
    if (resultado.blobs.length > 0) {
      await del(resultado.blobs.map((b: { url: string }) => b.url));
      borrados += resultado.blobs.length;
    }
    cursor = resultado.cursor;
  } while (cursor);

  return borrados;
}

async function main() {
  const totalPedidos = await prisma.order.count();
  const totalItems = await prisma.orderItem.count();

  const { blobs: comprobantesPreview } = process.env.BLOB_READ_WRITE_TOKEN
    ? await list({ prefix: "comprobantes/", limit: 1000 })
    : { blobs: [] as { url: string }[] };

  console.log("Resumen antes de borrar:");
  console.log(`  Pedidos (Order):        ${totalPedidos}`);
  console.log(`  Líneas de pedido:       ${totalItems}`);
  console.log(`  Fotos de comprobantes:  ${comprobantesPreview.length}`);
  console.log("");

  if (!CONFIRMADO) {
    console.log(
      "No se borró nada (modo vista previa). Corre de nuevo con --confirmar para ejecutar el borrado real:\n"
    );
    console.log("  npx tsx scripts/reset-produccion.ts --confirmar\n");
    return;
  }

  console.log("Borrando fotos de comprobantes de pago en Vercel Blob...");
  const comprobantesBorrados = await borrarComprobantesDeBlob();
  console.log(`  ${comprobantesBorrados} foto(s) de comprobante borrada(s).`);

  console.log("Borrando pedidos (Order + OrderItem en cascada)...");
  const resultado = await prisma.order.deleteMany({});
  console.log(`  ${resultado.count} pedido(s) borrado(s).`);

  console.log("\n✅ Listo. La base de datos de pedidos quedó limpia para arrancar en producción.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
