"use client";

import { useEffect, useState } from "react";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  imagenUrl?: string;
  precioUsd: number;
}

export default function ClientStorePage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState<string>("");
  const [cargando, setCargando] = useState<boolean>(true);

  useEffect(() => {
    async function cargarProductos() {
      try {
        const resProducts = await fetch("/api/products");
        const dataProducts = await resProducts.json();
        if (Array.isArray(dataProducts)) {
          setProductos(dataProducts);
        }
      } catch (error) {
        console.error("Error al cargar los productos:", error);
      } finally {
        setCargando(false);
      }
    }

    cargarProductos();
  }, []);

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-leaf-100">
        <div>
          <h1 className="text-2xl font-bold text-leaf-800">Catálogo de Productos</h1>
        </div>

        <input
          type="text"
          placeholder="Buscar producto o categoría..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full md:w-72 border border-leaf-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-leaf-600"
        />
      </header>

      {cargando ? (
        <div className="text-center py-12 text-gray-500">Cargando productos...</div>
      ) : productosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No se encontraron productos.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {productosFiltrados.map((prod) => (
            <div
              key={prod.id}
              className="bg-white border border-leaf-100 rounded-lg p-4 shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-xs font-semibold text-leaf-600 uppercase tracking-wider">
                  {prod.categoria}
                </span>
                <h3 className="font-medium text-gray-800 text-sm mt-1 line-clamp-2">
                  {prod.nombre}
                </h3>
              </div>

              <div className="mt-4 pt-2 border-t border-leaf-100">
                <p className="text-lg font-bold text-leaf-800">${prod.precioUsd.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}