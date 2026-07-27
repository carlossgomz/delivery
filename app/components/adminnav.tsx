"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { reproducirAlerta } from "@/lib/alertaSonido";
import { actualizarBadgeFavicon } from "@/lib/faviconBadge";

type PedidoPendiente = { id: string; clienteNombre: string; estado: string };

const TITULO_NORMAL = "Day Express Supermarket";
// Si la primera alerta (sonido/notificación) se pasa por alto porque el
// admin no estaba mirando, esto la repite cada cierto tiempo mientras
// sigan quedando pedidos por atender — así funcionan las apps de
// delivery: no avisan una sola vez y se quedan calladas.
const REINTENTO_SONIDO_MS = 25000;
const PARPADEO_TITULO_MS = 1200;

// Barra de navegación del admin. Además de los links, es el lugar donde
// vive TODA la alerta de "hay algo que atender" (pedido nuevo o pago
// enviado), porque está montada en cualquier pantalla del admin: así el
// aviso llega sin importar en qué pestaña/página esté el personal.
export default function AdminNav() {
  const pathname = usePathname();
  const [noLeidos, setNoLeidos] = useState(0);
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([]);
  const [permisoNotificacion, setPermisoNotificacion] = useState<NotificationPermission | "unsupported">(
    "default"
  );

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

  async function cargarPedidosPendientes() {
    try {
      const res = await fetch("/api/orders/pendientes-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPedidosPendientes(Array.isArray(data.items) ? data.items : []);
    } catch {
      // Igual que arriba: se reintenta solo en el próximo evento o poll.
    }
  }

  function dispararNotificacionEscritorio(titulo: string, cuerpo: string) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(titulo, { body: cuerpo, icon: "/icon.png" });
    } catch {
      // Algunos navegadores/SO bloquean esto en ciertos contextos; no es crítico.
    }
  }

  async function pedirPermisoNotificaciones() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermisoNotificacion("unsupported");
      return;
    }
    const resultado = await Notification.requestPermission();
    setPermisoNotificacion(resultado);
  }

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermisoNotificacion(Notification.permission);
    } else {
      setPermisoNotificacion("unsupported");
    }
  }, []);

  useEffect(() => {
    cargarNoLeidos();
    cargarPedidosPendientes();

    const chatSource = new EventSource("/api/chat/stream");
    chatSource.addEventListener("nuevo_mensaje", () => {
      cargarNoLeidos();
    });

    const ordersSource = new EventSource("/api/orders/stream");

    ordersSource.addEventListener("nuevo_pedido", (event: MessageEvent) => {
      cargarPedidosPendientes();
      reproducirAlerta();
      try {
        const order = JSON.parse(event.data);
        dispararNotificacionEscritorio(
          "🆕 Nuevo pedido",
          `${order.clienteNombre ?? "Un cliente"} — ${order.direccion ?? ""}`
        );
      } catch {
        dispararNotificacionEscritorio("🆕 Nuevo pedido", "Llegó un pedido nuevo para atender.");
      }
    });

    ordersSource.addEventListener("pedido_actualizado", (event: MessageEvent) => {
      cargarPedidosPendientes();
      if (!event.data) return;
      try {
        const order = JSON.parse(event.data);
        if (order.estado === "PAGO_RECIBIDO" || order.estado === "PAGO_EN_REVISION") {
          reproducirAlerta();
          dispararNotificacionEscritorio(
            "💳 Pago enviado",
            `${order.clienteNombre ?? "Un cliente"} envió su comprobante de pago.`
          );
        }
      } catch {
        // Sin datos parseables no sabemos si amerita alerta; se ignora.
      }
    });

    // Respaldo por si el stream se cae en silencio.
    const polling = setInterval(() => {
      cargarNoLeidos();
      cargarPedidosPendientes();
    }, 15000);

    return () => {
      chatSource.close();
      ordersSource.close();
      clearInterval(polling);
    };
  }, []);

  // Al cambiar de página (por ejemplo, salir de "Mensajes" tras leerlos)
  // se recalcula el contador para que no se quede desactualizado.
  useEffect(() => {
    cargarNoLeidos();
    cargarPedidosPendientes();
  }, [pathname]);

  // --- Título parpadeante + burbuja en el favicon mientras haya pedidos
  // por atender, para que se note aunque la pestaña esté en segundo plano. ---
  const hayPedidosPendientes = pedidosPendientes.length > 0;
  useEffect(() => {
    actualizarBadgeFavicon(pedidosPendientes.length);
  }, [pedidosPendientes.length]);

  useEffect(() => {
    if (!hayPedidosPendientes) {
      document.title = TITULO_NORMAL;
      return;
    }

    let visible = true;
    const intervalo = setInterval(() => {
      visible = !visible;
      document.title = visible
        ? `🔴 (${pedidosPendientes.length}) ¡Pedido por atender!`
        : TITULO_NORMAL;
    }, PARPADEO_TITULO_MS);

    return () => {
      clearInterval(intervalo);
      document.title = TITULO_NORMAL;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayPedidosPendientes, pedidosPendientes.length]);

  // --- Reintento de sonido: si el primer aviso se pasó por alto, insiste
  // cada REINTENTO_SONIDO_MS mientras sigan quedando pedidos pendientes. ---
  useEffect(() => {
    if (!hayPedidosPendientes) return;
    const intervalo = setInterval(() => {
      reproducirAlerta();
    }, REINTENTO_SONIDO_MS);
    return () => clearInterval(intervalo);
  }, [hayPedidosPendientes]);

  const links = [
    { href: "/admin", label: "Tasa y Productos" },
    { href: "/admin/pedidos", label: "Pedidos" },
    { href: "/admin/pedidos/llamada", label: "📞 Llamada" },
    { href: "/admin/clientes", label: "Clientes" },
    { href: "/admin/mensajes", label: "Mensajes" }
  ];

  return (
    <nav className="bg-leaf-800 text-white px-4 py-3 flex items-center gap-6 text-sm font-medium overflow-x-auto whitespace-nowrap">
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
          {link.href === "/admin/pedidos" && hayPedidosPendientes && (
            <span className="bg-alert-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center animate-pulse">
              {pedidosPendientes.length > 99 ? "99+" : pedidosPendientes.length}
            </span>
          )}
        </Link>
      ))}

      {/* Botón para activar notificaciones de escritorio (requiere que el
          admin lo pida con un clic; los navegadores no dejan pedirlo solo). */}
      {permisoNotificacion === "default" && (
        <button
          onClick={pedirPermisoNotificaciones}
          className="ml-auto shrink-0 text-xs px-2.5 py-1.5 rounded-full border border-leaf-100/40 hover:bg-leaf-700 transition-colors"
        >
          🔔 Activar avisos de escritorio
        </button>
      )}
      {permisoNotificacion === "denied" && (
        <span className="ml-auto shrink-0 text-xs text-leaf-100/60" title="Los avisos de escritorio están bloqueados en este navegador">
          🔕 Avisos bloqueados
        </span>
      )}
    </nav>
  );
}
