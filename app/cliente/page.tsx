"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Cliente = { id: string; nombre: string; telefono: string; direccion: string };

export default function MiCuentaPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/clientes/me");
      const data = await res.json();
      if (!data.cliente) {
        router.push("/cliente/login");
        return;
      }
      setCliente(data.cliente);
      setNombre(data.cliente.nombre);
      setDireccion(data.cliente.direccion);
      setLoading(false);
    }
    load();
  }, [router]);

  async function guardar() {
    setGuardando(true);
    setMensaje("");
    const res = await fetch("/api/clientes/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, direccion })
    });
    if (res.ok) {
      const data = await res.json();
      setCliente(data.cliente);
      setMensaje("Datos actualizados.");
    } else {
      setMensaje("No se pudo guardar el cambio.");
    }
    setGuardando(false);
  }

  async function cerrarSesion() {
    await fetch("/api/clientes/logout", { method: "POST" });
    router.push("/");
  }

  if (loading || !cliente) {
    return <div className="p-8 text-leaf-600">Cargando…</div>;
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-10">
      <h1 className="font-display text-xl text-leaf-800 mb-6">Mi cuenta</h1>

      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-sm text-ink/70 mb-1">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Teléfono</label>
          <input
            value={cliente.telefono}
            disabled
            className="w-full border border-leaf-100 rounded-lg px-3 py-3 bg-leaf-50 text-ink/50"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Dirección de entrega</label>
          <textarea
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
          />
        </div>
        {mensaje && <p className="text-sm text-leaf-600">{mensaje}</p>}
        <button
          disabled={guardando}
          onClick={guardar}
          className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <Link
        href="/cliente/pedidos"
        className="block w-full text-center py-3 rounded-lg border border-leaf-100 text-leaf-800 font-medium mb-3"
      >
        Ver mis pedidos
      </Link>

      <button
        onClick={cerrarSesion}
        className="w-full py-3 rounded-lg border border-alert-600 text-alert-600 font-medium"
      >
        Cerrar sesión
      </button>
    </main>
  );
}
