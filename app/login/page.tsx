"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      router.push("/admin");
    } else {
      setError("Contraseña incorrecta");
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="font-display text-xl text-leaf-800 mb-6">Acceso de tienda</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Contraseña"
        className="w-full border border-leaf-100 rounded-lg px-3 py-3 mb-3"
      />
      {error && <p className="text-alert-600 text-sm mb-3">{error}</p>}
      <button onClick={submit} className="w-full py-3 rounded-lg bg-leaf-600 text-white font-medium">
        Entrar
      </button>
    </main>
  );
}