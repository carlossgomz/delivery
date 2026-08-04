import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

// Cliente S3 apuntando a Cloudflare R2 (R2 es compatible con la API de S3,
// solo cambia el endpoint). Las credenciales viven en variables de entorno,
// nunca hardcodeadas.
// .trim() en las 3: es común que un dashboard de variables de entorno (ej.
// Vercel) agregue un salto de línea invisible al pegar el valor, lo que
// rompe la firma de cada request (SignatureDoesNotMatch) sin que se note
// mirando el valor.
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${(process.env.R2_ACCOUNT_ID ?? "").trim()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: (process.env.R2_ACCESS_KEY_ID ?? "").trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY ?? "").trim(),
  },
  // El SDK de AWS calcula por defecto un checksum CRC32 en cada request
  // (desde las versiones recientes de @aws-sdk/client-s3). R2 no valida
  // ese checksum igual que S3 y eso rompe la firma de la request
  // (SignatureDoesNotMatch), así que lo desactivamos.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const BUCKET = (process.env.R2_BUCKET_NAME ?? "").trim();
// URL pública del bucket (Public Development URL de R2, o tu dominio propio
// más adelante), sin "/" al final. Ej: https://pub-xxxx.r2.dev
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

/**
 * Redimensiona/comprime una imagen y la sube a R2. Pensado para fotos de
 * producto y de comprobantes: nunca hace falta más de 800px de lado para
 * verse nítido en un catálogo o en el panel de la tienda, así que
 * recortamos el peso entre 10 y 30 veces sin que se note la diferencia
 * a simple vista.
 *
 * @param buffer  Contenido del archivo original.
 * @param key     Ruta/nombre dentro del bucket, ej. "productos/producto-123.jpg".
 * @returns       URL pública final del archivo ya subido.
 */
export async function subirImagenR2(buffer: Buffer, key: string): Promise<string> {
  const optimizada = await sharp(buffer)
    .rotate() // respeta la orientación EXIF (fotos tomadas de lado, etc.)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Forzamos .jpg como extensión final ya que todo se re-encodea a JPEG.
  const keyFinal = key.replace(/\.[a-zA-Z0-9]+$/, "") + ".jpg";

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: keyFinal,
      Body: optimizada,
      ContentType: "image/jpeg",
      // Un año de caché: el nombre incluye un timestamp/id único, así que
      // si la foto cambia, cambia el nombre y no hay problema de caché viejo.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${PUBLIC_URL}/${keyFinal}`;
}
