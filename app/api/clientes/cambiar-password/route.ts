import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClienteIdFromSession, hashPassword, verifyPassword } from "@/lib/auth";

// Usado desde "Mi cuenta" para que el cliente elija su propia contraseña,
// típicamente después de entrar con la contraseña temporal que le dio la
// tienda por teléfono (ver /admin/clientes). Pide la contraseña actual
// para confirmar que es él quien la está cambiando, no solo alguien con
// acceso al dispositivo donde quedó la sesión iniciada.
export async function POST(req: NextRequest) {
  const clienteId = getClienteIdFromSession();
  if (!clienteId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { passwordActual, passwordNueva } = body as {
    passwordActual: string;
    passwordNueva: string;
  };

  if (!passwordActual || !passwordNueva) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (passwordNueva.length < 6) {
    return NextResponse.json(
      { error: "La contraseña nueva debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!verifyPassword(passwordActual, cliente.passwordHash)) {
    return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 401 });
  }

  await prisma.cliente.update({
    where: { id: clienteId },
    data: { passwordHash: hashPassword(passwordNueva) }
  });

  return NextResponse.json({ ok: true });
}
