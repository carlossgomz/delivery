import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Guarda la imagen del comprobante en Vercel Blob. A diferencia de escribir
// en /public, esto sobrevive entre despliegues y funciona igual en local
// que en producción (usa el mismo BLOB_READ_WRITE_TOKEN en ambos lados).
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("❌ ERROR: Falta la variable BLOB_READ_WRITE_TOKEN en las variables de entorno.");
      return NextResponse.json(
        { error: "El servidor no tiene configurado el token de Vercel Blob." },
        { status: 500 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `comprobantes/comprobante-${Date.now()}.${ext}`;

    const blob = await put(filename, file, { access: "public" });

    return NextResponse.json({ url: blob.url });
  } catch (error: any) {
    console.error("❌ Error en /api/upload al subir archivo a Blob:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al subir el archivo" },
      { status: 500 }
    );
  }
}