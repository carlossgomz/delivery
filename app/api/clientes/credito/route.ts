import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Habilita/deshabilita el crédito autorizado por la tienda para un cliente
// puntual. Se usa desde /admin/clientes, en la misma ficha donde ya se
// restablece la contraseña.
export async function PATCH(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { cedula, creditoAutorizado } = body as { cedula?: string; creditoAutorizado?: boolean };

  if (!cedula || typeof creditoAutorizado !== "boolean") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const cliente = await prisma.cliente.update({
    where: { cedula },
    data: { creditoAutorizado } as any
  });

  return NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      creditoAutorizado: (cliente as any).creditoAutorizado ?? false
    }
  });
}
