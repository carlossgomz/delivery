"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ContactoTienda from "@/app/components/ContactoTienda";

type Product = { id: string; nombre: string; precioUsd: number };
type CartLine = { productId: string; cantidad: number };

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

  const [orderId, setOrderId] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para comprobante o referencia/nota
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null);
  const [notaPago, setNotaPago] = useState("");

  // 1. Cargar productos, config y restaurar orden activa si existe
  useEffect(() => {
    async function load() {
      try {
        const [pRes, cRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/config"),
        ]);

        if (pRes.ok) {
          const pData = await pRes.json();
          setProducts(pData.products || []);
        }

        if (cRes.ok) {
          const cData = await cRes.json();
          setTasaCambio(cData.tasaCambio || 0);
        }

        const savedCart = localStorage.getItem(CART_KEY);
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }

        const savedOrder = localStorage.getItem(ACTIVE_ORDER_KEY);
        if (savedOrder) {
          setOrderId(savedOrder);
        }
      } catch (err) {
        console.error("Error al cargar datos iniciales:", err);
      } finally {
        setLoadingConfig(false);
      }
    }
    load();
  }, []);

  // 2. Polling de la orden
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

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data?.order?.estado) {
          setEstado(data.order.estado);
        }
      } catch (err) {
        console.error("Error al consultar el estado del pedido:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [orderId, estado]);

  const totalUsd = cart.reduce((sum, l) => {
    const p = products.find((pr) => pr.id === l.productId);
    return sum + (p ? p.precioUsd * l.cantidad : 0);
  }, 0);

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
      if (data?.order?.estado) {
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

  // --- VISTA PANTALLA DE ESTADO DE ORDEN ---
  if (orderId) {
    return (
      <main className="max-w-md mx-auto px-4 py-10 text-center">
        <h1 className="font-display text-xl text-leaf-800 mb-2">Pedido enviado</h1>
        <p className="text-ink/70 mb-6">Número de pedido: {orderId.slice(0, 8)}</p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            {errorMsg}
          </div>
        )}

        {estado === "PENDIENTE_VERIFICACION" && (
          <p className="text-clay-600 animate-pulse">
            La tienda está confirmando qué productos tiene disponibles…
          </p>
        )}

        {estado === "ESPERANDO_PAGO" && (
          <div className="text-left bg-white rounded-lg border border-leaf-100 p-4 space-y-4 shadow-sm">
            <p className="text-sm text-ink/80 font-medium">
              ¡Tu pedido está listo! 🎉 Realiza tu Pago Móvil y confirma tu compra a continuación.
            </p>

            {/* Monto total */}
            <div className="p-3 bg-leaf-100/30 rounded-lg border border-leaf-100">
              <p className="text-xs text-ink/60">Monto total a pagar:</p>
              <p className="text-lg font-bold text-leaf-800">
                Bs {(totalUsd * tasaCambio).toFixed(2)}
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
        <ContactoTienda />
      </main>
    );
  }

  // --- VISTA FORMULARIO DATOS DE ENTREGA ---
  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <h1 className="font-display text-xl text-leaf-800 mb-6">Datos de entrega</h1>

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
      </div>
      <ContactoTienda />
    </main>
  );
}