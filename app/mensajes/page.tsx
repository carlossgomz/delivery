"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ContactoTienda from "@/app/components/ContactoTienda";

// Convierte un número venezolano local (0426-6215863 / 04266215863) a
// formato internacional para el link "tel:". Si ya viene con "+", lo respeta.
function formatearTelParaLlamar(telefono: string): string {
  const limpio = telefono.replace(/[^\d+]/g, "");
  if (limpio.startsWith("+")) return limpio;
  if (limpio.startsWith("0")) return `+58${limpio.slice(1)}`;
  return `+58${limpio}`;
}

export default function MensajesPage() {
  const [telefonoTienda, setTelefonoTienda] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setTelefonoTienda(d.telefonoTienda ?? null))
      .catch(() => setTelefonoTienda(null));
  }, []);

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm text-leaf-600 underline">
          ← Volver al catálogo
        </Link>
        <h1 className="font-display text-lg text-leaf-800">Contacto con la tienda</h1>
      </div>

      {telefonoTienda && (
        <a
          href={`tel:${formatearTelParaLlamar(telefonoTienda)}`}
          className="mb-4 flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-clay-400 text-ink font-medium hover:opacity-90 transition-opacity"
        >
          📞 Llamar a la tienda
        </a>
      )}

      <p className="text-xs text-ink/50 mb-3">
        ¿Prefieres escribir? Mándanos tu duda aquí abajo y te respondemos apenas podamos.
      </p>

      <ContactoTienda />
    </main>
  );
}
