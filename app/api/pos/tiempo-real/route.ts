import { NextRequest, NextResponse } from "next/server";
import { isPosSyncAuthed } from "@/lib/auth";
import { CANAL_PEDIDOS } from "@/lib/orderEvents";

export const dynamic = "force-dynamic";

// Lo que el POS necesita para escuchar los eventos de pedidos directamente en
// Upstash, sin consultar este hosting cada pocos segundos. Nunca entrega el
// token principal: debe ser de solo lectura o estar limitado por ACL.
export async function GET(req: NextRequest) {
  if (!isPosSyncAuthed(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.POS_AVISOS_TOKEN ??
    process.env.KV_REST_API_READ_ONLY_TOKEN ??
    process.env.UPSTASH_REDIS_REST_READ_ONLY_TOKEN;

  if (!url || !token) {
    return NextResponse.json({ error: "Aviso en vivo sin configurar" }, { status: 503 });
  }

  return NextResponse.json(
    { url, token, canal: CANAL_PEDIDOS },
    { headers: { "Cache-Control": "no-store" } }
  );
}
