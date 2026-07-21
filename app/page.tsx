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

  // Filtra por nombre o por categoría en tiempo real
  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-leaf-100">
        <div>
          <h1 className="text-2xl font-bold text-leaf-800">Catálogo de Productos</h1>
          {!cargando && (
            <p className="text-xs text-gray-500 mt-1">
              Mostrando {productosFiltrados.length} de {productos.length} productos
            </p>
          )}
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Buscar por producto o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full border border-leaf-200 rounded-lg pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600 focus:border-transparent transition-all"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center"
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* RESULTADOS Y GRILLA */}
      {cargando ? (
        <div className="text-center py-12 text-gray-500">Cargando catálogo...</div>
      ) : productosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p className="text-gray-600 font-medium">No se encontraron productos para "{busqueda}"</p>
          <button
            onClick={() => setBusqueda("")}
            className="mt-2 text-sm text-leaf-600 underline font-medium hover:text-leaf-800"
          >
            Ver todos los productos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {productosFiltrados.map((prod) => (
            <div
              key={prod.id}
              className="bg-white border border-leaf-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold text-leaf-600 uppercase tracking-wider bg-leaf-50 px-2 py-0.5 rounded">
                  {prod.categoria}
                </span>
                <h3 className="font-medium text-gray-800 text-sm mt-2 line-clamp-2">
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