"use client";

import { useEffect, useState } from "react";

type OrderItem = {
  id: string;
  cantidad: number;
  precioUsd: number;
  disponible: boolean | null;
  product: { nombre: string };
};

type Order = {
  id: string;
  clienteNombre: string;
  clienteTelefono: string;
  direccion: string;
  estado: string;
  totalUsd: number | null;
  totalBs: number | null;
  comprobanteUrl: string | null;
  notaPago?: string | null;
  items: OrderItem[];
};

const ETIQUETAS: Record<string, string> = {
  PENDIENTE_VERIFICACION: "Por verificar stock",
  ESPERANDO_PAGO: "Esperando pago",
  PAGO_RECIBIDO: "Pago en revisión",
  PAGO_EN_REVISION: "Pago en revisión",
  CONFIRMADO: "Pago confirmado",
  EN_PREPARACION: "En preparación",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado"
};

// Pequeño "ding" generado en el navegador (sin depender de un archivo de audio)
function sonarAlerta() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Si el navegador bloquea audio sin interacción previa, no pasa nada grave.
  }
}

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [conectado, setConectado] = useState(false);

  async function cargar() {
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(data.orders);
  }

  useEffect(() => {
    cargar();

    // Conexión en vivo: el servidor avisa apenas entra un pedido nuevo o
    // se actualiza uno existente, sin tener que estar preguntando.
    const source = new EventSource("/api/orders/stream");

    source.addEventListener("connected", () => setConectado(true));

    source.addEventListener("nuevo_pedido", () => {
      sonarAlerta();
      cargar();
    });

    source.addEventListener("pedido_actualizado", () => {
      cargar();
    });

    source.onerror = () => {
      setConectado(false);
    };

    return () => source.close();
  }, []);

  function toggleDisponible(order: Order, itemId: string, value: boolean) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id !== order.id
          ? o
          : { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, disponible: value } : i)) }
      )
    );
  }

  async function guardarDisponibilidad(order: Order) {
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: order.items.map((i) => ({ id: i.id, disponible: !!i.disponible }))
      })
    });
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirmar_disponibilidad" })
    });
    cargar();
  }

  async function cambiarEstado(order: Order, estado: string) {
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado })
    });
    cargar();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl text-leaf-800">Pedidos</h1>
        <span className={`text-xs flex items-center gap-1.5 ${conectado ? "text-leaf-600" : "text-alert-600"}`}>
          <span className={`w-2 h-2 rounded-full ${conectado ? "bg-leaf-600" : "bg-alert-600"}`} />
          {conectado ? "Recibiendo pedidos en vivo" : "Sin conexión — reintentando…"}
        </span>
      </div>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border border-leaf-100 rounded-lg p-4">
            <div className="flex flex-wrap gap-2 justify-between items-start mb-2">
              <div className="min-w-0">
                <p className="font-medium">{order.clienteNombre}</p>
                <p className="text-sm text-ink/60">
                  {order.clienteTelefono} · {order.direccion}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-1 rounded-full ${order.estado === "PAGO_RECIBIDO" || order.estado === "PAGO_EN_REVISION"
                    ? "bg-amber-100 text-amber-800 font-medium"
                    : "bg-clay-100 text-clay-600"
                  }`}
              >
                {ETIQUETAS[order.estado] ?? order.estado}
              </span>
            </div>

            <ul className="text-sm divide-y divide-leaf-50">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2">
                  <span>
                    {item.cantidad}× {item.product.nombre}
                  </span>
                  {order.estado === "PENDIENTE_VERIFICACION" ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!item.disponible}
                        onChange={(e) => toggleDisponible(order, item.id, e.target.checked)}
                      />
                      Disponible
                    </label>
                  ) : (
                    <span className={item.disponible ? "text-leaf-600" : "text-alert-600"}>
                      {item.disponible ? "Disponible" : "No disponible"}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {order.estado === "PENDIENTE_VERIFICACION" && (
              <button
                onClick={() => guardarDisponibilidad(order)}
                className="mt-3 px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm"
              >
                Confirmar disponibilidad
              </button>
            )}

            {order.totalUsd != null && (
              <p className="mt-3 text-sm text-ink/70 font-medium">
                Total: ${order.totalUsd.toFixed(2)} · Bs {order.totalBs?.toFixed(2)}
              </p>
            )}

            {/* SECCIÓN DE REVISIÓN DE PAGO */}
            {(order.estado === "PAGO_RECIBIDO" || order.estado === "PAGO_EN_REVISION") && (
              <div className="mt-3 p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-sm space-y-2">
                <p className="font-semibold text-amber-900">💳 Detalles del pago enviado por el cliente:</p>

                {order.notaPago && (
                  <p className="text-ink/80 text-xs bg-white p-2 rounded border border-amber-100">
                    <span className="font-semibold">Referencia / Mensaje:</span> {order.notaPago}
                  </p>
                )}

                {order.comprobanteUrl ? (
                  <a
                    href={order.comprobanteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-leaf-600 underline text-xs font-medium"
                  >
                    🖼️ Ver captura / comprobante adjunto
                  </a>
                ) : (
                  !order.notaPago && <p className="text-xs text-ink/60">El cliente no adjuntó archivo ni nota.</p>
                )}

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => cambiarEstado(order, "CONFIRMADO")}
                    className="px-3 py-1.5 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-800 transition-colors"
                  >
                    Aprobar pago
                  </button>
                  <button
                    onClick={() => cambiarEstado(order, "ESPERANDO_PAGO")}
                    className="px-3 py-1.5 rounded-lg border border-alert-600 text-alert-600 text-sm font-medium hover:bg-alert-50 transition-colors"
                  >
                    Rechazar comprobante
                  </button>
                </div>
              </div>
            )}

            {order.estado === "CONFIRMADO" && (
              <button
                onClick={() => cambiarEstado(order, "EN_PREPARACION")}
                className="mt-3 px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm"
              >
                Pasar a preparación
              </button>
            )}

            {order.estado === "EN_PREPARACION" && (
              <button
                onClick={() => cambiarEstado(order, "ENTREGADO")}
                className="mt-3 px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm"
              >
                Marcar como entregado
              </button>
            )}
          </div>
        ))}
        {orders.length === 0 && <p className="text-ink/60">No hay pedidos todavía.</p>}
      </div>
    </div>
  );
}