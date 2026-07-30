"use client";

import { useEffect, useState } from "react";

export default function AdminConfiguracionPage() {
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [nuevaTasa, setNuevaTasa] = useState<string>("");
  const [telefonoTienda, setTelefonoTienda] = useState<string>("");
  const [nuevoTelefono, setNuevoTelefono] = useState<string>("");
  const [ganancia, setGanancia] = useState<number>(0.1);
  const [nuevaGanancia, setNuevaGanancia] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setTasaCambio(d.tasaCambio);
        setTelefonoTienda(d.telefonoTienda ?? "");
        setGanancia(d.ganancia ?? 0.1);
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

  async function actualizarTelefono() {
    setGuardando(true);
    setMensaje("");
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefonoTienda: nuevoTelefono })
    });
    if (res.ok) {
      const data = await res.json();
      setTelefonoTienda(data.telefonoTienda ?? "");
      setNuevoTelefono("");
      setMensaje("Teléfono actualizado.");
    } else {
      setMensaje("No se pudo actualizar el teléfono.");
    }
    setGuardando(false);
  }

  async function actualizarGanancia() {
    setGuardando(true);
    setMensaje("");
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ganancia: Number(nuevaGanancia) })
    });
    if (res.ok) {
      const data = await res.json();
      setGanancia(data.ganancia);
      setNuevaGanancia("");
      setMensaje("Ganancia actualizada.");
    } else {
      setMensaje("No se pudo actualizar la ganancia.");
    }
    setGuardando(false);
  }

  return (
    <div>
      <h1 className="font-display text-xl text-leaf-800 mb-4">Tasa de Cambio</h1>

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

      {mensaje && <p className="text-sm mt-3 text-leaf-600">{mensaje}</p>}

      {/* TELÉFONO DE LA TIENDA (llamadas y chat del cliente) */}
      <hr className="border-leaf-100 my-6" />
      <h2 className="font-display text-lg text-leaf-800 mb-3">Teléfono de la tienda</h2>
      <p className="text-xs text-ink/50 mb-3">
        Este es el número que usa el botón de "Llamar a la tienda" en la página del cliente.
      </p>
      <div className="bg-white border border-leaf-100 rounded-lg p-4 mb-4">
        <p className="text-sm text-ink/60">Número actual</p>
        <p className="font-display text-xl text-leaf-800">{telefonoTienda || "Sin definir"}</p>
      </div>
      <div className="flex gap-3">
        <input
          type="tel"
          value={nuevoTelefono}
          onChange={(e) => setNuevoTelefono(e.target.value)}
          placeholder="Ej: 04266215863"
          className="flex-1 border border-leaf-100 rounded-lg px-3 py-3"
        />
        <button
          disabled={!nuevoTelefono || guardando}
          onClick={actualizarTelefono}
          className="px-5 py-2 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          Actualizar
        </button>
      </div>

      {/* GANANCIA POR PRODUCTO */}
      <hr className="border-leaf-100 my-6" />
      <h2 className="font-display text-lg text-leaf-800 mb-3">Ganancia por producto</h2>
      <p className="text-xs text-ink/50 mb-3">
        Monto en $ que se suma al precio de cada producto antes de convertirlo a bolívares.
        Fórmula: (precio + ganancia) x tasa = total en Bs que ve el cliente.
      </p>
      <div className="bg-white border border-leaf-100 rounded-lg p-4 mb-4">
        <p className="text-sm text-ink/60">Ganancia actual</p>
        <p className="font-display text-xl text-leaf-800">${ganancia.toFixed(2)} por producto</p>
      </div>
      <div className="flex gap-3">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={nuevaGanancia}
          onChange={(e) => setNuevaGanancia(e.target.value)}
          placeholder="Ej: 0.10"
          className="flex-1 border border-leaf-100 rounded-lg px-3 py-3"
        />
        <button
          disabled={!nuevaGanancia || guardando}
          onClick={actualizarGanancia}
          className="px-5 py-2 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
