"use client";

import { useState } from "react";

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

export default function CheckoutPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [orderId, setOrderId] = useState<string>("");
  const [estado, setEstado] = useState<string>("DATOS_ENVIO");
  const [enviando, setEnviando] = useState<boolean>(false);

  // Formulario
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null);

  // Paso 1: Crear pedido inicial
  async function crearPedido(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !telefono || !direccion) return;

    setEnviando(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: nombre,
          clienteTelefono: telefono,
          direccion
        })
      });

      const data = await res.json();
      if (data.order) {
        setOrder(data.order);
        setOrderId(data.order.id);
        setEstado(data.order.estado); // PENDIENTE_VERIFICACION
      }
    } catch (error) {
      console.error("Error al crear el pedido:", error);
    } finally {
      setEnviando(false);
    }
  }

  // Paso 2: Procesar pago (Subida de nota/comprobante)
  async function procesarPago() {
    if (!orderId) return;
    setEnviando(true);

    let url = "";

    if (archivoComprobante) {
      try {
        const formData = new FormData();
        formData.append("file", archivoComprobante);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });
        const uploadData = await uploadRes.json();
        url = uploadData.url;
      } catch (err) {
        console.error("Error al subir el comprobante:", err);
      }
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "PAGO_EN_REVISION",
          comprobanteUrl: url || undefined,
          notaPago: notaPago || undefined,
          nota: notaPago || undefined,
          referencia: notaPago || undefined
        })
      });

      const data = await res.json();

      if (data.order) {
        setOrder(data.order);
        setEstado(data.order.estado);
      } else {
        setEstado("PAGO_EN_REVISION");
      }
    } catch (error) {
      console.error("Error al procesar el pago:", error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <h1 className="font-display text-2xl text-leaf-800 text-center">Checkout</h1>

      {/* VISTA 1: DATOS DE ENVÍO */}
      {estado === "DATOS_ENVIO" && !order && (
        <form onSubmit={crearPedido} className="space-y-4 bg-white p-6 rounded-xl border border-leaf-100 shadow-sm">
          <h2 className="font-medium text-lg text-ink">Datos de envío</h2>
          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Nombre completo</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-leaf-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
              placeholder="Ej: María Pérez"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Teléfono</label>
            <input
              type="tel"
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-3 py-2 border border-leaf-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
              placeholder="Ej: 04121234567"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Dirección exacta</label>
            <textarea
              required
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full px-3 py-2 border border-leaf-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
              rows={3}
              placeholder="Ej: Av. Principal, Res. Las Palmas, Apto 4B"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="w-full py-2.5 bg-leaf-600 text-white font-medium rounded-lg hover:bg-leaf-700 transition-colors disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Enviar pedido para verificación"}
          </button>
        </form>
      )}

      {/* VISTA 2: ESPERANDO VERIFICACIÓN DE STOCK (ADMIN) */}
      {(estado === "PENDIENTE_VERIFICACION" || order?.estado === "PENDIENTE_VERIFICACION") && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center space-y-3">
          <div className="text-3xl">⏳</div>
          <h2 className="font-medium text-amber-900">Verificando disponibilidad</h2>
          <p className="text-xs text-amber-800/80 leading-relaxed">
            Estamos confirmando la existencia de los productos de tu pedido en la tienda. En breve se habilitará el monto y los datos de Pago Móvil.
          </p>
        </div>
      )}

      {/* VISTA 3: PAGO MÓVIL (ESPERANDO_PAGO) */}
      {(estado === "ESPERANDO_PAGO" || order?.estado === "ESPERANDO_PAGO") && (
        <div className="bg-white p-6 rounded-xl border border-leaf-100 shadow-sm space-y-4">
          <div className="text-center">
            <span className="text-xs font-medium text-leaf-600 bg-leaf-50 px-3 py-1 rounded-full">
              ¡Stock verificado!
            </span>
            <h2 className="font-medium text-lg text-ink mt-2">Realiza tu Pago Móvil</h2>
          </div>

          <div className="bg-leaf-50/60 p-4 rounded-lg border border-leaf-100 space-y-1 text-sm text-ink/80">
            <p><span className="font-medium">Total a pagar:</span> ${order?.totalUsd?.toFixed(2)}</p>
            <p className="text-lg font-bold text-leaf-800">Bs {order?.totalBs?.toFixed(2)}</p>
            <hr className="my-2 border-leaf-100" />
            <p className="text-xs text-ink/60"><span className="font-semibold text-ink/80">Banco:</span> Banesco (0134)</p>
            <p className="text-xs text-ink/60"><span className="font-semibold text-ink/80">Teléfono:</span> 0412-0000000</p>
            <p className="text-xs text-ink/60"><span className="font-semibold text-ink/80">C.I / RIF:</span> V-12345678</p>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">
                Número de referencia o Nota (Opcional)
              </label>
              <input
                type="text"
                value={notaPago}
                onChange={(e) => setNotaPago(e.target.value)}
                className="w-full px-3 py-2 border border-leaf-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
                placeholder="Ej: Ref 482910 o Nombre del titular"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">
                Comprobante de pago (Opcional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setArchivoComprobante(e.target.files?.[0] || null)}
                className="w-full text-xs text-ink/70 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-leaf-50 file:text-leaf-700 hover:file:bg-leaf-100"
              />
            </div>

            <button
              onClick={procesarPago}
              disabled={enviando}
              className="w-full py-2.5 bg-leaf-600 text-white font-medium rounded-lg hover:bg-leaf-700 transition-colors disabled:opacity-50 mt-2"
            >
              {enviando ? "Procesando..." : "Finalizar compra ✨"}
            </button>
          </div>
        </div>
      )}

      {/* VISTA 4: COMPRA FINALIZADA / EN REVISIÓN */}
      {(estado === "PAGO_EN_REVISION" || estado === "PAGO_RECIBIDO" || order?.estado === "PAGO_EN_REVISION" || order?.estado === "PAGO_RECIBIDO" || order?.estado === "CONFIRMADO") && (
        <div className="bg-white p-6 rounded-xl border border-leaf-100 shadow-sm text-center space-y-4">
          <div className="text-4xl">✨</div>
          <h2 className="text-xl font-medium text-leaf-800">¡Pago enviado con éxito!</h2>
          <p className="text-xs text-ink/70 leading-relaxed">
            Hemos recibido los datos de tu pago. La tienda verificará la transferencia y preparará tu pedido.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-leaf-600 text-white rounded-lg text-sm font-medium hover:bg-leaf-700 transition-colors"
          >
            Volver al catálogo
          </a>
        </div>
      )}
    </div>
  );
}