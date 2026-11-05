import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPosSyncAuthed } from "@/lib/auth";

// El POS de la tienda empuja acá su tasa del día cuando cambia y una vez por
// hora como respaldo (ver delivery.rs::empujar_tasa) — así las
// dos tasas (POS y delivery-app) no se pueden desincronizar por olvido de
// cambiarla a mano en los dos lados. El dueño puede seguir cambiándola
// directo acá también (POST /api/config, ver esa ruta) si hiciera falta,
// pero el próximo envío del POS la vuelve a pisar con la suya — el POS es
// la fuente de verdad.
export async function POST(req: NextRequest) {
  if (!isPosSyncAuthed(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const tasaCambio = Number(body.tasaCambio);
  if (!tasaCambio || tasaCambio <= 0) {
    return NextResponse.json({ error: "Tasa inválida" }, { status: 400 });
  }

  await prisma.config.upsert({
    where: { id: 1 },
    update: { tasaCambio },
    create: { id: 1, tasaCambio }
  });

  return NextResponse.json({ ok: true, tasaCambio });
}
