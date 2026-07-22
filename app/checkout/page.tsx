"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Product = { id: string; nombre: string; precioUsd: number };
type CartLine = { productId: string; cantidad: number };

const CART_KEY = "delivery_cart";

export default function CheckoutPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tasaCambio, setTasaCambio] = useState(0);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Estados para comprobante o referencia/nota
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null);
  const [notaPago, setNotaPago] = useState("");

  useEffect(() => {
    async function load() {
      const [pRes, cRes] = await Promise.all([fetch("/api/products"), fetch("/api/config")]);
      setProducts((await pRes.json()).products);
      setTasaCambio((await cRes.json()).tasaCambio);
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved));
    }
    load();
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      setEstado(data.order.estado);
    }, 4000);
    return () => clearInterval(interval);
  }, [orderId]);

  const totalUsd = cart.reduce((sum, l) => {
    const p = products.find((pr) => pr.id === l.productId);
    return sum + (p ? p.precioUsd * l.cantidad : 0);
  }, 0);

  async function enviarPedido() {
    setEnviando(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteNombre: nombre,
        clienteTelefono: telefono,
        direccion,
        items: cart
      })
    });
    const data = await res.json();
    setOrderId(data.order.id);
    setEstado(data.order.estado);
    localStorage.removeItem(CART_KEY);
    setEnviando(false);
  }

  async function procesarPago() {
    if (!orderId) return;
    setEnviando(true);

    let url = "";

    if (archivoComprobante) {
      const formData = new FormData();
      formData.append("file", archivoComprobante);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      url = uploadData.url;
    }

    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comprobanteUrl: url || undefined,
        notaPago: notaPago || undefined
      })
    });

    setEstado("PAGO_EN_REVISION");
    setEnviando(false);
  }

  if (orderId) {
    return (
      <main className="max-w-md mx-auto px-4 py-10 text-center">
        <h1 className="font-display text-xl text-leaf-800 mb-2">Pedido enviado</h1>
        <p className="text-ink/70 mb-6">Número de pedido: {orderId.slice(0, 8)}</p>

        {estado === "PENDIENTE_VERIFICACION" && (
          <p className="text-clay-600">La tienda está confirmando qué productos tiene disponibles…</p>
        )}

        {estado === "ESPERANDO_PAGO" && (
          <div className="text-left bg-white rounded-lg border border-leaf-100 p-4 space-y-4">
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

            {/* BOTÓN FINALIZAR COMPRA */}
            <button
              disabled={enviando}
              onClick={procesarPago}
              className="w-full mt-2 py-3 rounded-lg bg-leaf-600 text-white font-medium hover:bg-leaf-800 transition-colors disabled:opacity-40"
            >
              {enviando ? "Procesando pago…" : "Finalizar compra ✨"}
            </button>
          </div>
        )}

        {estado === "PAGO_EN_REVISION" && (
          <p className="text-clay-600">Recibimos la información de tu pago. La tienda lo está verificando.</p>
        )}

        {(estado === "CONFIRMADO" || estado === "EN_PREPARACION") && (
          <p className="text-leaf-600">Pago confirmado. Tu pedido está en preparación.</p>
        )}

        {estado === "CANCELADO" && (
          <p className="text-alert-600">
            Ningún producto del pedido quedó disponible. La tienda debería haberte contactado.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <h1 className="font-display text-xl text-leaf-800 mb-6">Datos de entrega</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-ink/70 mb-1">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Teléfono</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Dirección de entrega</label>
          <textarea
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
          />
        </div>

        <div className="pt-2 border-t border-leaf-100">
          <p className="text-sm text-ink/60">Total estimado (sujeto a disponibilidad)</p>
          <p className="font-medium">
            Bs {(totalUsd * tasaCambio).toFixed(2)}
          </p>
        </div>

        <button
          disabled={!nombre || !telefono || !direccion || enviando}
          onClick={enviarPedido}
          className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          {enviando ? "Enviando…" : "Enviar pedido a la tienda"}
        </button>
      </div>
    </main>
  );
}