"use client";

import { useEffect, useState } from "react";
import { formatCantidad } from "@/lib/peso";
import { fechaVenezolana, formatFechaHoraVzla } from "@/lib/timezone";

type OrderItem = {
  id: string;
  cantidad: number;
  cantidadOriginal?: number | null;
  precioUsd: number;
  disponible: boolean | null;
  product: { nombre: string; porPeso?: boolean };
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
  origen?: string;
  // Si el pedido lo hizo un cliente con cuenta (clienteId no nulo), o fue
  // como invitado sin registrarse (clienteId null).
  clienteId?: string | null;
  esCredito?: boolean;
  creditoPagado?: boolean;
  createdAt: string;
  // Se llena cuando el pedido llega a "ENTREGADO" (ver /api/orders/[id]).
  // Sirve para calcular el tiempo real que tardó la entrega.
  entregadoAt?: string | null;
  items?: OrderItem[];
};

const ETIQUETAS: Record<string, string> = {
  PENDIENTE_VERIFICACION: "Por verificar stock",
  ESPERANDO_PAGO: "Esperando pago",
  PAGO_RECIBIDO: "Pago en revisión",
  PAGO_EN_REVISION: "Pago en revisión",
  CONFIRMADO: "Pago confirmado",
  EN_PREPARACION: "En preparación",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado"
};

const COLORES: Record<string, string> = {
  PENDIENTE_VERIFICACION: "bg-clay-100 text-clay-600",
  ESPERANDO_PAGO: "bg-clay-100 text-clay-600",
  PAGO_RECIBIDO: "bg-amber-100 text-amber-800 border border-amber-200",
  PAGO_EN_REVISION: "bg-amber-100 text-amber-800 border border-amber-200",
  CONFIRMADO: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  EN_PREPARACION: "bg-sky-100 text-sky-800 border border-sky-200",
  EN_CAMINO: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  ENTREGADO: "bg-leaf-100 text-leaf-800 border border-leaf-200",
  CANCELADO: "bg-alert-100 text-alert-600 border border-alert-200"
};

// El sonido de alerta y las notificaciones de escritorio ahora viven en
// AdminNav (barra superior, montada en toda la sección /admin), para que
// avisen sin importar en qué pantalla del admin esté el personal. Aquí
// solo queda la lógica propia de esta pantalla (cargar/editar pedidos).

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [conectado, setConectado] = useState(false);
  // Rol del personal logueado: "cancelar pedido" y "eliminar pedido" son
  // acciones solo del dueño ("admin"), no del empleado de delivery. Se
  // consulta al servidor porque la cookie de sesión es httpOnly y no se
  // puede leer directo desde el navegador.
  const [rol, setRol] = useState<"admin" | "delivery" | null>(null);
  const [eliminandoPedidoId, setEliminandoPedidoId] = useState<string | null>(null);
  const [cancelandoPedidoId, setCancelandoPedidoId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/staff/rol")
      .then((r) => r.json())
      .then((d) => setRol(d.role ?? null))
      .catch(() => setRol(null));
  }, []);
  // Cambios de "disponible" que el admin ya marcó en pantalla pero
  // todavía no ha guardado con "Confirmar disponibilidad". Se guardan
  // aparte (orderId -> itemId -> valor) para que el refresco automático
  // (polling cada 6s, o un pedido nuevo llegando por el stream) no los
  // pise, que era la causa de que el checkbox pareciera "desmarcarse solo".
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState<Record<string, Record<string, boolean>>>({});

  // Igual que cambiosSinGuardar pero para la cantidad/peso real que el
  // admin corrige cuando el stock real no coincide con lo pedido (ej.
  // pidieron 3 mayonesas y solo hay 1, o pidieron 200g de queso y al pesar
  // salieron 220g). Se guarda aparte por la misma razón: que el refresco
  // automático no pise un cambio que el admin todavía no guardó.
  const [cambiosCantidad, setCambiosCantidad] = useState<Record<string, Record<string, number>>>({});

  // Interruptor "atendiendo en tienda" (antes vivía en Configuración).
  // Lo opera el empleado de delivery desde acá, junto al resto de su trabajo
  // del día, sin necesitar acceso a la pantalla de Configuración/Productos.
  const [pedidosHabilitados, setPedidosHabilitados] = useState<boolean>(true);
  const [cambiandoPedidos, setCambiandoPedidos] = useState(false);
  const [mensajeEstadoTienda, setMensajeEstadoTienda] = useState("");

  // Filtro por estado en la lista de pedidos: "TODOS" o un estado puntual
  // (pendiente por pago, en camino, entregado, cancelado, etc.) para que el
  // empleado ubique rápido lo que necesita sin desplazarse por todo el día.
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");

  // Filtro por día (hora de Venezuela). "" = todos los días. El valor
  // coincide con el formato de <input type="date"> (YYYY-MM-DD).
  const [filtroFecha, setFiltroFecha] = useState<string>("");

  // Cronómetro de entrega: desde que se crea el pedido hasta que se marca
  // "Entregado". Para los pedidos todavía activos se muestra corriendo en
  // vivo (por eso este "reloj" que se actualiza cada segundo); para los ya
  // entregados se congela en el tiempo real que tardó.
  const [ahora, setAhora] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function formatDuracion(ms: number): string {
    const totalSeg = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setPedidosHabilitados(d.pedidosHabilitados ?? true))
      .catch(() => { });
  }, []);

  async function alternarPedidosHabilitados() {
    const nuevoValor = !pedidosHabilitados;
    setCambiandoPedidos(true);
    setMensajeEstadoTienda("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidosHabilitados: nuevoValor })
      });
      if (res.ok) {
        const data = await res.json();
        setPedidosHabilitados(data.pedidosHabilitados);
        setMensajeEstadoTienda(
          data.pedidosHabilitados
            ? "Pedidos habilitados: los clientes ya pueden pedir."
            : "Pedidos deshabilitados: los clientes verán el aviso de horario y no podrán pedir."
        );
      } else {
        setMensajeEstadoTienda("No se pudo actualizar el interruptor de pedidos.");
      }
    } catch (e) {
      console.error("Error al actualizar pedidosHabilitados:", e);
      setMensajeEstadoTienda("No se pudo actualizar el interruptor de pedidos.");
    } finally {
      setCambiandoPedidos(false);
    }
  }

  // Carga de pedidos desactivando el caché HTTP
  async function cargar() {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (e) {
      console.error("Error al cargar pedidos:", e);
      setOrders([]);
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
        cargar();
      });

      eventSource.addEventListener("pedido_actualizado", (event: MessageEvent) => {
        if (event.data) {
          try {
            const updatedOrder: Order = JSON.parse(event.data);
            setOrders((prev) =>
              (prev || []).map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
            );
          } catch {
            cargar();
          }
        } else {
          cargar();
        }
      });

      eventSource.addEventListener("pedido_eliminado", (event: MessageEvent) => {
        if (event.data) {
          try {
            const { id } = JSON.parse(event.data) as { id: string };
            setOrders((prev) => (prev || []).filter((o) => o.id !== id));
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

    // Respaldo por si el stream en vivo no llega a avisar (por ejemplo, si
    // la app corre en varias instancias/serverless y el aviso se genera en
    // una instancia distinta a la que tiene esta pestaña conectada). Así el
    // comprobante y cualquier cambio de estado siempre terminan apareciendo
    // solos, sin que el admin tenga que refrescar la página a mano.
    const polling = setInterval(cargar, 6000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(polling);
    };
  }, []);

  function toggleDisponible(order: Order, itemId: string, value: boolean) {
    setCambiosSinGuardar((prev) => ({
      ...prev,
      [order.id]: { ...(prev[order.id] || {}), [itemId]: value }
    }));
  }

  // Valor a mostrar en el checkbox: prioriza el cambio sin guardar (si el
  // admin ya lo tocó) sobre lo que diga el servidor, para que el
  // refresco automático nunca borre un cambio que aún no se guardó.
  function disponibleMostrado(order: Order, item: OrderItem): boolean {
    const pendiente = cambiosSinGuardar[order.id]?.[item.id];
    return pendiente !== undefined ? pendiente : !!item.disponible;
  }

  function actualizarCantidad(order: Order, itemId: string, value: number) {
    setCambiosCantidad((prev) => ({
      ...prev,
      [order.id]: { ...(prev[order.id] || {}), [itemId]: value }
    }));
  }

  // Cantidad/peso real a mostrar en el campo editable: prioriza el cambio
  // sin guardar sobre lo pedido originalmente, igual que con "disponible".
  function cantidadMostrada(order: Order, item: OrderItem): number {
    const pendiente = cambiosCantidad[order.id]?.[item.id];
    return pendiente !== undefined ? pendiente : item.cantidad;
  }

  async function guardarDisponibilidad(order: Order) {
    try {
      const itemsList = order.items || [];
      const pendientesDisponible = cambiosSinGuardar[order.id] || {};
      const pendientesCantidad = cambiosCantidad[order.id] || {};
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsList.map((i) => ({
            id: i.id,
            disponible: pendientesDisponible[i.id] !== undefined ? pendientesDisponible[i.id] : !!i.disponible,
            cantidad: pendientesCantidad[i.id] !== undefined ? pendientesCantidad[i.id] : i.cantidad
          }))
        })
      });
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmar_disponibilidad" })
      });
      const data = await res.json();

      // Ya se guardó en el servidor: soltamos los cambios pendientes de
      // este pedido para que vuelva a reflejar lo que diga el servidor.
      setCambiosSinGuardar((prev) => {
        const { [order.id]: _quitar, ...resto } = prev;
        return resto;
      });
      setCambiosCantidad((prev) => {
        const { [order.id]: _quitar, ...resto } = prev;
        return resto;
      });

      if (data.order) {
        setOrders((prev) => (prev || []).map((o) => (o.id === order.id ? data.order : o)));
      }
      cargar();
    } catch (e) {
      console.error("Error al guardar disponibilidad:", e);
      cargar();
    }
  }

  async function cambiarEstado(order: Order, nuevoEstado: string) {
    setOrders((prev) =>
      (prev || []).map((o) => (o.id === order.id ? { ...o, estado: nuevoEstado } : o))
    );

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      const data = await res.json();

      if (data.order) {
        setOrders((prev) => (prev || []).map((o) => (o.id === order.id ? data.order : o)));
      } else {
        cargar();
      }
    } catch (e) {
      console.error("Error al cambiar estado:", e);
      cargar();
    }
  }

  async function rechazarPago(order: Order) {
    setOrders((prev) =>
      (prev || []).map((o) =>
        o.id === order.id ? { ...o, estado: "ESPERANDO_PAGO", comprobanteUrl: null } : o
      )
    );

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rechazar_pago" })
      });
      const data = await res.json();

      if (data.order) {
        setOrders((prev) => (prev || []).map((o) => (o.id === order.id ? data.order : o)));
      } else {
        cargar();
      }
    } catch (e) {
      console.error("Error al rechazar pago:", e);
      cargar();
    }
  }

  // Pedido a crédito: la tienda marca que ya cobró la deuda. No cambia el
  // estado de preparación/entrega, es solo un registro de cobranza.
  async function marcarCreditoPagado(order: Order) {
    setOrders((prev) =>
      (prev || []).map((o) => (o.id === order.id ? { ...o, creditoPagado: true } : o))
    );

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "marcar_credito_pagado" })
      });
      const data = await res.json();

      if (data.order) {
        setOrders((prev) => (prev || []).map((o) => (o.id === order.id ? data.order : o)));
      } else {
        cargar();
      }
    } catch (e) {
      console.error("Error al marcar el crédito como pagado:", e);
      cargar();
    }
  }

  // Cancela un pedido sin importar su estado actual (solo dueño). A
  // diferencia de "cambiarEstado", esto está pensado para poder frenar un
  // pedido en cualquier punto del flujo, no solo en los pasos previstos.
  async function cancelarPedidoDueno(order: Order) {
    if (!window.confirm(`¿Cancelar el pedido de ${order.clienteNombre}? Esta acción se puede hacer en cualquier momento.`)) {
      return;
    }
    setCancelandoPedidoId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelar_pedido_dueno" })
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setOrders((prev) => (prev || []).map((o) => (o.id === order.id ? data.order : o)));
      } else {
        alert(data.error || "No se pudo cancelar el pedido.");
      }
    } catch (e) {
      console.error("Error al cancelar pedido:", e);
      alert("Ocurrió un error al cancelar el pedido.");
    } finally {
      setCancelandoPedidoId(null);
    }
  }

  // Elimina el pedido definitivamente (borra también su historial). Se
  // pide confirmar el nombre del cliente para evitar un borrado accidental,
  // ya que a diferencia de cancelar, esto no se puede deshacer.
  async function eliminarPedido(order: Order) {
    if (
      !window.confirm(
        `Esto va a ELIMINAR para siempre el pedido de ${order.clienteNombre} (no se puede deshacer). ¿Continuar?`
      )
    ) {
      return;
    }
    setEliminandoPedidoId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      if (res.ok) {
        setOrders((prev) => (prev || []).filter((o) => o.id !== order.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo eliminar el pedido.");
      }
    } catch (e) {
      console.error("Error al eliminar pedido:", e);
      alert("Ocurrió un error al eliminar el pedido.");
    } finally {
      setEliminandoPedidoId(null);
    }
  }

  const safeOrders = Array.isArray(orders) ? orders : [];
  const ordenesFiltradas = safeOrders
    .filter((o) => filtroEstado === "TODOS" || o.estado === filtroEstado)
    .filter((o) => !filtroFecha || fechaVenezolana(o.createdAt) === filtroFecha);

  // Opciones del filtro: "Todos" primero, y solo los estados que realmente
  // se usan en el flujo (ver ETIQUETAS arriba), en el orden en que avanza
  // un pedido normal.
  const OPCIONES_FILTRO = [
    "TODOS",
    "PENDIENTE_VERIFICACION",
    "ESPERANDO_PAGO",
    "PAGO_EN_REVISION",
    "CONFIRMADO",
    "EN_PREPARACION",
    "EN_CAMINO",
    "ENTREGADO",
    "CANCELADO"
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl text-leaf-800">Pedidos</h1>
        <span className={`text-xs flex items-center gap-1.5 ${conectado ? "text-leaf-600" : "text-alert-600"}`}>
          <span className={`w-2 h-2 rounded-full ${conectado ? "bg-leaf-600 animate-pulse" : "bg-alert-600"}`} />
          {conectado ? "Recibiendo pedidos en vivo" : "Sin conexión — reintentando…"}
        </span>
      </div>

      {/* INTERRUPTOR: ABRIR/CERRAR PEDIDOS ("atendiendo en tienda") */}
      <div
        className={`flex items-center justify-between gap-4 rounded-lg border p-4 mb-6 ${pedidosHabilitados
            ? "bg-leaf-50 border-leaf-100"
            : "bg-alert-50 border-alert-200"
          }`}
      >
        <div>
          <p className={`font-medium ${pedidosHabilitados ? "text-leaf-800" : "text-alert-700"}`}>
            {pedidosHabilitados ? "Recibiendo pedidos" : "Pedidos deshabilitados"}
          </p>
          <p className="text-xs text-ink/60 mt-0.5">
            {pedidosHabilitados
              ? "Los clientes pueden agregar productos y completar el pago."
              : "Los clientes verán el aviso de horario y no podrán completar un pedido. El catálogo y el registro de cuentas nuevas siguen funcionando."}
          </p>
        </div>
        <button
          onClick={alternarPedidosHabilitados}
          disabled={cambiandoPedidos}
          role="switch"
          aria-checked={pedidosHabilitados}
          className={`shrink-0 relative w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${pedidosHabilitados ? "bg-leaf-600" : "bg-ink/20"
            }`}
        >
          <span
            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${pedidosHabilitados ? "translate-x-6" : "translate-x-0"
              }`}
          />
        </button>
      </div>
      {mensajeEstadoTienda && <p className="text-sm mb-4 text-leaf-600">{mensajeEstadoTienda}</p>}

      {/* FILTRO POR ESTADO */}
      <div className="flex flex-wrap gap-2 mb-3">
        {OPCIONES_FILTRO.map((op) => {
          const activo = filtroEstado === op;
          const cantidad = op === "TODOS" ? safeOrders.length : safeOrders.filter((o) => o.estado === op).length;
          return (
            <button
              key={op}
              onClick={() => setFiltroEstado(op)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${activo
                  ? "bg-leaf-600 text-white border-leaf-600"
                  : "bg-white text-ink/70 border-leaf-100 hover:border-leaf-300"
                }`}
            >
              {op === "TODOS" ? "Todos" : ETIQUETAS[op] ?? op} ({cantidad})
            </button>
          );
        })}
      </div>

      {/* FILTRO POR DÍA (hora de Venezuela) */}
      <div className="flex items-center gap-2 mb-6">
        <label className="text-xs text-ink/50">Ver pedidos del día:</label>
        <input
          type="date"
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
          className="border border-leaf-100 rounded-lg px-2.5 py-1.5 text-sm"
        />
        {filtroFecha && (
          <button onClick={() => setFiltroFecha("")} className="text-xs text-leaf-600 underline">
            Quitar filtro
          </button>
        )}
      </div>

      <div className="space-y-4">
        {ordenesFiltradas.length === 0 && (
          <p className="text-sm text-ink/50 text-center py-8">No hay pedidos con este filtro.</p>
        )}
        {ordenesFiltradas.map((order) => {
          const items = Array.isArray(order?.items) ? order.items : [];
          const notaCliente = order?.notaPago || order?.nota || order?.referencia;
          const esRevisionPago = order?.estado === "PAGO_RECIBIDO" || order?.estado === "PAGO_EN_REVISION";

          return (
            <div key={order.id} className="bg-white border border-leaf-100 rounded-lg p-4 shadow-sm">
              <div className="flex flex-wrap gap-2 justify-between items-start mb-2">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-1.5 flex-wrap">
                    {order.clienteNombre}
                    {order.clienteId ? (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-leaf-100 text-leaf-700 font-medium">
                        👤 Registrado
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-ink/5 text-ink/50 font-medium">
                        🕶️ Invitado
                      </span>
                    )}
                    {order.origen === "LLAMADA" && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                        📞 Por llamada
                      </span>
                    )}
                    {order.esCredito && (
                      <span
                        className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${order.creditoPagado
                            ? "bg-leaf-100 text-leaf-700"
                            : "bg-clay-100 text-clay-600"
                          }`}
                      >
                        {order.creditoPagado ? "🤝 Crédito cobrado" : "🤝 Crédito pendiente"}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink/60">
                    {order.clienteTelefono} · {order.direccion}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${COLORES[order.estado] ?? "bg-clay-100 text-clay-600"}`}
                  >
                    {ETIQUETAS[order.estado] ?? order.estado}
                  </span>

                  {/* Acciones solo del dueño: cancelar o eliminar el pedido
                      en cualquier momento, sin importar el estado. El
                      empleado de delivery no ve estos botones. */}
                  {rol === "admin" && (
                    <div className="flex gap-1.5">
                      {order.estado !== "CANCELADO" && (
                        <button
                          onClick={() => cancelarPedidoDueno(order)}
                          disabled={cancelandoPedidoId === order.id}
                          className="text-[11px] px-2 py-1 rounded-lg border border-clay-500 text-clay-600 font-medium hover:bg-clay-50 disabled:opacity-40 transition-colors"
                          title="Cancelar este pedido en cualquier momento"
                        >
                          {cancelandoPedidoId === order.id ? "..." : "Cancelar"}
                        </button>
                      )}
                      <button
                        onClick={() => eliminarPedido(order)}
                        disabled={eliminandoPedidoId === order.id}
                        className="text-[11px] px-2 py-1 rounded-lg border border-alert-600 text-alert-600 font-medium hover:bg-alert-50 disabled:opacity-40 transition-colors"
                        title="Eliminar este pedido definitivamente"
                      >
                        {eliminandoPedidoId === order.id ? "..." : "Eliminar"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {order.estado !== "CANCELADO" ? (
                <p className="text-xs text-ink/50 mb-2">
                  {order.estado === "ENTREGADO" && order.entregadoAt ? (
                    <>⏱ Entregado en {formatDuracion(new Date(order.entregadoAt).getTime() - new Date(order.createdAt).getTime())}</>
                  ) : (
                    <>⏱ Tiempo transcurrido: {formatDuracion(ahora - new Date(order.createdAt).getTime())}</>
                  )}
                  {" · "}
                  {formatFechaHoraVzla(order.createdAt)}
                </p>
              ) : (
                <p className="text-xs text-ink/50 mb-2">{formatFechaHoraVzla(order.createdAt)}</p>
              )}

              {order.esCredito && !order.creditoPagado && (
                <button
                  onClick={() => marcarCreditoPagado(order)}
                  className="mb-2 px-3 py-1.5 rounded-lg border border-clay-600 text-clay-600 text-xs font-medium hover:bg-clay-100 transition-colors"
                >
                  💵 Marcar crédito cobrado
                </button>
              )}

              <ul className="text-sm divide-y divide-leaf-50">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 gap-2">
                    <span className="min-w-0">
                      {item.product?.porPeso
                        ? formatCantidad(item.cantidad, true)
                        : `${item.cantidad}×`}{" "}
                      {item.product?.nombre ?? "Producto"}
                      {item.cantidadOriginal != null && (
                        <span className="block text-[10px] text-clay-600">
                          Ajustado (pedido:{" "}
                          {item.product?.porPeso
                            ? formatCantidad(item.cantidadOriginal, true)
                            : `${item.cantidadOriginal}×`}
                          )
                        </span>
                      )}
                    </span>
                    {order.estado === "PENDIENTE_VERIFICACION" ? (
                      <div className="shrink-0 flex items-center gap-2 sm:gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={disponibleMostrado(order, item)}
                            onChange={(e) => toggleDisponible(order, item.id, e.target.checked)}
                            className="rounded text-leaf-600 focus:ring-leaf-500"
                          />
                          <span className="text-xs">Disponible</span>
                        </label>
                        {disponibleMostrado(order, item) && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              step={item.product?.porPeso ? 0.05 : 1}
                              value={cantidadMostrada(order, item)}
                              onChange={(e) =>
                                actualizarCantidad(order, item.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-16 text-xs border border-leaf-100 rounded px-1.5 py-1 text-right focus:outline-none focus:border-leaf-500"
                              aria-label={`Cantidad real disponible de ${item.product?.nombre}`}
                              title="Editar si la cantidad/peso real disponible es distinta a lo pedido"
                            />
                            <span className="text-[10px] text-ink/40">
                              {item.product?.porPeso ? "kg" : "uds"}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={item.disponible ? "text-leaf-600 font-medium shrink-0" : "text-alert-600 font-medium shrink-0"}>
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

              {/* Confirmar pago recibido por otro medio (ej. WhatsApp) cuando
                  el pedido sigue "esperando pago" y el cliente nunca llegó a
                  subir el comprobante desde la app. */}
              {order.estado === "ESPERANDO_PAGO" && (
                <div className="mt-3 p-3 bg-sky-50/70 border border-sky-200 rounded-lg text-sm space-y-2">
                  <p className="text-ink/70 text-xs">
                    ¿El cliente envió el comprobante de pago por otro medio (WhatsApp, llamada, etc.)?
                  </p>
                  <button
                    onClick={() => {
                      if (window.confirm("¿Confirmar que el pago de este pedido fue recibido? El pedido pasará a preparación.")) {
                        cambiarEstado(order, "CONFIRMADO");
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-700 transition-colors"
                  >
                    💵 Confirmar pago recibido
                  </button>
                </div>
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
                      onClick={() => rechazarPago(order)}
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
                  onClick={() => cambiarEstado(order, "EN_CAMINO")}
                  className="mt-3 px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-700 transition-colors"
                >
                  Marcar como en camino
                </button>
              )}

              {order.estado === "EN_CAMINO" && (
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

        {safeOrders.length === 0 && <p className="text-ink/60">No hay pedidos todavía.</p>}
      </div>
    </div>
  );
}