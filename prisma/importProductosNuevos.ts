import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Generado a partir del listado "Cuadre_de_Precios" (hoja LISTADO DE PRODUCTOS),
// comparando contra prisma/importProductos.ts (el listado que ya está creado en
// la base de datos). Contiene SOLO los productos que aún NO existen (53 en total: 41 con código de barras
// propio + 12 que el dueño confirmó que son productos distintos por tamaño
// o sabor, aunque su nombre se pareciera a uno ya creado).
//
// Se excluyeron a propósito de esta lista:
//  - "VEGETAL ZANAHORIA": el dueño confirmó que es el mismo producto que ya
//    tiene creado como "VEGETAL ZANHORIA" (estaba mal escrito), así que no
//    se crea uno nuevo.
//  - "COLGATE ... 75ML.", "AGUA NEVADA ... 355ML. PET.", "AGUA POTABLE
//    NEVADA 1.5LTS. PET.", "AGUA POTABLE NEVADA 600ML. PET." y "OLYMPIA
//    SALSA DE AJO 300CM3.": cada uno comparte el mismo código de barras Y
//    el mismo precio de venta que un producto ya existente. El Excel solo
//    les retocó el nombre (unidad o ligero cambio de orden en las
//    palabras), así que son el mismo producto y no se crean de nuevo.
//
// Cada producto trae únicamente: codigo, nombre y precioUsd (precio de VENTA,
// no de costo, tomado de la columna "P/venta" del Excel). La categoria queda
// como "Sin categoría" a propósito: el dueño la asigna a mano luego desde
// /admin/productos. Ningún producto de esta lista tiene imagen todavía.
//
// Los códigos que empiezan con "NEW-" son productos sin código de barras real
// en el Excel (el Excel les puso un ID interno que YA estaba usado por otro
// producto en la base de datos), así que se les generó un código nuevo para
// evitar choque con el campo único "codigo".
//
// Uso: npx tsx prisma/importProductosNuevos.ts
const productosNuevos = [
    { codigo: "7501014511016", nombre: "BIC BOLIGRAFO TINTA AZUL PUNTA MEDIA", precioUsd: 0.7, categoria: "Sin categoría" },
    { codigo: "7591133001444", nombre: "BIMBO PANQUE SABOR VAINILLA 60GRS.", precioUsd: 1.09, categoria: "Sin categoría" },
    { codigo: "7591052001877", nombre: "CAFE BUEN CAFE 100GRS.", precioUsd: 1.79, categoria: "Sin categoría" },
    { codigo: "7591052000917", nombre: "CAFE BUEN CAFE 200GRS.", precioUsd: 3.51, categoria: "Sin categoría" },
    { codigo: "7591052000719", nombre: "CAFE BUEN CAFE 500GRS.", precioUsd: 8.73, categoria: "Sin categoría" },
    { codigo: "7596540000455", nombre: "CAFE FLOR DE ARAUCA 200GRS.", precioUsd: 3.81, categoria: "Sin categoría" },
    { codigo: "7622202308765", nombre: "CLUB SOCIAL GALLETA INTEGRAL MULTICEREALES", precioUsd: 2.32, categoria: "Sin categoría" },
    { codigo: "17622202308765", nombre: "CLUB SOCIAL GALLETA INTEGRAL MULTICEREALES X UNIDAD", precioUsd: 0.54, categoria: "Sin categoría" },
    { codigo: "7591016871089", nombre: "COCOSETTE 50GRS. NESTLE", precioUsd: 1.24, categoria: "Sin categoría" },
    { codigo: "7591072003622", nombre: "DIABLITO UNDER WOOD 115GRS.", precioUsd: 3.78, categoria: "Sin categoría" },
    { codigo: "7591072000027", nombre: "DIABLITO UNDER WOOD 54GRS.", precioUsd: 2.2, categoria: "Sin categoría" },
    { codigo: "17590011890910", nombre: "GALLETA BELVITA HONY X UNIDAD", precioUsd: 0.62, categoria: "Sin categoría" },
    { codigo: "17590011890866", nombre: "GALLETA BELVITA KRAKER X UNIDAD", precioUsd: 0.62, categoria: "Sin categoría" },
    { codigo: "17622210611307", nombre: "GALLETA CLUB SOCIAL INTEGRAL X UNIDAD", precioUsd: 0.54, categoria: "Sin categoría" },
    { codigo: "17622210610652", nombre: "GALLETA CLUB SOCIAL ORIGINAL X UNIDAD", precioUsd: 0.5, categoria: "Sin categoría" },
    { codigo: "7591031005995", nombre: "GATORADE PERFORM 500CM3.", precioUsd: 2.53, categoria: "Sin categoría" },
    { codigo: "NEW-1000000000037", nombre: "HUEVO X UNIDAD DETALLADO", precioUsd: 0.21, categoria: "Sin categoría" },
    { codigo: "7597417000653", nombre: "MARY PASTA LARGA VERMICELLI TRADICIONAL 1KILO", precioUsd: 2.16, categoria: "Sin categoría" },
    { codigo: "7597417000769", nombre: "MARY PASTA LARGA VERMICELLI TRADICIONAL 500GRS.", precioUsd: 1.11, categoria: "Sin categoría" },
    { codigo: "7591473003290", nombre: "MARY TOMATE PELADO AL NATURAL 400GRS.", precioUsd: 4.37, categoria: "Sin categoría" },
    { codigo: "NEW-1000000000010", nombre: "MIEL DE AVEJA 150GRS.", precioUsd: 2.33, categoria: "Sin categoría" },
    { codigo: "7591016003671", nombre: "NESTEA DURAZNO 90GRS.", precioUsd: 2.15, categoria: "Sin categoría" },
    { codigo: "7591016005965", nombre: "NESTEA LIMON 90GRS.", precioUsd: 2.15, categoria: "Sin categoría" },
    { codigo: "7591016014554", nombre: "NESTEA PARCHITA 90GRS.", precioUsd: 2.15, categoria: "Sin categoría" },
    { codigo: "7597963000268", nombre: "NEWPESCA SARDINA EN ACEITE 170GRS.", precioUsd: 1.21, categoria: "Sin categoría" },
    { codigo: "7599998802077", nombre: "PAN SANDWICH GRANDE", precioUsd: 4.29, categoria: "Sin categoría" },
    { codigo: "39800014009", nombre: "PILA ENERGIZER AAAX2", precioUsd: 2.89, categoria: "Sin categoría" },
    { codigo: "17591082000307", nombre: "PUIG GALLETA MARIA X UNIDAD", precioUsd: 0.46, categoria: "Sin categoría" },
    { codigo: "17591082007153", nombre: "PUIG GALLETAS SODA X UNIDAD", precioUsd: 0.4, categoria: "Sin categoría" },
    { codigo: "7599998801018", nombre: "PUNTO VERDE TEQUEÑO ESCOLARES 5 UND.", precioUsd: 1.96, categoria: "Sin categoría" },
    { codigo: "7599998801315", nombre: "PUNTO VERDE TEQUEÑO PASAPALOS PAQUETE", precioUsd: 3.64, categoria: "Sin categoría" },
    { codigo: "7591016854976", nombre: "SAVOY CHOCOLATE BLANCO GALAK 30GRS.", precioUsd: 1.66, categoria: "Sin categoría" },
    { codigo: "7591016851135", nombre: "SAVOY CHOCOLATE CON LECHE 30GRS.", precioUsd: 1.66, categoria: "Sin categoría" },
    { codigo: "7591016851555", nombre: "SAVOY CHOCOLATE CRICRI 30GRS.", precioUsd: 1.66, categoria: "Sin categoría" },
    { codigo: "7591016854686", nombre: "SAVOY CHOCOLATE RIKITI 30GRS.", precioUsd: 1.66, categoria: "Sin categoría" },
    { codigo: "7591016873434", nombre: "SAVOY SAMBA FRESA 32GRS.", precioUsd: 1.22, categoria: "Sin categoría" },
    { codigo: "7591016161111", nombre: "SAVOY TORONTO CHOCOLATE AVELLANA", precioUsd: 0.78, categoria: "Sin categoría" },
    { codigo: "721688883128", nombre: "VASOS PLASTICOS DESECHABLES 236.5ML", precioUsd: 0.06, categoria: "Sin categoría" },
    { codigo: "NEW-1000000000038", nombre: "VEGETAL AJI DULCE", precioUsd: 2.56, categoria: "Sin categoría" },
    { codigo: "NEW-1000000000039", nombre: "VEGETAL CAMBUR", precioUsd: 1.14, categoria: "Sin categoría" },
    { codigo: "NEW-1000000000040", nombre: "VEGETAL TOMATE", precioUsd: 2.57, categoria: "Sin categoría" },
    { codigo: "7591127343574", nombre: "AGUA NEVADA SABORIZADA SABOR MANZANA 1.5ML. PET.", precioUsd: 1.55, categoria: "Sin categoría" },
    { codigo: "7595461000032", nombre: "CAFE AMANECER 500GRS.", precioUsd: 8.91, categoria: "Sin categoría" },
    { codigo: "7595461000148", nombre: "CAFE DELLA NONNA 500GRS.", precioUsd: 8.91, categoria: "Sin categoría" },
    { codigo: "7595461000308", nombre: "CAFE FAVORITO 200GRS.", precioUsd: 2.27, categoria: "Sin categoría" },
    { codigo: "7591088630997", nombre: "CARABOBO LECHE COMPLETA LARGA DURACION  1LTS.", precioUsd: 3.47, categoria: "Sin categoría" },
    { codigo: "NEW-1000000000017", nombre: "MAGGI CUBITO CALDO DE POLLO", precioUsd: 0.26, categoria: "Sin categoría" },
    { codigo: "7591473005362", nombre: "MARY ARROZ TRADICIONAL 900GRS.", precioUsd: 1.14, categoria: "Sin categoría" },
    { codigo: "7591473004976", nombre: "MARY MAIZ PARA COTUFAS 400GRS.", precioUsd: 1.66, categoria: "Sin categoría" },
    { codigo: "7597963000275", nombre: "NEWPESCA SARDINA EN SALSA DE TOMATE 170GRS.", precioUsd: 1.21, categoria: "Sin categoría" },
    { codigo: "7622202213656", nombre: "OREO GALLETA AMERICANO TUBO 96GRS. NABISCO", precioUsd: 1.77, categoria: "Sin categoría" },
    { codigo: "7622202213700", nombre: "OREO GALLETA VAINILLA 6S 192GRS. NABISCO", precioUsd: 3.36, categoria: "Sin categoría" },
    { codigo: "7622202213618", nombre: "OREO GALLETA VAINILLA TUBO 96GRS. NABISCO", precioUsd: 1.77, categoria: "Sin categoría" },
];

async function main() {
    let creados = 0;
    let omitidos = 0;

    for (const p of productosNuevos) {
        const existente = await prisma.product.findFirst({ where: { codigo: p.codigo } });
        if (existente) {
            console.log(`Ya existe, se omite: ${p.nombre}`);
            omitidos++;
            continue;
        }
        await prisma.product.create({
            data: {
                codigo: p.codigo,
                nombre: p.nombre,
                precioUsd: p.precioUsd,
                categoria: p.categoria
            }
        });
        creados++;
    }

    console.log(`\nImportacion completa: ${creados} producto(s) creado(s), ${omitidos} omitido(s) (ya existian).`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
