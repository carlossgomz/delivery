"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  codigo?: string | null;
  nombre: string;
  costoUsd: number;
  margenPorcentaje: number | null;
  categoria: string;
  precioUsd: number; // precio final calculado, solo para mostrar
};

export default function AdminProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [nombre, setNombre] = useState("");
  const [costoUsd, setCostoUsd] = useState("");
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
      body: JSON.stringify({ nombre, costoUsd, categoria })
    });
    setNombre("");
    setCostoUsd("");
    setCategoria("");
    cargar();
  }

  async function actualizarCosto(id: string, costoUsd: string) {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ costoUsd })
    });
    cargar();
  }

  async function actualizarMargen(id: string, margen: string) {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ margenPorcentaje: margen === "" ? null : margen })
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
      <p className="text-sm text-ink/60 mb-4">
        El costo es lo que pagas por el producto — nunca se muestra al cliente. El precio de
        delivery (lo que ve el cliente) se calcula solo: costo + margen de ganancia + $0.15.
      </p>

      <div className="bg-white border border-leaf-100 rounded-lg p-4 mb-6">
        <p className="text-sm text-ink/60 mb-3">Nuevo producto (precio de costo, no el de venta)</p>
        <div className="grid grid-cols-3 gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre"
            className="border border-leaf-100 rounded-lg px-3 py-2 col-span-1"
          />
          <input
            value={costoUsd}
            onChange={(e) => setCostoUsd(e.target.value)}
            placeholder="Costo USD"
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
          disabled={!nombre || !costoUsd || !categoria}
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
            className="flex flex-wrap items-center justify-between gap-3 bg-white border border-leaf-100 rounded-lg px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{p.nombre}</p>
              <p className="text-sm text-ink/60">
                {p.categoria} · Precio delivery: ${p.precioUsd.toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div>
                <label className="block text-xs text-ink/50">Costo</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={p.costoUsd}
                  onBlur={(e) => actualizarCosto(p.id, e.target.value)}
                  className="w-20 border border-leaf-100 rounded-lg px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-ink/50">Margen % (opcional)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="general"
                  defaultValue={p.margenPorcentaje ?? ""}
                  onBlur={(e) => actualizarMargen(p.id, e.target.value)}
                  className="w-24 border border-leaf-100 rounded-lg px-2 py-1 text-sm"
                />
              </div>
              <button onClick={() => desactivar(p.id)} className="text-sm text-alert-600 self-end">
                Desactivar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}