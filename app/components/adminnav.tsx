"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Barra de navegación del admin con un contador de mensajes pendientes
// (estilo WhatsApp) sobre "Mensajes", visible desde cualquier pantalla.
export default function AdminNav() {
    const pathname = usePathname();
    const [noLeidos, setNoLeidos] = useState(0);

    async function cargarNoLeidos() {
        try {
            const res = await fetch("/api/chat/conversaciones", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            const total = (data.conversaciones ?? []).reduce(
                (sum: number, c: { noLeidos?: number }) => sum + (c.noLeidos || 0),
                0
            );
            setNoLeidos(total);
        } catch {
            // Si falla, se reintenta con el próximo evento o el siguiente poll.
        }
    }

    useEffect(() => {
        cargarNoLeidos();

        const source = new EventSource("/api/chat/stream");
        source.addEventListener("nuevo_mensaje", () => {
            cargarNoLeidos();
        });

        // Respaldo por si la conexión SSE se cae en silencio.
        const interval = setInterval(cargarNoLeidos, 15000);

        return () => {
            source.close();
            clearInterval(interval);
        };
    }, []);

    // Al cambiar de página (por ejemplo, salir de "Mensajes" tras leerlos)
    // se recalcula el contador para que no se quede desactualizado.
    useEffect(() => {
        cargarNoLeidos();
    }, [pathname]);

    const links = [
        { href: "/admin", label: "Tasa y Productos" },
        { href: "/admin/pedidos", label: "Pedidos" },
        { href: "/admin/pedidos/llamada", label: "📞 Llamada" },
        { href: "/admin/mensajes", label: "Mensajes" }
    ];

    return (
        <nav className="bg-leaf-800 text-white px-4 py-3 flex gap-6 text-sm font-medium overflow-x-auto whitespace-nowrap">
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className="hover:text-leaf-100 transition-colors flex items-center gap-1.5"
                >
                    {link.label}
                    {link.href === "/admin/mensajes" && noLeidos > 0 && (
                        <span className="bg-alert-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                            {noLeidos > 99 ? "99+" : noLeidos}
                        </span>
                    )}
                </Link>
            ))}
        </nav>
    );
}