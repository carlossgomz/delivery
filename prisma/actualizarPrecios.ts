import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Generado comparando prisma/importProductos.ts (precios que ya están en la
// base de datos) contra el Excel "Cuadre_de_Precios" actualizado. Contiene
// SOLO los 39 productos que YA EXISTEN pero cuyo precio de venta
// cambió. No toca nombre, categoria ni codigo — solo actualiza precioUsd.
// "precioAnterior" queda solo de referencia (no se usa ni se guarda), por si
// quieres revisar antes de correrlo.
//
// Uso: npx tsx prisma/actualizarPrecios.ts
const cambios = [
    { codigo: "1000000000030", nombre: "ALAS DE POLLO X KILO", precioAnterior: 0.0, precioNuevo: 6.0 },
    { codigo: "1000000000032", nombre: "ALIVE DETERGENTE LIMON 1KILO.", precioAnterior: 0.0, precioNuevo: 3.57 },
    { codigo: "7599450000362", nombre: "AMANECER ARROZ TRADICIONAL 900GRS.", precioAnterior: 1.56, precioNuevo: 1.32 },
    { codigo: "75903183", nombre: "BELMON CIGARRO 1/2 CAJA 10UND.", precioAnterior: 1.7, precioNuevo: 1.69 },
    { codigo: "175903169", nombre: "BELMON CIGARRO DETALLADO X UND.", precioAnterior: 0.26, precioNuevo: 0.19 },
    { codigo: "6935787900134", nombre: "BOMBILLO LED BRILLALUZ 30W LUZ BLANCA", precioAnterior: 2.86, precioNuevo: 2.43 },
    { codigo: "6935787900189", nombre: "BOMBILLO LED BRILLALUZ 40W LUZ BLANCA", precioAnterior: 3.29, precioNuevo: 2.71 },
    { codigo: "7595012766301", nombre: "BOMBILLO LED NALY 30W LUZ BLANCA", precioAnterior: 2.86, precioNuevo: 2.43 },
    { codigo: "7595461000292", nombre: "CAFE FAVORITO 100GRS.", precioAnterior: 1.64, precioNuevo: 1.62 },
    { codigo: "7591127123527", nombre: "COCA-COLA ORIGINAL 1.5LTS. PET.", precioAnterior: 1.54, precioNuevo: 1.55 },
    { codigo: "7591127123626", nombre: "COCA-COLA ORIGINAL 2LTS. PET.", precioAnterior: 2.2, precioNuevo: 1.91 },
    { codigo: "75903206", nombre: "CONSUL CIGARRO CAJA 20UND.", precioAnterior: 1.8, precioNuevo: 1.76 },
    { codigo: "175903206", nombre: "CONSUL CIGARRO DETALLADO X UND.", precioAnterior: 0.14, precioNuevo: 0.1 },
    { codigo: "7590011890910", nombre: "GALLETA BELVITA HONY PAQUETE 9 UND. NABISCO", precioAnterior: 3.9, precioNuevo: 3.89 },
    { codigo: "7590011890866", nombre: "GALLETA BELVITA KRAKER PAQUETE 9 UND. NABISCO", precioAnterior: 3.9, precioNuevo: 3.89 },
    { codigo: "7591002200152", nombre: "HARINA P.A.N. MAIZ AMARILLO 1KILO", precioAnterior: 1.96, precioNuevo: 1.78 },
    { codigo: "7591002200145", nombre: "HARINA P.A.N. MAIZ BLANCO 1KILO", precioAnterior: 1.96, precioNuevo: 1.81 },
    { codigo: "7591002200046", nombre: "HARINA P.A.N. MAIZ Y ARROZ BLANCO 1KILO", precioAnterior: 1.76, precioNuevo: 1.69 },
    { codigo: "17591084901633", nombre: "LUCKY STRIKE COSMIC CIGARRO DETALLADO X UND.", precioAnterior: 0.32, precioNuevo: 0.23 },
    { codigo: "17591084901626", nombre: "LUCKY STRIKE NOVA CIGARRO DETALLADO X UND.", precioAnterior: 0.32, precioNuevo: 0.23 },
    { codigo: "7591016204894", nombre: "MAGGI SOPA DE POLLO CON FIDEOS 62GRS.", precioAnterior: 1.79, precioNuevo: 1.78 },
    { codigo: "7591473005249", nombre: "MARY ARROZ PREMIUM 900GRS.", precioAnterior: 2.46, precioNuevo: 1.47 },
    { codigo: "7591473005355", nombre: "MARY ARROZ SUPERIOR 900GRS.", precioAnterior: 1.74, precioNuevo: 1.2 },
    { codigo: "7591473005041", nombre: "MARY ARVEJAS VERDE PARTIDAS 400GRS.", precioAnterior: 0.0, precioNuevo: 1.86 },
    { codigo: "7591473005003", nombre: "MARY CARAOTAS NEGRAS 400GRS.", precioAnterior: 1.54, precioNuevo: 1.36 },
    { codigo: "7591473005393", nombre: "MARY HARINA DE MAIZ BLANCO 900GRS.", precioAnterior: 1.57, precioNuevo: 1.31 },
    { codigo: "7597417000691", nombre: "MARY HARINA DE TRIGO TODO USO 900GRS.", precioAnterior: 1.7, precioNuevo: 1.19 },
    { codigo: "7597417000394", nombre: "MARY PASTA CORTA DEDAL PREMIUM 500GRS.", precioAnterior: 1.71, precioNuevo: 1.63 },
    { codigo: "1000000000043", nombre: "MUSLO DE POLLO X KILO", precioAnterior: 0.0, precioNuevo: 5.5 },
    { codigo: "7592396006252", nombre: "NATULAC LECHE CONDENSADA 45GRS.", precioAnterior: 0.0, precioNuevo: 1.14 },
    { codigo: "7591221391846", nombre: "OLYMPIA HOJAS DE TORONJIL 12GRS.", precioAnterior: 0.0, precioNuevo: 3.64 },
    { codigo: "6924060310135", nombre: "OSO BLANCO JABON EN PANELA FRAGANCIA BEBE 200GRS.", precioAnterior: 0.0, precioNuevo: 1.43 },
    { codigo: "7599158000183", nombre: "OSO BLANCO LAVAPLATOS LIQUIDO LIMON 200ML.", precioAnterior: 0.99, precioNuevo: 0.96 },
    { codigo: "1000000000044", nombre: "POLLO PICADO X KILO", precioAnterior: 0.0, precioNuevo: 5.5 },
    { codigo: "1000000000019", nombre: "QUESO BLANCO DURO", precioAnterior: 5.0, precioNuevo: 4.87 },
    { codigo: "1000000000047", nombre: "TERETERE DE POLLO X KILO", precioAnterior: 0.0, precioNuevo: 3.0 },
    { codigo: "1000000000027", nombre: "VEGETAL PIMENTON ROJO", precioAnterior: 3.43, precioNuevo: 3.42 },
    { codigo: "1000000000021", nombre: "VEGETAL PIMENTON VERDE", precioAnterior: 2.64, precioNuevo: 2.57 },
    { codigo: "1000000000022", nombre: "VEGETAL REMOLACHA", precioAnterior: 1.21, precioNuevo: 1.15 },
];

async function main() {
    let actualizados = 0;
    let noEncontrados = 0;

    for (const c of cambios) {
        const existente = await prisma.product.findFirst({ where: { codigo: c.codigo } });
        if (!existente) {
            console.log(`No encontrado (se omite): ${c.nombre}`);
            noEncontrados++;
            continue;
        }
        await prisma.product.update({
            where: { id: existente.id },
            data: { precioUsd: c.precioNuevo }
        });
        console.log(`${c.nombre}: $${c.precioAnterior} -> $${c.precioNuevo}`);
        actualizados++;
    }

    console.log(`\nActualizacion completa: ${actualizados} producto(s) actualizado(s), ${noEncontrados} no encontrado(s).`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
