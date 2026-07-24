"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ClienteLoginPage() {
  const router = useRouter();
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function submit() {
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/clientes/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo iniciar sesión");
        return;
      }
      router.push("/");
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="font-display text-xl text-leaf-800 mb-6">Iniciar sesión</h1>
      <div className="space-y-3">
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Teléfono"
          className="w-full border border-leaf-100 rounded-lg px-3 py-3"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Contraseña"
          className="w-full border border-leaf-100 rounded-lg px-3 py-3"
        />
        {error && <p className="text-alert-600 text-sm">{error}</p>}
        <button
          disabled={!telefono || !password || enviando}
          onClick={submit}
          className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium disabled:opacity-40"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-sm text-ink/60 text-center pt-2">
          ¿Aún no tienes cuenta?{" "}
          <Link href="/registro" className="text-leaf-600 underline">
            Regístrate
          </Link>
        </p>
      </div>
    </main>
  );
}
