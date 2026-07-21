"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  imagenUrl?: string;
  precioUsd: number;
}

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

export default function ClientStorePage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [busqueda, setBusqueda] = useState<string>("");
  const [cargando, setCargando] = useState<boolean>(true);

  // Estado del Carrito y Drawer
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [mostrarCarrito, setMostrarCarrito] = useState<boolean>(false);

  useEffect(() => {
    async function cargarDatos() {
      try {
        const resConfig = await fetch("/api/config");
        const dataConfig = await resConfig.json();
        if (dataConfig?.tasaCambio) {
          setTasaCambio(dataConfig.tasaCambio);
        }

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

  // --- CONTROLES DEL CARRITO ---
  const agregarAlCarrito = (prod: Producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.producto.id === prod.id);
      if (existe) {
        return prev.map((item) =>
          item.producto.id === prod.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { producto: prod, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (id: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === id) {
            const nuevaCant = item.cantidad + delta;
            return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null;
          }
          return item;
        })
        .filter(Boolean) as ItemCarrito[]
    );
  };

  const eliminarDelCarrito = (id: string) => {
    setCarrito((prev) => prev.filter((item) => item.producto.id !== id));
  };

  // --- REDIRECCIÓN A LA PÁGINA DE COMPRA ---
  const irAProcesarPedido = () => {
    // Guardamos el pedido actual en localStorage para que la página de checkout/compra lo lea
    localStorage.setItem("carrito_pedido", JSON.stringify(carrito));
    // Redirige a la vista de checkout / creación de pedido
    router.push("/checkout"); // Si tu ruta de compra tiene otro nombre (ej: /pedido o /comprar), cámbiala aquí
  };

  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const totalBs = carrito.reduce(
    (acc, item) => acc + item.producto.precioUsd * tasaCambio * item.cantidad,
    0
  );

  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-leaf-100">
        <div>
          <h1 className="text-2xl font-bold text-leaf-800">Catálogo de Productos</h1>
          {!cargando && (
            <p className="text-xs text-gray-500 mt-1">
              Mostrando {productosFiltrados.length} de {productos.length} productos
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <input
              type="text"
              placeholder="Buscar por producto o categoría..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full border border-leaf-200 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600"
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

          <button
            onClick={() => setMostrarCarrito(true)}
            className="relative bg-leaf-600 hover:bg-leaf-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
          >
            <span>🛒 Carrito</span>
            {totalItems > 0 && (
              <span className="bg-white text-leaf-800 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* GRILLA DE PRODUCTOS */}
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
            const precioBs = (prod.precioUsd * tasaCambio).toFixed(2);
            const itemEnCarrito = carrito.find((i) => i.producto.id === prod.id);

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

                <div className="mt-4 pt-2 border-t border-leaf-100 flex items-center justify-between gap-2">
                  <p className="text-lg font-bold text-leaf-800">
                    Bs. {precioBs}
                  </p>

                  <button
                    onClick={() => agregarAlCarrito(prod)}
                    className="bg-leaf-100 hover:bg-leaf-600 hover:text-white text-leaf-800 font-bold p-2 rounded-lg text-xs transition-colors flex items-center gap-1"
                    title="Agregar al Carrito"
                  >
                    <span>+</span>
                    {itemEnCarrito && (
                      <span className="bg-leaf-600 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
                        {itemEnCarrito.cantidad}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DRAWER DEL CARRITO */}
      {mostrarCarrito && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between p-6 shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-800">Tu Carrito</h2>
                <button
                  onClick={() => setMostrarCarrito(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-4 pr-1">
                {carrito.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    El carrito está vacío.
                  </p>
                ) : (
                  carrito.map(({ producto, cantidad }) => {
                    const subtotalBs = (
                      producto.precioUsd *
                      tasaCambio *
                      cantidad
                    ).toFixed(2);

                    return (
                      <div
                        key={producto.id}
                        className="flex items-center justify-between border-b pb-3"
                      >
                        <div className="flex-1 pr-2">
                          <h4 className="font-medium text-sm text-gray-800 line-clamp-1">
                            {producto.nombre}
                          </h4>
                          <p className="text-xs text-leaf-700 font-bold mt-0.5">
                            Bs. {subtotalBs}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cambiarCantidad(producto.id, -1)}
                            className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <span className="text-sm font-semibold w-4 text-center">
                            {cantidad}
                          </span>
                          <button
                            onClick={() => cambiarCantidad(producto.id, 1)}
                            className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                          <button
                            onClick={() => eliminarDelCarrito(producto.id)}
                            className="ml-2 text-red-500 hover:text-red-700 text-xs"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {carrito.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600 font-medium">Total Estimado:</span>
                  <span className="text-2xl font-bold text-leaf-800">
                    Bs. {totalBs.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={irAProcesarPedido}
                  className="w-full bg-leaf-600 hover:bg-leaf-700 text-white font-bold py-3 rounded-lg text-center transition-colors"
                >
                  Proceder a Enviar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}