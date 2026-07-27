import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Guarda el archivo en Vercel Blob. A diferencia de escribir en /public,
// esto sobrevive entre despliegues y funciona igual en local que en
// producción (usa el mismo BLOB_READ_WRITE_TOKEN en ambos lados).
//
// "carpeta" es opcional (default "comprobantes", el uso original de este
// endpoint); el admin de productos manda carpeta=productos para las
// imágenes de producto.
const CARPETAS_PERMITIDAS = ["comprobantes", "productos"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const carpetaSolicitada = (formData.get("carpeta") as string | null) ?? "comprobantes";
    const carpeta = CARPETAS_PERMITIDAS.includes(carpetaSolicitada) ? carpetaSolicitada : "comprobantes";

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
    const prefijo = carpeta === "productos" ? "producto" : "comprobante";
    const filename = `${carpeta}/${prefijo}-${Date.now()}.${ext}`;

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