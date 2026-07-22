"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  nombre: string;
  costoUsd?: number | null;
  precioUsd: number;
  margenPorcentaje?: number | null;
  imagenUrl?: string | null;
};

export default function AdminHomePage() {
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [nuevaTasa, setNuevaTasa] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // Estados para gestión de productos
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingValues, setEditingValues] = useState<
    Record<string, { nombre: string; costoUsd: string; margenPorcentaje: string }>
  >({});
  const [guardandoProductoId, setGuardandoProductoId] = useState<string | null>(null);

  useEffect(() => {
    // Cargar Tasa Actual
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setTasaCambio(d.tasaCambio);
      });

    cargarProductos();
  }, []);

  async function cargarProductos() {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      const lista = Array.isArray(data.products) ? data.products : Array.isArray(data) ? data : [];
      setProducts(lista);

      const iniciales: Record<string, { nombre: string; costoUsd: string; margenPorcentaje: string }> = {};
      lista.forEach((p: Product) => {
        iniciales[p.id] = {
          nombre: p.nombre,
          costoUsd: p.costoUsd?.toString() ?? "",
          margenPorcentaje: p.margenPorcentaje !== null && p.margenPorcentaje !== undefined ? p.margenPorcentaje.toString() : "0",
        };
      });
      setEditingValues(iniciales);
    } catch (e) {
      console.error("Error al cargar productos:", e);
    }
  }

  async function actualizarTasa() {
    setGuardando(true);
    setMensaje("");
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasaCambio: Number(nuevaTasa) })
    });
    if (res.ok) {
      const data = await res.json();
      setTasaCambio(data.tasaCambio);
      setNuevaTasa("");
      setMensaje("Tasa actualizada correctamente.");
    } else {
      setMensaje("No se pudo actualizar la tasa.");
    }
    setGuardando(false);
  }

  // Conversión matemática: ((Costo * (1 + Margen%)) + $0.15) * Tasa del día
  function calcularPrecioBs(costoStr: string, margenStr: string): string {
    const costo = parseFloat(costoStr);
    if (isNaN(costo) || costo <= 0) return "0.00";

    const pct = parseFloat(margenStr);
    const margenUsar = isNaN(pct) ? 0 : pct;

    const precioUsd = (costo * (1 + margenUsar / 100)) + 0.15;
    const precioBs = precioUsd * tasaCambio;

    return precioBs.toFixed(2);
  }

  function handleProductChange(id: string, field: "nombre" | "costoUsd" | "margenPorcentaje", value: string) {
    setEditingValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  async function guardarProducto(id: string) {
    const val = editingValues[id];
    if (!val) return;

    setGuardandoProductoId(id);

    try {
      const costo = parseFloat(val.costoUsd) || 0;
      const pct = parseFloat(val.margenPorcentaje) || 0;
      const precioUsdCalculado = (costo * (1 + pct / 100)) + 0.15;

      const bodyPayload = {
        nombre: val.nombre,
        costoUsd: val.costoUsd !== "" ? costo : null,
        precioUsd: precioUsdCalculado,
        margenPorcentaje: pct,
      };

      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        const data = await res.json();
        const prodActualizado = data.product || data;
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...prodActualizado } : p)));
      } else {
        alert("No se pudo actualizar el producto.");
      }
    } catch (e) {
      console.error("Error al guardar producto:", e);
    } finally {
      setGuardandoProductoId(null);
    }
  }

  const productosFiltrados = products.filter((p) => {
    const edit = editingValues[p.id];
    const nombreBuscar = edit?.nombre ?? p.nombre;
    return nombreBuscar.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: TASA DEL DÍA */}
      <div>
        <h1 className="font-display text-xl text-leaf-800 mb-4">Tasa del día</h1>

        <div className="bg-white border border-leaf-100 rounded-lg p-6 mb-4">
          <p className="text-sm text-ink/60">Tasa actual</p>
          <p className="font-display text-3xl text-leaf-800">{tasaCambio} Bs/USD</p>
        </div>

        <div className="flex gap-3">
          <input
            type="number"
            step="0.01"
            value={nuevaTasa}
            onChange={(e) => setNuevaTasa(e.target.value)}
            placeholder="Nueva tasa, ej: 42.50"
            className="flex-1 border border-leaf-100 rounded-lg px-3 py-3"
          />
          <button
            disabled={!nuevaTasa || guardando}
            onClick={actualizarTasa}
            className="px-5 py-2 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40 hover:bg-leaf-700 transition-colors shrink-0"
          >
            Actualizar Tasa
          </button>
        </div>

        {mensaje && <p className="text-sm mt-3 text-leaf-600 font-medium">{mensaje}</p>}
      </div>

      <hr className="border-leaf-100 my-6" />

      {/* SECCIÓN 2: CATÁLOGO DE PRODUCTOS EDITABLES CON BÚSQUEDA */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-xl text-leaf-800">Productos</h2>
            <p className="text-xs text-ink/50">Edita el costo ($) y margen (%) de cada producto para calcular el precio en Bs</p>
          </div>

          {/* BARRA DE BÚSQUEDA */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-leaf-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-xs text-ink/40 hover:text-ink/80"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* TABLA DE PRODUCTOS */}
        <div className="bg-white border border-leaf-100 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-leaf-100 bg-leaf-50/50 text-xs font-semibold text-leaf-800">
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-3 w-28">Costo ($)</th>
                  <th className="py-3 px-3 w-28">Margen (%)</th>
                  <th className="py-3 px-3 w-36 text-right">Precio Cliente (Bs)</th>
                  <th className="py-3 px-4 w-24 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-leaf-100/50">
                {productosFiltrados.map((product) => {
                  const edit = editingValues[product.id] || {
                    nombre: product.nombre,
                    costoUsd: product.costoUsd?.toString() ?? "",
                    margenPorcentaje: product.margenPorcentaje !== null && product.margenPorcentaje !== undefined ? product.margenPorcentaje.toString() : "0",
                  };

                  const precioBs = calcularPrecioBs(edit.costoUsd, edit.margenPorcentaje);
                  const estaGuardando = guardandoProductoId === product.id;

                  return (
                    <tr key={product.id} className="hover:bg-leaf-50/20">
                      {/* NOMBRE */}
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={edit.nombre}
                          onChange={(e) => handleProductChange(product.id, "nombre", e.target.value)}
                          className="w-full border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded px-2 py-1 focus:bg-white focus:outline-none"
                        />
                      </td>

                      {/* COSTO ($) */}
                      <td className="py-2 px-3">
                        <div className="relative flex items-center">
                          <span className="absolute left-2 text-xs text-ink/40">$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={edit.costoUsd}
                            onChange={(e) => handleProductChange(product.id, "costoUsd", e.target.value)}
                            className="w-full pl-5 pr-1 py-1 border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded focus:bg-white focus:outline-none"
                          />
                        </div>
                      </td>

                      {/* MARGEN (%) */}
                      <td className="py-2 px-3">
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            step="1"
                            placeholder="0"
                            value={edit.margenPorcentaje}
                            onChange={(e) => handleProductChange(product.id, "margenPorcentaje", e.target.value)}
                            className="w-full pr-4 pl-1 py-1 border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded focus:bg-white focus:outline-none text-right"
                          />
                          <span className="absolute right-1 text-xs text-ink/40">%</span>
                        </div>
                      </td>

                      {/* PRECIO CLIENTE EN BS */}
                      <td className="py-2 px-3 text-right">
                        <span className="font-semibold text-leaf-800">
                          {precioBs} Bs
                        </span>
                      </td>

                      {/* BOTÓN GUARDAR */}
                      <td className="py-2 px-4 text-right">
                        <button
                          onClick={() => guardarProducto(product.id)}
                          disabled={estaGuardando}
                          className="px-3 py-1.5 rounded-lg bg-leaf-600 text-white text-xs font-medium disabled:opacity-40 hover:bg-leaf-700 transition-colors"
                        >
                          {estaGuardando ? "..." : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {productosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-ink/50">
                      {searchTerm ? "No se encontraron productos." : "No hay productos disponibles."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}