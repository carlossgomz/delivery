"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  nombre: string;
  costoUsd?: number | null;
  precioUsd: number;
  margenPorcentaje?: number | null;
  imagenUrl?: string | null;
  activo: boolean;
  porPeso: boolean;
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
    Record<string, { nombre: string; precioUsd: string; porPeso: boolean }>
  >({});
  const [guardandoProductoId, setGuardandoProductoId] = useState<string | null>(null);
  const [cambiandoDisponibilidadId, setCambiandoDisponibilidadId] = useState<string | null>(null);
  const [subiendoImagenId, setSubiendoImagenId] = useState<string | null>(null);

  async function subirImagen(product: Product, file: File) {
    setSubiendoImagenId(product.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carpeta", "productos");

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        alert("No se pudo subir la imagen.");
        return;
      }
      const { url } = await uploadRes.json();

      const patchRes = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenUrl: url }),
      });

      if (patchRes.ok) {
        const data = await patchRes.json();
        const prodActualizado = data.product || data;
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...prodActualizado } : p)));
      } else {
        alert("La imagen se subió pero no se pudo asociar al producto.");
      }
    } catch (e) {
      console.error("Error al subir imagen de producto:", e);
      alert("Ocurrió un error al subir la imagen.");
    } finally {
      setSubiendoImagenId(null);
    }
  }

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

      const iniciales: Record<string, { nombre: string; precioUsd: string; porPeso: boolean }> = {};
      lista.forEach((p: Product) => {
        iniciales[p.id] = {
          nombre: p.nombre,
          precioUsd: p.precioUsd?.toString() ?? "0",
          porPeso: Boolean(p.porPeso),
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

  // El precio lo carga el admin directamente en dólares; el precio en Bs
  // que ve el cliente se calcula con la tasa del día.
  function calcularPrecioBs(precioUsdStr: string): string {
    const precioUsd = parseFloat(precioUsdStr);
    if (isNaN(precioUsd) || precioUsd <= 0) return "0.00";

    return (precioUsd * tasaCambio).toFixed(2);
  }

  function handleProductChange(
    id: string,
    field: "nombre" | "precioUsd" | "porPeso",
    value: string | boolean
  ) {
    setEditingValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      } as { nombre: string; precioUsd: string; porPeso: boolean },
    }));
  }

  async function guardarProducto(id: string) {
    const val = editingValues[id];
    if (!val) return;

    setGuardandoProductoId(id);

    try {
      const precioUsd = parseFloat(val.precioUsd) || 0;

      const bodyPayload = {
        nombre: val.nombre,
        precioUsd,
        porPeso: val.porPeso,
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

  async function toggleDisponibilidad(product: Product) {
    setCambiandoDisponibilidadId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !product.activo }),
      });

      if (res.ok) {
        const data = await res.json();
        const prodActualizado = data.product || data;
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...prodActualizado } : p)));
      } else {
        alert("No se pudo cambiar la disponibilidad del producto.");
      }
    } catch (e) {
      console.error("Error al cambiar disponibilidad:", e);
    } finally {
      setCambiandoDisponibilidadId(null);
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
            <p className="text-xs text-ink/50">Carga el precio en dólares ($) de cada producto; el precio en Bs se calcula con la tasa del día</p>
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
                  <th className="py-3 px-3 w-16 text-center">Imagen</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-3 w-24 text-center">Por peso</th>
                  <th className="py-3 px-3 w-28">Precio ($)</th>
                  <th className="py-3 px-3 w-36 text-right">Precio Cliente (Bs)</th>
                  <th className="py-3 px-3 w-28 text-center">Estado</th>
                  <th className="py-3 px-4 w-24 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-leaf-100/50">
                {productosFiltrados.map((product) => {
                  const edit = editingValues[product.id] || {
                    nombre: product.nombre,
                    precioUsd: product.precioUsd?.toString() ?? "0",
                    porPeso: Boolean(product.porPeso),
                  };

                  const precioBs = calcularPrecioBs(edit.precioUsd);
                  const estaGuardando = guardandoProductoId === product.id;

                  return (
                    <tr key={product.id} className={`hover:bg-leaf-50/20 ${!product.activo ? "opacity-50" : ""}`}>
                      {/* IMAGEN */}
                      <td className="py-2 px-3">
                        <label className="relative block w-11 h-11 rounded-lg border border-leaf-100 bg-leaf-50 overflow-hidden cursor-pointer group mx-auto">
                          {product.imagenUrl ? (
                            <img
                              src={product.imagenUrl}
                              alt={product.nombre}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-leaf-300 text-lg">
                              🛒
                            </span>
                          )}
                          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[9px] font-medium opacity-0 group-hover:opacity-100">
                            {subiendoImagenId === product.id ? "..." : "Cambiar"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={subiendoImagenId === product.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) subirImagen(product, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </td>
                      {/* NOMBRE */}
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={edit.nombre}
                          onChange={(e) => handleProductChange(product.id, "nombre", e.target.value)}
                          className="w-full border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded px-2 py-1 focus:bg-white focus:outline-none"
                        />
                      </td>

                      {/* POR PESO (KG) */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={edit.porPeso}
                          onChange={(e) => handleProductChange(product.id, "porPeso", e.target.checked)}
                          className="w-4 h-4 accent-leaf-600 cursor-pointer"
                          title="Se vende por kilogramo (el precio es por kg)"
                        />
                      </td>

                      {/* PRECIO ($) */}
                      <td className="py-2 px-3">
                        <div className="relative flex items-center">
                          <span className="absolute left-2 text-xs text-ink/40">$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={edit.precioUsd}
                            onChange={(e) => handleProductChange(product.id, "precioUsd", e.target.value)}
                            className="w-full pl-5 pr-1 py-1 border border-transparent hover:border-leaf-100 focus:border-leaf-500 rounded focus:bg-white focus:outline-none"
                          />
                          {edit.porPeso && (
                            <span className="absolute right-1 text-[10px] text-ink/40">/kg</span>
                          )}
                        </div>
                      </td>

                      {/* PRECIO CLIENTE EN BS */}
                      <td className="py-2 px-3 text-right">
                        <span className="font-semibold text-leaf-800">
                          {precioBs} Bs{edit.porPeso && <span className="text-ink/40 font-normal">/kg</span>}
                        </span>
                      </td>

                      {/* ESTADO / DISPONIBILIDAD */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${product.activo
                              ? "bg-leaf-100 text-leaf-800"
                              : "bg-alert-100 text-alert-600"
                            }`}
                        >
                          {product.activo ? "Disponible" : "Sin stock"}
                        </span>
                      </td>

                      {/* BOTÓN GUARDAR */}
                      <td className="py-2 px-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            onClick={() => guardarProducto(product.id)}
                            disabled={estaGuardando}
                            className="px-3 py-1.5 rounded-lg bg-leaf-600 text-white text-xs font-medium disabled:opacity-40 hover:bg-leaf-700 transition-colors"
                          >
                            {estaGuardando ? "..." : "Guardar"}
                          </button>
                          <button
                            onClick={() => toggleDisponibilidad(product)}
                            disabled={cambiandoDisponibilidadId === product.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors border ${product.activo
                                ? "border-alert-600 text-alert-600 hover:bg-alert-50"
                                : "border-leaf-600 text-leaf-600 hover:bg-leaf-50"
                              }`}
                          >
                            {cambiandoDisponibilidadId === product.id
                              ? "..."
                              : product.activo
                                ? "Desactivar"
                                : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {productosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-ink/50">
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