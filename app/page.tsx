"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ContactoTienda from "@/app/components/ContactoTienda";

type Product = {
  id: string;
  nombre: string;
  precioUsd: number;
  categoria: string;
};

type Cliente = { id: string; nombre: string };

type CartLine = { productId: string; cantidad: number };

const CART_KEY = "delivery_cart";

export default function CatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  // Estados para búsqueda y categoría
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  useEffect(() => {
    async function load() {
      const [pRes, cRes, meRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/config"),
        fetch("/api/clientes/me")
      ]);
      const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
      setProducts(pData.products);
      setTasaCambio(cData.tasaCambio);
      if (meRes.ok) {
        const meData = await meRes.json();
        setCliente(meData.cliente);
      }
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved));
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const categorias = useMemo(() => Array.from(new Set(products.map((p) => p.categoria))), [products]);

  // Filtrado de productos basado en búsqueda y categoría seleccionada
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "Todas" || p.categoria === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Categorías que tienen productos visibles tras el filtrado
  const activeCategories = useMemo(() => {
    if (selectedCategory !== "Todas") {
      return [selectedCategory];
    }
    return Array.from(new Set(filteredProducts.map((p) => p.categoria)));
  }, [filteredProducts, selectedCategory]);

  function addToCart(productId: string) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) => (l.productId === productId ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [...prev, { productId, cantidad: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, cantidad: l.cantidad - 1 } : l))
        .filter((l) => l.cantidad > 0)
    );
  }

  const totalItems = cart.reduce((sum, l) => sum + l.cantidad, 0);
  const totalUsd = cart.reduce((sum, l) => {
    const p = products.find((pr) => pr.id === l.productId);
    return sum + (p ? p.precioUsd * l.cantidad : 0);
  }, 0);

  if (loading) {
    return <div className="p-8 text-leaf-600">Cargando catálogo…</div>;
  }

  return (
    <main className="max-w-3xl mx-auto px-4 pb-32">
      <header className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm border-b border-leaf-100 -mx-4 px-4 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl text-leaf-800">Tienda</h1>
        <Link href={cliente ? "/cliente" : "/cliente/login"} className="text-sm text-leaf-600 underline">
          {cliente ? `Hola, ${cliente.nombre.split(" ")[0]}` : "Iniciar sesión"}
        </Link>
      </header>

      {/* --- BARRA DE BÚSQUEDA Y CATEGORÍAS --- */}
      <div className="mb-6 space-y-4">
        {/* Input de Búsqueda */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-leaf-100 bg-white text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-leaf-600 transition-all text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/40 hover:text-ink/80"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Chips de Categorías */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {["Todas", ...categorias].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat
                ? "bg-leaf-600 text-white"
                : "bg-white text-ink/70 border border-leaf-100 hover:bg-leaf-100/50"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      {/* --------------------------------------- */}

      {/* Lista de Secciones por Categoría */}
      {activeCategories.length > 0 ? (
        activeCategories.map((cat) => {
          const categoryProducts = filteredProducts.filter((p) => p.categoria === cat);
          if (categoryProducts.length === 0) return null;

          return (
            <section key={cat} className="mb-8">
              <h2 className="text-sm uppercase tracking-wide text-leaf-600 mb-3">{cat}</h2>
              <ul className="space-y-2">
                {categoryProducts.map((p) => {
                  const line = cart.find((l) => l.productId === p.id);
                  const precioBs = (p.precioUsd * tasaCambio).toFixed(2);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between bg-white rounded-lg border border-leaf-100 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{p.nombre}</p>
                        <p className="text-sm text-ink/60">Bs {precioBs}</p>
                      </div>
                      {line ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => removeFromCart(p.id)}
                            className="w-8 h-8 rounded-full border border-leaf-400 text-leaf-600 flex items-center justify-center font-bold"
                            aria-label={`Quitar una unidad de ${p.nombre}`}
                          >
                            −
                          </button>
                          <span className="w-4 text-center">{line.cantidad}</span>
                          <button
                            onClick={() => addToCart(p.id)}
                            className="w-8 h-8 rounded-full bg-leaf-600 text-white flex items-center justify-center font-bold"
                            aria-label={`Agregar una unidad de ${p.nombre}`}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p.id)}
                          className="px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm hover:bg-leaf-800 transition-colors"
                        >
                          Agregar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      ) : (
        <div className="text-center py-12 text-ink/60 text-sm">
          No se encontraron productos que coincidan con la búsqueda.
        </div>
      )}

      {totalItems > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-leaf-800 text-white px-4 py-4 z-10">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-leaf-100">{totalItems} producto(s)</p>
              <p className="font-medium truncate">Bs {(totalUsd * tasaCambio).toFixed(2)}</p>
            </div>
            <button
              onClick={() => router.push("/checkout")}
              className="px-5 py-3 rounded-lg bg-clay-400 text-ink font-medium hover:opacity-90 transition-opacity"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
      <ContactoTienda />
    </main>
  );
}