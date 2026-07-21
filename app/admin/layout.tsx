import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { isAdminAuthed } from "@/lib/auth";

export default function AdminLayout({ children }: { children: ReactNode }) {
  if (!isAdminAuthed()) {
    redirect("/login");
  }

  return (
    <div>
      <nav className="bg-leaf-800 text-white px-4 py-3 flex gap-4 text-sm">
        <Link href="/admin">Tasa del día</Link>
        <Link href="/admin/pedidos">Pedidos</Link>
        <Link href="/admin/productos">Productos</Link>
      </nav>
      <div className="max-w-3xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
