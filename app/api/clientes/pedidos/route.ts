import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClienteIdFromSession } from "@/lib/auth";

export async function GET() {
  const clienteId = getClienteIdFromSession();
  if (!clienteId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { clienteId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } }
  });

  return NextResponse.json({ orders });
}
