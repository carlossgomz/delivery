import { NextResponse } from "next/server";
import { getStaffRole } from "@/lib/auth";

// La cookie de sesión del personal (admin_session) es httpOnly, así que las
// pantallas del admin que son "use client" (como /admin/pedidos) no pueden
// leerla directo del navegador. Este endpoint simplemente la expone de
// vuelta para que esas pantallas sepan si quien está mirando es el dueño
// ("admin") o un empleado de delivery, y muestren u oculten acciones según
// corresponda (ej. eliminar/cancelar pedidos, que son solo del dueño).
export async function GET() {
  const role = getStaffRole();
  return NextResponse.json({ role });
}
