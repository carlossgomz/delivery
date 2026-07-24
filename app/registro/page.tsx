"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function submit() {
    setError("");

    if (password !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono, direccion, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear la cuenta");
        return;
      }
      router.push("/");
    } catch {
      setError("No se pudo crear la cuenta. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="font-display text-xl text-leaf-800 mb-2">Crear cuenta</h1>
      <p className="text-sm text-ink/60 mb-6">
        Regístrate una vez y no tendrás que volver a escribir tus datos en cada pedido.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-ink/70 mb-1">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
            placeholder="Tu nombre completo"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Teléfono</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
            placeholder="04121234567"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Dirección de entrega</label>
          <textarea
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
            placeholder="Dirección exacta, punto de referencia..."
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div>
          <label className="block text-sm text-ink/70 mb-1">Confirmar contraseña</label>
          <input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full border border-leaf-100 rounded-lg px-3 py-3"
          />
        </div>

        {error && <p className="text-alert-600 text-sm">{error}</p>}

        <button
          disabled={!nombre || !telefono || !direccion || !password || !confirmar || enviando}
          onClick={submit}
          className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          {enviando ? "Creando cuenta…" : "Crear cuenta"}
        </button>

        <p className="text-sm text-ink/60 text-center pt-2">
          ¿Ya tienes cuenta?{" "}
          <Link href="/cliente/login" className="text-leaf-600 underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
