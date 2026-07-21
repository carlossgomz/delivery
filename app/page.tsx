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
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [busqueda, setBusqueda] = useState<string>("");
  const [cargando, setCargando] = useState<boolean>(true);

  useEffect(() => {
    async function cargarDatos() {
      try {
        // 1. Obtener la tasa de cambio actual desde la API de configuración
        const resConfig = await fetch("/api/config");
        const dataConfig = await resConfig.json();
        if (dataConfig && dataConfig.tasaCambio) {
          setTasaCambio(dataConfig.tasaCambio);
        }

        // 2. Obtener los productos procesados
        const resProducts = await fetch("/api/products");
        const dataProducts = await resProducts.json();

        if (dataProducts && Array.isArray(dataProducts.products)) {
          setProductos(dataProducts.products);
        } else if (Array.isArray(dataProducts)) {
          setProductos(dataProducts);
        }
      } catch (error) {
        console.error("Error al cargar los datos:", error);
      } finally {
        setCargando(false);
      }
    }

    cargarDatos();
  }, []);

  // Filtrado por nombre o categoría en tiempo real
  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Cabecera y Buscador */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-leaf-100">
        <div>
          <h1 className="text-2xl font-bold text-leaf-800">Catálogo de Productos</h1>
          {!cargando && (
            <p className="text-xs text-gray-500 mt-1">
              Mostrando {productosFiltrados.length} de {productos.length} productos
            </p>
          )}
        </div>

        {/* Input de Búsqueda */}
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
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Carga, mensaje de vacío o Parrilla de Productos */}
      {cargando ? (
        <div className="text-center py-12 text-gray-500">Cargando catálogo...</div>
      ) : productosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p className="text-gray-600 font-medium">
            {productos.length === 0
              ? "No hay productos disponibles en la base de datos."
              : `No se encontraron productos para "${busqueda}"`}
          </p>
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="mt-2 text-sm text-leaf-600 underline font-medium hover:text-leaf-800"
            >
              Ver todos los productos
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {productosFiltrados.map((prod) => {
            // Se calcula el precio final en Bolívares usando la tasa guardada
            const precioBs = (prod.precioUsd * tasaCambio).toFixed(2);

            return (
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
                  <p className="text-lg font-bold text-leaf-800">
                    Bs. {precioBs}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}