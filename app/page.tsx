"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  nombre: string;
  precioUsd: number;
  categoria: string;
};

type CartLine = { productId: string; cantidad: number };

const CART_KEY = "delivery_cart";

export default function CatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [pRes, cRes] = await Promise.all([fetch("/api/products"), fetch("/api/config")]);
      const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
      setProducts(pData.products);
      setTasaCambio(cData.tasaCambio);
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
      <header className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm border-b border-leaf-100 -mx-4 px-4 py-4 flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-leaf-800">Tienda</h1>
        <span className="text-sm text-ink/60">Tasa: {tasaCambio} Bs/USD</span>
      </header>

      {categorias.map((cat) => (
        <section key={cat} className="mb-8">
          <h2 className="text-sm uppercase tracking-wide text-leaf-600 mb-3">{cat}</h2>
          <ul className="space-y-2">
            {products
              .filter((p) => p.categoria === cat)
              .map((p) => {
                const line = cart.find((l) => l.productId === p.id);
                const precioBs = (p.precioUsd * tasaCambio).toFixed(2);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 bg-white rounded-lg border border-leaf-100 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.nombre}</p>
                      <p className="text-sm text-ink/60">
                        ${p.precioUsd.toFixed(2)} · Bs {precioBs}
                      </p>
                    </div>
                    {line ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => removeFromCart(p.id)}
                          className="w-10 h-10 shrink-0 rounded-full border border-leaf-400 text-leaf-600 text-lg"
                          aria-label={`Quitar una unidad de ${p.nombre}`}
                        >
                          −
                        </button>
                        <span className="w-5 text-center">{line.cantidad}</span>
                        <button
                          onClick={() => addToCart(p.id)}
                          className="w-10 h-10 shrink-0 rounded-full bg-leaf-600 text-white text-lg"
                          aria-label={`Agregar una unidad de ${p.nombre}`}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(p.id)}
                        className="shrink-0 px-4 py-2.5 rounded-lg bg-leaf-600 text-white text-sm"
                      >
                        Agregar
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {totalItems > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-leaf-800 text-white px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-leaf-100">{totalItems} producto(s)</p>
              <p className="font-medium truncate">
                ${totalUsd.toFixed(2)} · Bs {(totalUsd * tasaCambio).toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => router.push("/checkout")}
              className="shrink-0 px-5 py-3 rounded-lg bg-clay-400 text-ink font-medium"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}