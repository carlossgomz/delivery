"use client";

import { useEffect, useState } from "react";
import { soloDigitos } from "@/lib/cedula";
import { normalizarTexto } from "@/lib/texto";

type Cliente = {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string;
  direccion: string;
  creditoAutorizado?: boolean;
};

// Genera una contraseña temporal fácil de dictar por teléfono: 6 dígitos.
function generarPasswordTemporal(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function AdminClientesPage() {
  // Lista completa de clientes registrados, mostrada comprimida (solo el
  // nombre) con una flecha para desplegar el resto de sus datos.
  const [listado, setListado] = useState<Cliente[]>([]);
  const [cargandoListado, setCargandoListado] = useState(true);
  const [errorListado, setErrorListado] = useState<string | null>(null);
  const [filtroListado, setFiltroListado] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    cargarListado();
  }, []);

  async function cargarListado() {
    setCargandoListado(true);
    setErrorListado(null);
    try {
      const res = await fetch("/api/clientes", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setListado(Array.isArray(data.clientes) ? data.clientes : []);
    } catch (e) {
      console.error("Error al cargar clientes:", e);
      setErrorListado("No se pudo cargar la lista de clientes.");
    } finally {
      setCargandoListado(false);
    }
  }

  function alternarExpandido(id: string) {
    setExpandidos((prev) => {
      const copia = new Set(prev);
      if (copia.has(id)) {
        copia.delete(id);
      } else {
        copia.add(id);
      }
      return copia;
    });
  }

  const listadoFiltrado = listado.filter((c) => {
    const q = normalizarTexto(filtroListado);
    if (!q) return true;
    return normalizarTexto(c.nombre).includes(q) || c.cedula.includes(filtroListado.trim());
  });

  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cedulaConsultada, setCedulaConsultada] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const [nuevaPassword, setNuevaPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [passwordAsignada, setPasswordAsignada] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  // Crédito autorizado por la tienda
  const [guardandoCredito, setGuardandoCredito] = useState(false);
  const [errorCredito, setErrorCredito] = useState<string | null>(null);

  async function alternarCredito() {
    if (!cliente) return;
    const nuevoValor = !cliente.creditoAutorizado;
    setGuardandoCredito(true);
    setErrorCredito(null);

    try {
      const res = await fetch("/api/clientes/credito", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: cliente.cedula, creditoAutorizado: nuevoValor })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo actualizar el crédito.");
      }

      const data = await res.json();
      setCliente(data.cliente);
    } catch (err: any) {
      setErrorCredito(err.message || "No se pudo actualizar el crédito.");
    } finally {
      setGuardandoCredito(false);
    }
  }

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

      {/* LISTA DE CLIENTES REGISTRADOS (comprimida, con flecha para ver el detalle) */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-medium text-ink/80">
            Clientes registrados {!cargandoListado && `(${listado.length})`}
          </h2>
        </div>

        <input
          type="text"
          value={filtroListado}
          onChange={(e) => setFiltroListado(e.target.value)}
          placeholder="Filtrar por nombre o cédula..."
          className="w-full border border-leaf-100 rounded-lg px-3 py-2 text-sm mb-3"
        />

        {cargandoListado && <p className="text-sm text-ink/50">Cargando clientes...</p>}
        {errorListado && <p className="text-sm text-alert-600">{errorListado}</p>}

        {!cargandoListado && !errorListado && (
          <div className="bg-white border border-leaf-100 rounded-lg divide-y divide-leaf-50 overflow-hidden">
            {listadoFiltrado.map((c) => {
              const abierto = expandidos.has(c.id);
              return (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={() => alternarExpandido(c.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-leaf-50/40 transition-colors"
                    aria-expanded={abierto}
                  >
                    <span className="font-medium text-sm text-ink/80 truncate">
                      {c.nombre}
                      {c.creditoAutorizado && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-clay-100 text-clay-600 font-medium align-middle">
                          🤝 Crédito
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 text-ink/40 transition-transform ${abierto ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </button>

                  {abierto && (
                    <div className="px-4 pb-3 -mt-1 text-sm text-ink/60 space-y-0.5">
                      <p>Cédula: {c.cedula}</p>
                      <p>Teléfono: {c.telefono}</p>
                      <p>Dirección: {c.direccion}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {listadoFiltrado.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-ink/50">
                {filtroListado ? "No se encontraron clientes." : "Todavía no hay clientes registrados."}
              </p>
            )}
          </div>
        )}
      </div>

      <hr className="border-leaf-100 mb-8" />

      <h2 className="text-sm font-medium text-ink/80 mb-2">Restablecer contraseña / gestionar crédito</h2>

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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink/80">🤝 Crédito autorizado</p>
                <p className="text-xs text-ink/50 mt-0.5">
                  Permite que este cliente reciba pedidos y los pague después, sin subir
                  comprobante al momento.
                </p>
              </div>
              <button
                onClick={alternarCredito}
                disabled={guardandoCredito}
                aria-pressed={!!cliente.creditoAutorizado}
                className={`shrink-0 relative w-12 h-7 rounded-full transition-colors disabled:opacity-40 ${
                  cliente.creditoAutorizado ? "bg-leaf-600" : "bg-leaf-100"
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    cliente.creditoAutorizado ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {errorCredito && <p className="text-sm text-alert-600 mt-2">{errorCredito}</p>}
            <p className={`text-xs mt-2 font-medium ${cliente.creditoAutorizado ? "text-leaf-700" : "text-ink/40"}`}>
              {cliente.creditoAutorizado ? "✅ Crédito activado" : "Crédito desactivado"}
            </p>
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
