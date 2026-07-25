"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { soloDigitos } from "@/lib/cedula";

type Product = { id: string; nombre: string; precioUsd: number; categoria: string; activo: boolean };
type Cliente = { id: string; nombre: string; cedula: string; telefono: string; direccion: string };
type Linea = { productId: string; cantidad: number };

export default function PedidoPorLlamadaPage() {
  const router = useRouter();

  // --- Paso 1: identificar al cliente por cédula ---
  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null);
  const [esClienteNuevo, setEsClienteNuevo] = useState(false);
  const [cedulaConsultada, setCedulaConsultada] = useState(false);

  // Datos para registrar al cliente si la cédula no existe todavía.
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [telefonoNuevo, setTelefonoNuevo] = useState("");
  const [direccionNuevo, setDireccionNuevo] = useState("");
  const [passwordNuevo, setPasswordNuevo] = useState("");

  // --- Paso 2: armar el pedido ---
  const [products, setProducts] = useState<Product[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [estadoInicial, setEstadoInicial] = useState("ESPERANDO_PAGO");
  const [notas, setNotas] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ id: string; claveGenerada: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts((d.products || []).filter((p: Product) => p.activo)))
      .catch(() => setProducts([]));
  }, []);

  async function buscarCliente() {
    const cedulaLimpia = cedula.trim();
    if (!cedulaLimpia) return;
    setBuscando(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/clientes/buscar?cedula=${encodeURIComponent(cedulaLimpia)}`);
      const data = await res.json();
      if (data.cliente) {
        setClienteEncontrado(data.cliente);
        setEsClienteNuevo(false);
      } else {
        setClienteEncontrado(null);
        setEsClienteNuevo(true);
        setNombreNuevo("");
        setTelefonoNuevo("");
        setDireccionNuevo("");
        setPasswordNuevo("");
      }
      setCedulaConsultada(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("No se pudo consultar la cédula.");
    } finally {
      setBuscando(false);
    }
  }

  function agregarProducto(productId: string) {
    setLineas((prev) => {
      const existente = prev.find((l) => l.productId === productId);
      if (existente) {
        return prev.map((l) => (l.productId === productId ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [...prev, { productId, cantidad: 1 }];
    });
  }

  function cambiarCantidad(productId: string, cantidad: number) {
    if (cantidad <= 0) {
      setLineas((prev) => prev.filter((l) => l.productId !== productId));
      return;
    }
    setLineas((prev) => prev.map((l) => (l.productId === productId ? { ...l, cantidad } : l)));
  }

  const productosFiltrados = products.filter((p) =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
  );

  const totalUsd = lineas.reduce((sum, l) => {
    const p = products.find((pr) => pr.id === l.productId);
    return sum + (p ? p.precioUsd * l.cantidad : 0);
  }, 0);

  async function crearPedido() {
    setErrorMsg(null);

    if (!cedulaConsultada) {
      setErrorMsg("Primero busca la cédula del cliente.");
      return;
    }
    if (!lineas.length) {
      setErrorMsg("Agrega al menos un artículo al pedido.");
      return;
    }
    if (esClienteNuevo && (!nombreNuevo || !telefonoNuevo || !direccionNuevo)) {
      setErrorMsg("Es un cliente nuevo: completa nombre, teléfono y dirección.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/orders/telefono", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cedula: cedula.trim(),
          nombre: esClienteNuevo ? nombreNuevo : undefined,
          telefono: esClienteNuevo ? telefonoNuevo : undefined,
          direccion: esClienteNuevo ? direccionNuevo : undefined,
          password: esClienteNuevo ? passwordNuevo : undefined,
          items: lineas,
          estadoInicial,
          notas
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear el pedido.");
      }
      setResultado({ id: data.order.id, claveGenerada: data.claveGenerada ?? null });
    } catch (err: any) {
      setErrorMsg(err.message || "Error al crear el pedido.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-xl text-leaf-800 mb-4">Pedido creado ✅</h1>
        <p className="text-sm text-ink/70 mb-4">
          El pedido quedó registrado y enlazado a la cuenta del cliente. Ya aparece en{" "}
          <Link href="/admin/pedidos" className="text-leaf-600 underline">
            Pedidos
          </Link>{" "}
          y en el historial del cliente.
        </p>
        {resultado.claveGenerada && (
          <div className="p-3 bg-clay-100 border border-clay-200 rounded-lg text-sm mb-4">
            <p className="font-medium text-clay-600 mb-1">Cuenta nueva creada</p>
            <p>
              Contraseña generada para que el cliente pueda ver sus pedidos en línea si quiere:{" "}
              <span className="font-mono font-bold">{resultado.claveGenerada}</span>
            </p>
          </div>
        )}
        <button
          onClick={() => {
            setResultado(null);
            setCedula("");
            setCedulaConsultada(false);
            setClienteEncontrado(null);
            setEsClienteNuevo(false);
            setLineas([]);
            setNotas("");
          }}
          className="px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-700"
        >
          Registrar otro pedido por llamada
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-xl text-leaf-800 mb-1">Pedido por llamada</h1>
      <p className="text-sm text-ink/60 mb-6">
        Para clientes que prefieren pedir por teléfono. El pedido queda enlazado a su cédula, tenga o
        no cuenta ya creada, para no perder el registro de la venta.
      </p>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* PASO 1: CÉDULA */}
      <div className="bg-white border border-leaf-100 rounded-lg p-4 mb-4">
        <p className="text-sm font-medium text-ink/80 mb-2">1. Cédula del cliente</p>
        <div className="flex gap-2">
          <input
            value={cedula}
            onChange={(e) => {
              setCedula(soloDigitos(e.target.value));
              setCedulaConsultada(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
            inputMode="numeric"
            placeholder="Solo números, ej: 12345678"
            className="flex-1 border border-leaf-100 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={buscarCliente}
            disabled={buscando || !cedula.trim()}
            className="px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium disabled:opacity-40"
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </div>

        {cedulaConsultada && clienteEncontrado && (
          <div className="mt-3 p-3 bg-leaf-50/50 rounded-lg border border-leaf-100 text-sm">
            <p className="font-medium text-leaf-800">{clienteEncontrado.nombre}</p>
            <p className="text-ink/60">
              {clienteEncontrado.telefono} · {clienteEncontrado.direccion}
            </p>
            <p className="text-xs text-ink/40 mt-1">Cliente ya registrado — el pedido se enlaza a su cuenta.</p>
          </div>
        )}

        {cedulaConsultada && esClienteNuevo && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-clay-600">
              No hay ninguna cuenta con esta cédula. Se creará una para que este pedido y los
              siguientes queden registrados a su nombre.
            </p>
            <input
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Nombre completo"
              className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={telefonoNuevo}
              onChange={(e) => setTelefonoNuevo(e.target.value)}
              placeholder="Teléfono"
              className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={direccionNuevo}
              onChange={(e) => setDireccionNuevo(e.target.value)}
              placeholder="Dirección de entrega"
              className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={passwordNuevo}
              onChange={(e) => setPasswordNuevo(e.target.value)}
              placeholder="Contraseña (opcional, mín. 6 caracteres — si la dejas vacía, se genera una)"
              className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* PASO 2: PRODUCTOS */}
      {cedulaConsultada && (
        <div className="bg-white border border-leaf-100 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-ink/80 mb-2">2. Artículos del pedido</p>
          <input
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm mb-2"
          />
          <ul className="max-h-48 overflow-y-auto divide-y divide-leaf-50 mb-3">
            {productosFiltrados.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="truncate">
                  {p.nombre} <span className="text-ink/40">(${p.precioUsd.toFixed(2)})</span>
                </span>
                <button
                  onClick={() => agregarProducto(p.id)}
                  className="shrink-0 px-2.5 py-1 rounded-md bg-leaf-600 text-white text-xs"
                >
                  Agregar
                </button>
              </li>
            ))}
          </ul>

          {lineas.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/50 mb-1">Pedido</p>
              <ul className="divide-y divide-leaf-50">
                {lineas.map((l) => {
                  const p = products.find((pr) => pr.id === l.productId);
                  if (!p) return null;
                  return (
                    <li key={l.productId} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="truncate flex-1">{p.nombre}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => cambiarCantidad(l.productId, l.cantidad - 1)}
                          className="w-7 h-7 rounded-full border border-leaf-400 text-leaf-600"
                        >
                          −
                        </button>
                        <span className="w-4 text-center">{l.cantidad}</span>
                        <button
                          onClick={() => cambiarCantidad(l.productId, l.cantidad + 1)}
                          className="w-7 h-7 rounded-full bg-leaf-600 text-white"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm font-medium text-leaf-800 mt-2">Total: ${totalUsd.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      {/* PASO 3: ESTADO Y NOTAS */}
      {cedulaConsultada && (
        <div className="bg-white border border-leaf-100 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-ink/80 mb-2">3. Estado inicial del pedido</p>
          <select
            value={estadoInicial}
            onChange={(e) => setEstadoInicial(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm mb-3"
          >
            <option value="ESPERANDO_PAGO">Esperando pago</option>
            <option value="CONFIRMADO">Confirmado (ya pagó)</option>
            <option value="EN_PREPARACION">En preparación</option>
          </select>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas del pedido (opcional): forma de pago acordada, referencia, etc."
            className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      {cedulaConsultada && (
        <button
          disabled={enviando || !lineas.length}
          onClick={crearPedido}
          className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40 hover:bg-leaf-700 transition-colors"
        >
          {enviando ? "Creando pedido…" : "Crear pedido"}
        </button>
      )}
    </div>
  );
}
