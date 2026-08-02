import { NextRequest, NextResponse } from "next/server";
import { subirImagenR2 } from "@/lib/r2";

// Guarda el archivo en Cloudflare R2 (ya no en Vercel Blob: R2 no cobra por
// transferencia de salida, así que servir el catálogo no consume ningún
// cupo). subirImagenR2 además redimensiona/comprime la imagen a un máximo
// de 800x800px antes de subirla, para que cada foto ocupe lo justo.
//
// "carpeta" es opcional (default "comprobantes", el uso original de este
// endpoint); el admin de productos manda carpeta=productos para las
// imágenes de producto, y carpeta=categorias para la imagen representativa
// de cada categoría (los círculos del catálogo).
const CARPETAS_PERMITIDAS = ["comprobantes", "productos", "categorias"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const carpetaSolicitada = (formData.get("carpeta") as string | null) ?? "comprobantes";
    const carpeta = CARPETAS_PERMITIDAS.includes(carpetaSolicitada) ? carpetaSolicitada : "comprobantes";

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
      console.error("❌ ERROR: Faltan variables de entorno de Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).");
      return NextResponse.json(
        { error: "El servidor no tiene configurado el acceso a Cloudflare R2." },
        { status: 500 }
      );
    }

    const prefijo = carpeta === "productos" ? "producto" : carpeta === "categorias" ? "categoria" : "comprobante";
    const key = `${carpeta}/${prefijo}-${Date.now()}.jpg`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await subirImagenR2(buffer, key);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("❌ Error en /api/upload al subir archivo a R2:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al subir el archivo" },
      { status: 500 }
    );
  }
}