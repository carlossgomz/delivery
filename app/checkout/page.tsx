"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Product = { id: string; nombre: string; precioUsd: number };
type CartLine = { productId: string; cantidad: number };
type Cliente = { id: string; nombre: string; telefono: string; direccion: string };
type OrderData = {
  id: string;
  estado: string;
  totalUsd: number | null;
  totalBs: number | null;
  items?: {
    productId: string;
    cantidad: number;
    disponible?: boolean | null;
    product?: { nombre: string };
  }[];
};

const CART_KEY = "delivery_cart";
const ACTIVE_ORDER_KEY = "active_order_id";

export default function CheckoutPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tasaCambio, setTasaCambio] = useState(0);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para comprobante o referencia/nota
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null);
  const [notaPago, setNotaPago] = useState("");

  // Cuando la tienda confirma disponibilidad y NO todo estaba disponible,
  // primero mostramos un resumen (qué sí / qué no) con tres salidas
  // (reemplazar, continuar solo con lo disponible o cancelar) antes de
  // dejar pasar a la pantalla de pago. Se reinicia cada vez que cambia el
  // pedido activo.
  const [continuarConParcial, setContinuarConParcial] = useState(false);
  useEffect(() => {
    setContinuarConParcial(false);
  }, [orderId]);

  // Trae el pedido completo (estado + totales) del servidor. Se usa tanto
  // al restaurar un pedido activo al entrar/volver a esta página, como en
  // cada vuelta del polling, para que la pantalla nunca dependa de datos
  // locales que puedan haberse perdido (ej. el carrito, que se limpia al
  // enviar el pedido).
  async function cargarOrden(id: string) {
    try {
      const res = await fetch(`/api/orders/${id}`);

      if (res.status === 404) {
        // El pedido guardado en este dispositivo ya no existe (se borró o
        // la base de datos se reinició). No lo dejamos bloqueando el
        // checkout para siempre: se limpia y vuelve a mostrar el formulario.
        localStorage.removeItem(ACTIVE_ORDER_KEY);
        setOrderId(null);
        setOrder(null);
        setEstado(null);
        return;
      }

      if (!res.ok) return;
      const data = await res.json();
      if (data?.order) {
        setOrder(data.order);
        setEstado(data.order.estado);
      }
    } catch (err) {
      console.error("Error al consultar el pedido:", err);
    }
  }

  // 1. Cargar productos, config y restaurar orden activa si existe
  useEffect(() => {
    async function load() {
      try {
        const [pRes, cRes, meRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/config"),
          fetch("/api/clientes/me"),
        ]);

        if (pRes.ok) {
          const pData = await pRes.json();
          setProducts(pData.products || []);
        }

        if (cRes.ok) {
          const cData = await cRes.json();
          setTasaCambio(cData.tasaCambio || 0);
        }

        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.cliente) {
            setCliente(meData.cliente);
            setNombre(meData.cliente.nombre);
            setTelefono(meData.cliente.telefono);
            setDireccion(meData.cliente.direccion);
          }
        }

        const savedCart = localStorage.getItem(CART_KEY);
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }

        const savedOrder = localStorage.getItem(ACTIVE_ORDER_KEY);
        if (savedOrder) {
          setOrderId(savedOrder);
          // No esperamos al polling: se consulta de una vez para que la
          // pantalla de pago aparezca al instante, sin pantalla en blanco.
          cargarOrden(savedOrder);
        }
      } catch (err) {
        console.error("Error al cargar datos iniciales:", err);
      } finally {
        setLoadingConfig(false);
      }
    }
    load();
  }, []);

  // 2. Polling de la orden — se actualiza sola cada pocos segundos sin que
  // el cliente tenga que recargar la página.
  useEffect(() => {
    if (!orderId) return;

    const terminalStates = [
      "PAGO_RECIBIDO",
      "PAGO_EN_REVISION",
      "CONFIRMADO",
      "EN_PREPARACION",
      "CANCELADO",
    ];

    if (estado && terminalStates.includes(estado)) {
      return;
    }

    const interval = setInterval(() => {
      cargarOrden(orderId);
    }, 4000);

    return () => clearInterval(interval);
  }, [orderId, estado]);

  const totalUsd = cart.reduce((sum, l) => {
    const p = products.find((pr) => pr.id === l.productId);
    return sum + (p ? p.precioUsd * l.cantidad : 0);
  }, 0);

  // Una vez la tienda confirma disponibilidad, si algún artículo no estaba
  // disponible mostramos primero un resumen de qué sí / qué no llegó,
  // antes de dejar pasar a la pantalla de pago.
  const itemsNoDisponibles = (order?.items ?? []).filter((it) => it.disponible === false);
  const itemsDisponibles = (order?.items ?? []).filter((it) => it.disponible !== false);
  const hayNoDisponibles = itemsNoDisponibles.length > 0;
  const mostrarVerificacionParcial =
    estado === "ESPERANDO_PAGO" && hayNoDisponibles && !continuarConParcial;

  async function enviarPedido() {
    setErrorMsg(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: nombre,
          clienteTelefono: telefono,
          direccion,
          items: cart,
        }),
      });

      if (!res.ok) {
        throw new Error("No se pudo procesar el pedido. Inténtalo de nuevo.");
      }

      const data = await res.json();
      if (data?.order?.id) {
        setOrderId(data.order.id);
        setOrder(data.order);
        setEstado(data.order.estado);
        localStorage.setItem(ACTIVE_ORDER_KEY, data.order.id);
        localStorage.removeItem(CART_KEY);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al enviar el pedido");
    } finally {
      setEnviando(false);
    }
  }

  async function procesarPago() {
    if (!orderId) return;
    setEnviando(true);
    setErrorMsg(null);

    let url = "";

    // Subida de imagen a Vercel Blob
    if (archivoComprobante) {
      try {
        const formData = new FormData();
        formData.append("file", archivoComprobante);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          url = uploadData.url;
        } else {
          throw new Error(uploadData.error || "Fallo al subir el archivo de comprobante");
        }
      } catch (err: any) {
        console.error("Error al subir comprobante:", err);
        setErrorMsg(err.message || "No se pudo subir la imagen del comprobante.");
        setEnviando(false);
        return;
      }
    }

    const textoNota = notaPago.trim();

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "PAGO_RECIBIDO",
          comprobanteUrl: url !== "" ? url : null,
          notaPago: textoNota !== "" ? textoNota : null,
          nota: textoNota !== "" ? textoNota : null,
          referencia: textoNota !== "" ? textoNota : null,
        }),
      });

      if (!res.ok) {
        throw new Error("Error registrando la información del pago.");
      }

      const data = await res.json();
      if (data?.order) {
        setOrder(data.order);
        setEstado(data.order.estado);
      } else {
        setEstado("PAGO_RECIBIDO");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el pago");
    } finally {
      setEnviando(false);
    }
  }

  // El cliente todavía no ha terminado de pagar y quiere agregar algo que
  // se le olvidó: cancelamos este pedido pendiente pero le devolvemos sus
  // artículos al carrito para que arme uno nuevo con todo junto.
  async function agregarMasArticulos() {
    if (!orderId) return;
    setEnviando(true);
    try {
      if (order?.items?.length) {
        const cartRestaurado: CartLine[] = order.items.map((it) => ({
          productId: it.productId,
          cantidad: it.cantidad
        }));
        localStorage.setItem(CART_KEY, JSON.stringify(cartRestaurado));
      }
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelar_cliente" })
      });
    } catch (err) {
      console.error("Error al cancelar el pedido para agregar más artículos:", err);
    } finally {
      localStorage.removeItem(ACTIVE_ORDER_KEY);
      setEnviando(false);
      router.push("/");
    }
  }

  // La tienda marcó algunos artículos como no disponibles. El cliente
  // prefiere reemplazarlos: se cancela este pedido y vuelve al catálogo
  // con el carrito tal cual como lo pidió, pero sin los artículos que no
  // había — así puede agregar algo distinto en su lugar sin tener que
  // volver a armar todo el pedido desde cero.
  async function reemplazarArticulo() {
    if (!orderId) return;
    setEnviando(true);
    try {
      const disponibles = (order?.items ?? []).filter((it) => it.disponible !== false);
      const cartRestaurado: CartLine[] = disponibles.map((it) => ({
        productId: it.productId,
        cantidad: it.cantidad
      }));
      localStorage.setItem(CART_KEY, JSON.stringify(cartRestaurado));
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelar_cliente" })
      });
    } catch (err) {
      console.error("Error al cancelar el pedido para reemplazar un artículo:", err);
    } finally {
      localStorage.removeItem(ACTIVE_ORDER_KEY);
      setEnviando(false);
      router.push("/");
    }
  }

  // El cliente ya no quiere hacer el pedido.
  async function rechazarPedido() {
    if (!orderId) return;
    setEnviando(true);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelar_cliente" })
      });
    } catch (err) {
      console.error("Error al cancelar el pedido:", err);
    } finally {
      localStorage.removeItem(ACTIVE_ORDER_KEY);
      localStorage.removeItem(CART_KEY);
      setEnviando(false);
      router.push("/");
    }
  }

  // --- VISTA PANTALLA DE ESTADO DE ORDEN ---
  if (orderId) {
    return (
      <main className="max-w-md mx-auto px-4 py-10 text-center">
        <div className="flex justify-start mb-4">
          <Link href="/" className="text-sm text-leaf-600 underline">
            ← Volver al catálogo
          </Link>
        </div>
        <h1 className="font-display text-xl text-leaf-800 mb-2">Pedido enviado</h1>
        <p className="text-ink/70 mb-6">Número de pedido: {orderId.slice(0, 8)}</p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            {errorMsg}
          </div>
        )}

        {!estado && (
          <div className="text-ink/60">
            <p className="animate-pulse mb-4">Consultando tu pedido…</p>
            <button
              onClick={() => {
                localStorage.removeItem(ACTIVE_ORDER_KEY);
                router.push("/");
              }}
              className="text-sm text-leaf-600 underline"
            >
              ¿No carga? Empezar un pedido nuevo
            </button>
          </div>
        )}

        {estado === "PENDIENTE_VERIFICACION" && (
          <p className="text-clay-600 animate-pulse">
            La tienda está confirmando qué productos tiene disponibles…
          </p>
        )}

        {mostrarVerificacionParcial && (
          <div className="text-left bg-white rounded-lg border border-leaf-100 p-4 space-y-4 shadow-sm">
            <p className="text-sm text-ink/80 font-medium">
              La tienda ya revisó tu pedido. Algunos artículos no estaban disponibles:
            </p>

            {itemsDisponibles.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-leaf-700 mb-1">✅ Sí están disponibles</p>
                <ul className="text-sm text-ink/80 space-y-1">
                  {itemsDisponibles.map((it) => (
                    <li key={it.productId}>
                      {it.cantidad}× {it.product?.nombre ?? "Producto"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-alert-600 mb-1">✖ No están disponibles</p>
              <ul className="text-sm text-ink/80 space-y-1">
                {itemsNoDisponibles.map((it) => (
                  <li key={it.productId}>
                    {it.cantidad}× {it.product?.nombre ?? "Producto"}
                  </li>
                ))}
              </ul>
            </div>

            {itemsDisponibles.length > 0 && (
              <div className="p-3 bg-leaf-100/30 rounded-lg border border-leaf-100">
                <p className="text-xs text-ink/60">Total si continúas solo con lo disponible:</p>
                <p className="text-lg font-bold text-leaf-800">
                  Bs {(order?.totalBs ?? 0).toFixed(2)}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              {itemsDisponibles.length > 0 && (
                <button
                  disabled={enviando}
                  onClick={() => setContinuarConParcial(true)}
                  className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium hover:bg-leaf-800 transition-colors disabled:opacity-40"
                >
                  ✅ Continuar solo con lo disponible
                </button>
              )}
              <button
                disabled={enviando}
                onClick={reemplazarArticulo}
                className="w-full py-3 rounded-lg border border-leaf-600 text-leaf-600 font-medium hover:bg-leaf-50 transition-colors disabled:opacity-40"
              >
                🔄 Reemplazar artículo (volver al catálogo)
              </button>
              <button
                disabled={enviando}
                onClick={rechazarPedido}
                className="w-full py-3 rounded-lg border border-alert-600 text-alert-600 font-medium hover:bg-alert-50 transition-colors disabled:opacity-40"
              >
                Cancelar pedido
              </button>
            </div>
          </div>
        )}

        {estado === "ESPERANDO_PAGO" && !mostrarVerificacionParcial && (
          <div className="text-left bg-white rounded-lg border border-leaf-100 p-4 space-y-4 shadow-sm">
            <p className="text-sm text-ink/80 font-medium">
              ¡Tu pedido está listo! 🎉 Realiza tu Pago Móvil y confirma tu compra a continuación.
            </p>

            {/* Monto total */}
            <div className="p-3 bg-leaf-100/30 rounded-lg border border-leaf-100">
              <p className="text-xs text-ink/60">Monto total a pagar:</p>
              <p className="text-lg font-bold text-leaf-800">
                Bs {(order?.totalBs ?? totalUsd * tasaCambio).toFixed(2)}
              </p>
            </div>

            {/* DATOS DE PAGO MÓVIL */}
            <div className="p-3 bg-leaf-50/50 rounded-lg border border-leaf-100 text-xs text-ink/90 space-y-1.5">
              <p className="font-bold text-leaf-800 flex items-center gap-1 text-sm mb-1">
                📲 Datos para Pago Móvil
              </p>
              <p><span className="font-semibold text-leaf-800">🏛️ Banco:</span> Banesco (0134)</p>
              <p><span className="font-semibold text-leaf-800">📱 Teléfono:</span> 0426-6215863</p>
              <p><span className="font-semibold text-leaf-800">🪪 Cédula:</span> V-10073649</p>
            </div>

            {/* OPCIÓN 1: Subir imagen */}
            <div>
              <label className="block text-xs text-ink/70 mb-1">
                🖼️ Adjuntar capture del comprobante (opcional):
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setArchivoComprobante(e.target.files?.[0] || null)}
                className="block w-full text-sm text-ink/70 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-leaf-600 file:text-white hover:file:bg-leaf-800 cursor-pointer"
              />
            </div>

            {/* OPCIÓN 2: Texto / Referencia */}
            <div>
              <label className="block text-xs text-ink/70 mb-1">
                💬 O escribe aquí el N° de referencia o mensaje:
              </label>
              <input
                type="text"
                placeholder="Ej: Ref #123456 o pago enviado por mensaje"
                value={notaPago}
                onChange={(e) => setNotaPago(e.target.value)}
                className="w-full text-sm border border-leaf-100 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-leaf-600"
              />
            </div>

            <button
              disabled={enviando}
              onClick={procesarPago}
              className="w-full mt-2 py-3 rounded-lg bg-leaf-600 text-white font-medium hover:bg-leaf-800 transition-colors disabled:opacity-40"
            >
              {enviando ? "Procesando pago…" : "Finalizar compra ✨"}
            </button>
          </div>
        )}

        {/* Mientras el pedido no se ha pagado, el cliente puede agregar
            algo que se le olvidó o simplemente no seguir con la compra.
            (Si hay disponibilidad parcial sin resolver, esas opciones ya
            las da la pantalla de arriba, así que no se duplican aquí.) */}
        {(estado === "PENDIENTE_VERIFICACION" ||
          (estado === "ESPERANDO_PAGO" && !mostrarVerificacionParcial)) && (
          <div className="mt-4 flex flex-col gap-2">
            <button
              disabled={enviando}
              onClick={agregarMasArticulos}
              className="w-full py-3 rounded-lg border border-leaf-600 text-leaf-600 font-medium hover:bg-leaf-50 transition-colors disabled:opacity-40"
            >
              ➕ Se me olvidó algo, agregar más artículos
            </button>
            <button
              disabled={enviando}
              onClick={rechazarPedido}
              className="w-full py-3 rounded-lg border border-alert-600 text-alert-600 font-medium hover:bg-alert-50 transition-colors disabled:opacity-40"
            >
              Ya no quiero hacer este pedido
            </button>
          </div>
        )}

        {/* PANTALLA DE PAGO RECIBIDO */}
        {(estado === "PAGO_RECIBIDO" || estado === "PAGO_EN_REVISION") && (
          <div className="bg-white rounded-lg border border-leaf-100 p-6 space-y-4 shadow-sm">
            <div className="text-4xl">🛍️✨</div>
            <h2 className="text-lg font-bold text-leaf-800">¡Compra realizada con éxito!</h2>
            <p className="text-sm text-ink/70">
              Hemos recibido la información de tu pago. La tienda está verificando los detalles para comenzar a preparar tu pedido.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem(ACTIVE_ORDER_KEY);
                router.push("/");
              }}
              className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium hover:bg-leaf-800 transition-colors"
            >
              Volver al catálogo
            </button>
          </div>
        )}

        {(estado === "CONFIRMADO" || estado === "EN_PREPARACION") && (
          <div className="bg-white rounded-lg border border-leaf-100 p-6 space-y-4 shadow-sm">
            <p className="text-leaf-600 font-medium">✅ Pago confirmado. Tu pedido está en preparación.</p>
            <button
              onClick={() => {
                localStorage.removeItem(ACTIVE_ORDER_KEY);
                router.push("/");
              }}
              className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium hover:bg-leaf-800 transition-colors"
            >
              Volver al catálogo
            </button>
          </div>
        )}

        {estado === "EN_CAMINO" && (
          <div className="bg-white rounded-lg border border-leaf-100 p-6 space-y-4 shadow-sm">
            <p className="text-leaf-600 font-medium">🛵 ¡Tu pedido va en camino!</p>
            <button
              onClick={() => {
                localStorage.removeItem(ACTIVE_ORDER_KEY);
                router.push("/");
              }}
              className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium hover:bg-leaf-800 transition-colors"
            >
              Volver al catálogo
            </button>
          </div>
        )}

        {estado === "ENTREGADO" && (
          <div className="bg-white rounded-lg border border-leaf-100 p-6 space-y-4 shadow-sm">
            <div className="text-4xl">✅</div>
            <p className="text-leaf-600 font-medium">¡Tu pedido fue entregado! Gracias por tu compra.</p>
            <button
              onClick={() => {
                localStorage.removeItem(ACTIVE_ORDER_KEY);
                router.push("/");
              }}
              className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium hover:bg-leaf-800 transition-colors"
            >
              Volver al catálogo
            </button>
          </div>
        )}

        {estado === "CANCELADO" && (
          <div className="bg-white rounded-lg border border-alert-100 p-6 space-y-4 shadow-sm">
            <p className="text-alert-600">
              Ningún producto del pedido quedó disponible o el pedido fue cancelado.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem(ACTIVE_ORDER_KEY);
                router.push("/");
              }}
              className="w-full py-3 rounded-lg border border-leaf-100 text-ink/80 font-medium"
            >
              Volver al catálogo
            </button>
          </div>
        )}

        {/* Red de seguridad: si el pedido quedó en un estado que esta
            pantalla no reconoce, igual dejamos una salida para que el
            cliente no se quede atascado sin poder hacer otro pedido. */}
        {estado &&
          ![
            "PENDIENTE_VERIFICACION",
            "ESPERANDO_PAGO",
            "PAGO_RECIBIDO",
            "PAGO_EN_REVISION",
            "CONFIRMADO",
            "EN_PREPARACION",
            "EN_CAMINO",
            "ENTREGADO",
            "CANCELADO",
          ].includes(estado) && (
            <div className="bg-white rounded-lg border border-leaf-100 p-6 space-y-4 shadow-sm">
              <p className="text-ink/70">Estado del pedido: {estado}</p>
              <button
                onClick={() => {
                  localStorage.removeItem(ACTIVE_ORDER_KEY);
                  router.push("/");
                }}
                className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium hover:bg-leaf-800 transition-colors"
              >
                Volver al catálogo
              </button>
            </div>
          )}
        <p className="mt-6 text-sm">
          <Link href="/mensajes" className="text-leaf-600 underline">
            💬 ¿Dudas? Escríbenos o llama a la tienda
          </Link>
        </p>
      </main>
    );
  }

  // --- VISTA FORMULARIO DATOS DE ENTREGA ---
  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <h1 className="font-display text-xl text-leaf-800 mb-2">Datos de entrega</h1>

      {cliente ? (
        <p className="text-sm text-ink/60 mb-6">
          Pedido a nombre de <span className="font-medium text-ink">{cliente.nombre}</span>.{" "}
          <Link href="/cliente" className="text-leaf-600 underline">
            Editar mis datos
          </Link>
        </p>
      ) : (
        <p className="text-sm text-ink/60 mb-6">
          <Link href="/registro" className="text-leaf-600 underline">
            Crea una cuenta
          </Link>{" "}
          para no volver a escribir tus datos, o continúa como invitado.
        </p>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-ink/70 mb-1">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
            placeholder="Tu nombre completo"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Teléfono</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
            placeholder="04121234567"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Dirección de entrega</label>
          <textarea
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
            placeholder="Dirección exacta, punto de referencia..."
          />
        </div>

        <div className="pt-2 border-t border-leaf-100">
          <p className="text-sm text-ink/60">Total estimado (sujeto a disponibilidad)</p>
          <p className="font-medium">
            {loadingConfig ? "Cargando total..." : `Bs ${(totalUsd * tasaCambio).toFixed(2)}`}
          </p>
        </div>

        <button
          disabled={!nombre || !telefono || !direccion || enviando || cart.length === 0}
          onClick={enviarPedido}
          className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40 hover:bg-leaf-800 transition-colors"
        >
          {enviando ? "Enviando…" : "Enviar pedido a la tienda"}
        </button>

        {/* El carrito sigue guardado en este punto: si se le olvidó algo o
            quiere revisar cantidades, puede volver al catálogo sin perder
            nada. "Cancelar" vacía el carrito para empezar de cero. */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={enviando}
            onClick={() => router.push("/")}
            className="w-full py-3 rounded-lg border border-leaf-600 text-leaf-600 font-medium hover:bg-leaf-50 transition-colors disabled:opacity-40"
          >
            ← Editar carrito
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => {
              localStorage.removeItem(CART_KEY);
              router.push("/");
            }}
            className="w-full py-3 rounded-lg border border-alert-600 text-alert-600 font-medium hover:bg-alert-50 transition-colors disabled:opacity-40"
          >
            Cancelar pedido
          </button>
        </div>
      </div>
      <p className="mt-6 text-sm text-center">
        <Link href="/mensajes" className="text-leaf-600 underline">
          💬 ¿Dudas? Escríbenos o llama a la tienda
        </Link>
      </p>
    </main>
  );
}