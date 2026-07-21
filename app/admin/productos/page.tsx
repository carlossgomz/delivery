"use client";

import { useEffect, useState } from "react";

type Product = { id: string; nombre: string; precioUsd: number; categoria: string; activo: boolean };

export default function AdminProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [nombre, setNombre] = useState("");
  const [precioUsd, setPrecioUsd] = useState("");
  const [categoria, setCategoria] = useState("");

  async function cargar() {
    const res = await fetch("/api/products");
    setProducts((await res.json()).products);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, precioUsd, categoria })
    });
    setNombre("");
    setPrecioUsd("");
    setCategoria("");
    cargar();
  }

  async function actualizarPrecio(id: string, precioUsd: string) {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precioUsd })
    });
    cargar();
  }

  async function desactivar(id: string) {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: false })
    });
    cargar();
  }

  return (
    <div>
      <h1 className="font-display text-xl text-leaf-800 mb-4">Productos</h1>

      <div className="bg-white border border-leaf-100 rounded-lg p-4 mb-6">
        <p className="text-sm text-ink/60 mb-3">Nuevo producto (el precio se carga en USD)</p>
        <div className="grid grid-cols-3 gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre"
            className="border border-leaf-100 rounded-lg px-3 py-2 col-span-1"
          />
          <input
            value={precioUsd}
            onChange={(e) => setPrecioUsd(e.target.value)}
            placeholder="Precio USD"
            type="number"
            step="0.01"
            className="border border-leaf-100 rounded-lg px-3 py-2"
          />
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Categoría"
            className="border border-leaf-100 rounded-lg px-3 py-2"
          />
        </div>
        <button
          disabled={!nombre || !precioUsd || !categoria}
          onClick={crear}
          className="mt-3 px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm disabled:opacity-40"
        >
          Agregar producto
        </button>
      </div>

      <ul className="space-y-2">
        {products.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between bg-white border border-leaf-100 rounded-lg px-4 py-3"
          >
            <div>
              <p className="font-medium">{p.nombre}</p>
              <p className="text-sm text-ink/60">{p.categoria}</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                defaultValue={p.precioUsd}
                onBlur={(e) => actualizarPrecio(p.id, e.target.value)}
                className="w-24 border border-leaf-100 rounded-lg px-2 py-1 text-sm"
              />
              <button onClick={() => desactivar(p.id)} className="text-sm text-alert-600">
                Desactivar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
