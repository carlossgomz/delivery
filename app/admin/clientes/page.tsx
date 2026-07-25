"use client";

import { useState } from "react";
import { soloDigitos } from "@/lib/cedula";

type Cliente = {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string;
  direccion: string;
};

// Genera una contraseña temporal fácil de dictar por teléfono: 6 dígitos.
function generarPasswordTemporal(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function AdminClientesPage() {
  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cedulaConsultada, setCedulaConsultada] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const [nuevaPassword, setNuevaPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [passwordAsignada, setPasswordAsignada] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  async function buscarCliente() {
    const cedulaLimpia = cedula.trim();
    if (!cedulaLimpia) return;

    setBuscando(true);
    setErrorBusqueda(null);
    setCliente(null);
    setPasswordAsignada(null);
    setErrorGuardar(null);
    setNuevaPassword("");

    try {
      const res = await fetch(`/api/clientes/buscar?cedula=${encodeURIComponent(cedulaLimpia)}`);
      const data = await res.json();
      setCliente(data.cliente ?? null);
      if (!data.cliente) {
        setErrorBusqueda("No existe ninguna cuenta con esa cédula.");
      }
      setCedulaConsultada(true);
    } catch (err) {
      console.error("Error al buscar cliente:", err);
      setErrorBusqueda("No se pudo consultar la cédula.");
    } finally {
      setBuscando(false);
    }
  }

  function usarPasswordGenerada() {
    setNuevaPassword(generarPasswordTemporal());
  }

  async function guardarNuevaPassword() {
    if (!cliente) return;
    if (nuevaPassword.length < 6) {
      setErrorGuardar("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setGuardando(true);
    setErrorGuardar(null);
    setPasswordAsignada(null);

    try {
      const res = await fetch("/api/clientes/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: cliente.cedula, newPassword: nuevaPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo actualizar la contraseña.");
      }

      setPasswordAsignada(nuevaPassword);
      setNuevaPassword("");
    } catch (err: any) {
      setErrorGuardar(err.message || "No se pudo actualizar la contraseña.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-xl text-leaf-800 mb-2">Clientes</h1>
      <p className="text-sm text-ink/60 mb-6">
        Cuando un cliente olvide su contraseña, pídele su cédula, búscala aquí y define una
        contraseña nueva para dictársela.
      </p>

      {/* BUSCAR POR CÉDULA */}
      <div className="flex gap-3 mb-2">
        <input
          type="text"
          value={cedula}
          onChange={(e) => setCedula(soloDigitos(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
          inputMode="numeric"
          placeholder="Cédula del cliente (solo números)"
          className="flex-1 border border-leaf-100 rounded-lg px-3 py-3"
        />
        <button
          onClick={buscarCliente}
          disabled={!cedula.trim() || buscando}
          className="px-5 py-2 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {cedulaConsultada && errorBusqueda && (
        <p className="text-sm text-alert-600 mt-2">{errorBusqueda}</p>
      )}

      {/* FICHA DEL CLIENTE Y RESTABLECER CONTRASEÑA */}
      {cliente && (
        <div className="mt-6 bg-white border border-leaf-100 rounded-lg p-5 space-y-5">
          <div>
            <p className="font-display text-lg text-leaf-800">{cliente.nombre}</p>
            <p className="text-sm text-ink/60">Cédula: {cliente.cedula}</p>
            <p className="text-sm text-ink/60">Teléfono: {cliente.telefono}</p>
            <p className="text-sm text-ink/60">Dirección: {cliente.direccion}</p>
          </div>

          <hr className="border-leaf-100" />

          <div>
            <p className="text-sm font-medium text-ink/80 mb-2">Restablecer contraseña</p>

            <div className="flex gap-3 mb-2">
              <input
                type="text"
                value={nuevaPassword}
                onChange={(e) => {
                  setNuevaPassword(e.target.value);
                  setPasswordAsignada(null);
                }}
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                className="flex-1 border border-leaf-100 rounded-lg px-3 py-3"
              />
              <button
                type="button"
                onClick={usarPasswordGenerada}
                className="px-4 py-2 rounded-lg border border-leaf-600 text-leaf-600 font-medium whitespace-nowrap"
              >
                Generar
              </button>
            </div>

            {errorGuardar && <p className="text-sm text-alert-600 mb-2">{errorGuardar}</p>}

            <button
              onClick={guardarNuevaPassword}
              disabled={guardando || nuevaPassword.length < 6}
              className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
            >
              {guardando ? "Guardando..." : "Guardar nueva contraseña"}
            </button>

            {passwordAsignada && (
              <div className="mt-4 bg-leaf-50 border border-leaf-100 rounded-lg p-4">
                <p className="text-sm text-leaf-800">
                  Contraseña actualizada. Dile al cliente que su nueva contraseña es:
                </p>
                <p className="font-display text-2xl text-leaf-800 mt-1 tracking-wide">
                  {passwordAsignada}
                </p>
                <p className="text-xs text-ink/50 mt-1">
                  Puede iniciar sesión con su cédula y esta contraseña, y luego cambiarla por la
                  que prefiera desde "Mi cuenta".
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}