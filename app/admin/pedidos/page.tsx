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
  nota?: string | null;
  referencia?: string | null;
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

function sonarAlerta() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Evita lanzar errores no controlados si no hubo interacción previa
  }
}

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [conectado, setConectado] = useState(false);

  async function cargar() {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch (e) {
      console.error("Error al cargar pedidos:", e);
    }
  }

  useEffect(() => {
    cargar();

    let eventSource: EventSource | null = null;

    function conectarStream() {
      eventSource = new EventSource("/api/orders/stream");

      eventSource.addEventListener("connected", () => {
        setConectado(true);
      });

      eventSource.addEventListener("nuevo_pedido", () => {
        sonarAlerta();
        cargar();
      });

      eventSource.addEventListener("pedido_actualizado", (event: MessageEvent) => {
        sonarAlerta();
        if (event.data) {
          try {
            const updatedOrder: Order = JSON.parse(event.data);
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
            );
          } catch {
            cargar();
          }
        } else {
          cargar();
        }
      });

      eventSource.onerror = () => {
        setConectado(false);
        if (eventSource) {
          eventSource.close();
        }
        setTimeout(conectarStream, 3000);
      };
    }

    conectarStream();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
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
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: order.items.map((i) => ({ id: i.id, disponible: !!i.disponible }))
        })
      });
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmar_disponibilidad" })
      });
      const data = await res.json();
      if (data.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
      } else {
        cargar();
      }
    } catch (e) {
      console.error("Error al guardar disponibilidad:", e);
    }
  }

  async function cambiarEstado(order: Order, estado: string) {
    // Actualización optimista inmediata en UI
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, estado } : o)));

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado })
      });
      const data = await res.json();
      if (data.order) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
      }
    } catch (e) {
      console.error("Error al cambiar estado:", e);
      cargar(); // Revertir en caso de falla
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl text-leaf-800">Pedidos</h1>
        <span className={`text-xs flex items-center gap-1.5 ${conectado ? "text-leaf-600" : "text-alert-600"}`}>
          <span className={`w-2 h-2 rounded-full ${conectado ? "bg-leaf-600 animate-pulse" : "bg-alert-600"}`} />
          {conectado ? "Recibiendo pedidos en vivo" : "Sin conexión — reintentando…"}
        </span>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const notaCliente = order.notaPago || order.nota || order.referencia;
          const esRevisionPago = order.estado === "PAGO_RECIBIDO" || order.estado === "PAGO_EN_REVISION";

          return (
            <div key={order.id} className="bg-white border border-leaf-100 rounded-lg p-4 shadow-sm">
              <div className="flex flex-wrap gap-2 justify-between items-start mb-2">
                <div className="min-w-0">
                  <p className="font-medium">{order.clienteNombre}</p>
                  <p className="text-sm text-ink/60">
                    {order.clienteTelefono} · {order.direccion}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${esRevisionPago
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : order.estado === "CONFIRMADO"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
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
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!item.disponible}
                          onChange={(e) => toggleDisponible(order, item.id, e.target.checked)}
                          className="rounded text-leaf-600 focus:ring-leaf-500"
                        />
                        <span className="text-xs">Disponible</span>
                      </label>
                    ) : (
                      <span className={item.disponible ? "text-leaf-600 font-medium" : "text-alert-600 font-medium"}>
                        {item.disponible ? "Disponible" : "No disponible"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {order.estado === "PENDIENTE_VERIFICACION" && (
                <button
                  onClick={() => guardarDisponibilidad(order)}
                  className="mt-3 px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-700 transition-colors"
                >
                  Confirmar disponibilidad
                </button>
              )}

              {order.totalUsd != null && (
                <p className="mt-3 text-sm text-ink/80 font-medium">
                  Total: ${order.totalUsd.toFixed(2)} · Bs {order.totalBs?.toFixed(2)}
                </p>
              )}

              {/* BLOQUE DE PAGO EN REVISIÓN */}
              {esRevisionPago && (
                <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-sm space-y-2">
                  <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                    💳 Detalles del pago enviado por el cliente:
                  </p>

                  {notaCliente && (
                    <p className="text-ink/80 text-xs bg-white p-2.5 rounded border border-amber-100">
                      <span className="font-semibold">Referencia / Mensaje:</span> {notaCliente}
                    </p>
                  )}

                  {order.comprobanteUrl ? (
                    <a
                      href={order.comprobanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-leaf-600 underline text-xs font-medium hover:text-leaf-800"
                    >
                      🖼️ Ver captura / comprobante adjunto
                    </a>
                  ) : null}

                  {!notaCliente && !order.comprobanteUrl && (
                    <p className="text-xs text-ink/60 italic">El cliente no adjuntó archivo ni nota.</p>
                  )}

                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => cambiarEstado(order, "CONFIRMADO")}
                      className="px-3 py-1.5 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-700 transition-colors"
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

              {/* REGISTRO HISTÓRICO DISCRETO TRAS CONFIRMAR */}
              {!esRevisionPago && (notaCliente || order.comprobanteUrl) && (
                <div className="mt-3 pt-2 border-t border-leaf-50 flex items-center justify-between text-xs text-ink/60">
                  <span>
                    {notaCliente ? `Ref: ${notaCliente}` : "Comprobante verificado"}
                  </span>
                  {order.comprobanteUrl && (
                    <a
                      href={order.comprobanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-leaf-600 underline hover:text-leaf-800"
                    >
                      Ver comprobante
                    </a>
                  )}
                </div>
              )}

              {/* ACCIONES DE ESTADO SIGUIENTES */}
              {order.estado === "CONFIRMADO" && (
                <button
                  onClick={() => cambiarEstado(order, "EN_PREPARACION")}
                  className="mt-3 px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-700 transition-colors"
                >
                  Pasar a preparación
                </button>
              )}

              {order.estado === "EN_PREPARACION" && (
                <button
                  onClick={() => cambiarEstado(order, "ENTREGADO")}
                  className="mt-3 px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-700 transition-colors"
                >
                  Marcar como entregado
                </button>
              )}
            </div>
          );
        })}

        {orders.length === 0 && <p className="text-ink/60">No hay pedidos todavía.</p>}
      </div>
    </div>
  );
}