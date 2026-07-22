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
      <nav className="bg-leaf-800 text-white px-4 py-3 flex gap-6 text-sm font-medium">
        <Link href="/admin" className="hover:text-leaf-100 transition-colors">
          Tasa y Productos
        </Link>
        <Link href="/admin/pedidos" className="hover:text-leaf-100 transition-colors">
          Pedidos
        </Link>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}