"use client";

import { useEffect, useState } from "react";

export default function AdminHomePage() {
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [margenPorcentaje, setMargenPorcentaje] = useState<number>(0);
  const [nuevaTasa, setNuevaTasa] = useState<string>("");
  const [nuevoMargen, setNuevoMargen] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setTasaCambio(d.tasaCambio);
        setMargenPorcentaje(d.margenPorcentaje);
      });
  }, []);

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
      setMensaje("Tasa actualizada.");
    } else {
      setMensaje("No se pudo actualizar la tasa.");
    }
    setGuardando(false);
  }

  async function actualizarMargen() {
    setGuardando(true);
    setMensaje("");
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ margenPorcentaje: Number(nuevoMargen) })
    });
    if (res.ok) {
      const data = await res.json();
      setMargenPorcentaje(data.margenPorcentaje);
      setNuevoMargen("");
      setMensaje("Margen de ganancia actualizado. Se recalcularon todos los precios.");
    } else {
      setMensaje("No se pudo actualizar el margen.");
    }
    setGuardando(false);
  }

  return (
    <div>
      <h1 className="font-display text-xl text-leaf-800 mb-4">Tasa y margen</h1>

      <div className="bg-white border border-leaf-100 rounded-lg p-6 mb-4">
        <p className="text-sm text-ink/60">Tasa actual</p>
        <p className="font-display text-3xl text-leaf-800">{tasaCambio} Bs/USD</p>
      </div>
      <div className="flex gap-3 mb-8">
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
          className="px-5 py-2 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          Actualizar
        </button>
      </div>

      <div className="bg-white border border-leaf-100 rounded-lg p-6 mb-4">
        <p className="text-sm text-ink/60">Margen de ganancia general (sobre el costo)</p>
        <p className="font-display text-3xl text-leaf-800">{margenPorcentaje}%</p>
        <p className="text-xs text-ink/50 mt-1">
          El precio que ve el cliente = costo + este % + $0.15 de delivery. Los productos con un
          margen propio (editado en Productos) ignoran este número general.
        </p>
      </div>
      <div className="flex gap-3">
        <input
          type="number"
          step="1"
          value={nuevoMargen}
          onChange={(e) => setNuevoMargen(e.target.value)}
          placeholder="Nuevo margen, ej: 30"
          className="flex-1 border border-leaf-100 rounded-lg px-3 py-3"
        />
        <button
          disabled={!nuevoMargen || guardando}
          onClick={actualizarMargen}
          className="px-5 py-2 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          Actualizar
        </button>
      </div>

      {mensaje && <p className="text-sm mt-3 text-leaf-600">{mensaje}</p>}
    </div>
  );
}