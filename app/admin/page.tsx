"use client";

import { useEffect, useState } from "react";

export default function AdminConfiguracionPage() {
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [nuevaTasa, setNuevaTasa] = useState<string>("");
  const [telefonoTienda, setTelefonoTienda] = useState<string>("");
  const [nuevoTelefono, setNuevoTelefono] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pedidosHabilitados, setPedidosHabilitados] = useState<boolean>(true);
  const [cambiandoPedidos, setCambiandoPedidos] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setTasaCambio(d.tasaCambio);
        setTelefonoTienda(d.telefonoTienda ?? "");
        setPedidosHabilitados(d.pedidosHabilitados ?? true);
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

  async function alternarPedidos() {
    const nuevoValor = !pedidosHabilitados;
    setCambiandoPedidos(true);
    setMensaje("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidosHabilitados: nuevoValor })
      });
      if (res.ok) {
        const data = await res.json();
        setPedidosHabilitados(data.pedidosHabilitados);
        setMensaje(
          data.pedidosHabilitados
            ? "Pedidos habilitados: los clientes ya pueden pedir."
            : "Pedidos deshabilitados: los clientes verán el aviso de horario y no podrán pedir."
        );
      } else {
        setMensaje("No se pudo actualizar el interruptor de pedidos.");
      }
    } catch (e) {
      console.error("Error al actualizar pedidosHabilitados:", e);
      setMensaje("No se pudo actualizar el interruptor de pedidos.");
    } finally {
      setCambiandoPedidos(false);
    }
  }

  return (
    <div>
      {/* INTERRUPTOR: ABRIR/CERRAR PEDIDOS */}
      <h1 className="font-display text-xl text-leaf-800 mb-4">Estado de la tienda</h1>
      <div
        className={`flex items-center justify-between gap-4 rounded-lg border p-4 mb-8 ${
          pedidosHabilitados
            ? "bg-leaf-50 border-leaf-100"
            : "bg-alert-50 border-alert-200"
        }`}
      >
        <div>
          <p className={`font-medium ${pedidosHabilitados ? "text-leaf-800" : "text-alert-700"}`}>
            {pedidosHabilitados ? "Recibiendo pedidos" : "Pedidos deshabilitados"}
          </p>
          <p className="text-xs text-ink/60 mt-0.5">
            {pedidosHabilitados
              ? "Los clientes pueden agregar productos y completar el pago."
              : "Los clientes verán el aviso de horario y no podrán completar un pedido. El catálogo y el registro de cuentas nuevas siguen funcionando."}
          </p>
        </div>
        <button
          onClick={alternarPedidos}
          disabled={cambiandoPedidos}
          role="switch"
          aria-checked={pedidosHabilitados}
          className={`shrink-0 relative w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${
            pedidosHabilitados ? "bg-leaf-600" : "bg-ink/20"
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              pedidosHabilitados ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

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
    </div>
  );
}
