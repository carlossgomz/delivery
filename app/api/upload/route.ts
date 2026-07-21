import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

// Guarda la imagen del comprobante en /public/uploads.
// Para producción real conviene moverlo a un bucket tipo S3/R2,
// pero para arrancar esto es suficiente y no depende de servicios externos.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `comprobante-${Date.now()}.${ext}`;
  const filepath = path.join(process.cwd(), "public", "uploads", filename);
  await writeFile(filepath, buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
