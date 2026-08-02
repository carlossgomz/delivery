import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { subirImagenR2 } from "../lib/r2";

const prisma = new PrismaClient();

// ==========================================
// CONFIGURACIÓN
// ==========================================
// Ruta a la carpeta donde tienes las imágenes en tu computadora.
// Puede ser relativa (a la raíz del proyecto) o una ruta absoluta.
const CARPETA_IMAGENES = "imagenes_descargadas";

// Si es false, los productos que YA tienen una imagenUrl asignada se
// saltan (no se re-suben ni se pisan). Ponlo en true solo si quieres
// forzar el reemplazo de todas las imágenes, incluidas las que ya tienen.
const FORZAR_REEMPLAZO = false;

const EXTENSIONES_VALIDAS = [".jpg", ".jpeg", ".png", ".webp"];

// ==========================================
// UTILIDADES DE MATCHING
// ==========================================
// Normaliza un nombre para comparar "a lo mismo": minúsculas, sin acentos,
// solo letras/números/espacios/guiones, espacios colapsados. Así
// "3B Pañal Talla M." y "3b pañal talla m" hacen match aunque no sean
// idénticos carácter por carácter.
function normalizar(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quita acentos
        .toLowerCase()
        .replace(/[^a-z0-9 _-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function main() {
    const rutaCarpeta = path.resolve(process.cwd(), CARPETA_IMAGENES);

    if (!fs.existsSync(rutaCarpeta)) {
        console.error(`❌ No se encontró la carpeta de imágenes en: ${rutaCarpeta}`);
        console.error("   Ajusta la constante CARPETA_IMAGENES al inicio del script.");
        process.exit(1);
    }

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
        console.error("❌ Faltan variables de entorno de Cloudflare R2 en tu .env — sin eso no se puede subir.");
        console.error("   Necesitas: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL");
        process.exit(1);
    }

    // Indexar todas las imágenes de la carpeta por su nombre normalizado
    const archivos = fs.readdirSync(rutaCarpeta);
    const indiceImagenes = new Map<string, string>(); // nombreNormalizado -> ruta completa

    for (const archivo of archivos) {
        const ext = path.extname(archivo);
        if (!EXTENSIONES_VALIDAS.includes(ext.toLowerCase())) continue;
        const nombreSinExtension = path.basename(archivo, ext);
        const clave = normalizar(nombreSinExtension);
        indiceImagenes.set(clave, path.join(rutaCarpeta, archivo));
    }

    console.log(`Imágenes encontradas en la carpeta: ${indiceImagenes.size}`);

    // Traer todos los productos
    const productos = await prisma.product.findMany();
    console.log(`Productos en la base de datos: ${productos.length}\n`);

    let asignados = 0;
    let saltados = 0;
    let sinImagen = 0;
    const sinMatch: string[] = [];

    for (const producto of productos) {
        if (!FORZAR_REEMPLAZO && producto.imagenUrl) {
            saltados++;
            continue;
        }

        const clave = normalizar(producto.nombre);
        const rutaImagen = indiceImagenes.get(clave);

        if (!rutaImagen) {
            sinImagen++;
            sinMatch.push(producto.nombre);
            console.log(`✗ Sin imagen para: ${producto.nombre}`);
            continue;
        }

        try {
            const buffer = fs.readFileSync(rutaImagen);
            const key = `productos/producto-${producto.id}.jpg`;

            // subirImagenR2 redimensiona a 800x800 máx. y comprime a JPEG
            // calidad 80 antes de subir — cada foto queda en decenas de KB
            // en vez de los varios MB que suelen pesar las fotos originales.
            const url = await subirImagenR2(buffer, key);

            await prisma.product.update({
                where: { id: producto.id },
                data: { imagenUrl: url },
            });

            asignados++;
            console.log(`✓ Asignada: ${producto.nombre}`);
        } catch (e: any) {
            console.log(`⚠ Error subiendo imagen de "${producto.nombre}": ${e.message || e}`);
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log("¡Proceso finalizado!");
    console.log(`✓ Imágenes asignadas: ${asignados}`);
    console.log(`↷ Productos saltados (ya tenían imagen): ${saltados}`);
    console.log(`✗ Sin imagen encontrada: ${sinImagen}`);
    console.log("=".repeat(50));

    if (sinMatch.length > 0) {
        console.log("\nProductos que quedaron SIN imagen (revisa el nombre del archivo vs. el nombre del producto):");
        sinMatch.forEach((n) => console.log(" - " + n));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());