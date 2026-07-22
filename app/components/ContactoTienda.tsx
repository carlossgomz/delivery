"use client";

import { useEffect, useRef, useState } from "react";

type Mensaje = {
  id: string;
  remitente: "CLIENTE" | "TIENDA";
  texto: string;
  createdAt: string;
};

const CLIENTE_ID_KEY = "delivery_cliente_id";
const POLL_MS = 4000;

function obtenerClienteId(): string {
  let id = localStorage.getItem(CLIENTE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENTE_ID_KEY, id);
  }
  return id;
}

// Convierte un número venezolano local (0426-6215863 / 04266215863) a
// formato internacional para el link "tel:". Si ya viene con "+", lo respeta.
function formatearTelParaLlamar(telefono: string): string {
  const limpio = telefono.replace(/[^\d+]/g, "");
  if (limpio.startsWith("+")) return limpio;
  if (limpio.startsWith("0")) return `+58${limpio.slice(1)}`;
  return `+58${limpio}`;
}

export default function ContactoTienda() {
  const [telefonoTienda, setTelefonoTienda] = useState<string | null>(null);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const clienteIdRef = useRef<string>("");
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clienteIdRef.current = obtenerClienteId();
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setTelefonoTienda(d.telefonoTienda ?? null))
      .catch(() => setTelefonoTienda(null));
  }, []);

  useEffect(() => {
    if (!chatAbierto) return;

    async function cargarMensajes() {
      try {
        const res = await fetch(`/api/chat/mensajes?clienteId=${clienteIdRef.current}`);
        const data = await res.json();
        setMensajes(data.mensajes ?? []);
      } catch (e) {
        console.error("Error al cargar mensajes:", e);
      }
    }

    cargarMensajes();
    const interval = setInterval(cargarMensajes, POLL_MS);
    return () => clearInterval(interval);
  }, [chatAbierto]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensajes, chatAbierto]);

  async function enviarMensaje() {
    const contenido = texto.trim();
    if (!contenido) return;

    setEnviando(true);
    // Optimista: lo muestro de una vez en pantalla mientras se guarda.
    const temporal: Mensaje = {
      id: `temp-${Date.now()}`,
      remitente: "CLIENTE",
      texto: contenido,
      createdAt: new Date().toISOString()
    };
    setMensajes((prev) => [...prev, temporal]);
    setTexto("");

    try {
      await fetch("/api/chat/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: clienteIdRef.current, texto: contenido })
      });
    } catch (e) {
      console.error("Error al enviar mensaje:", e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {/* Botones flotantes */}
      <div className="fixed bottom-24 right-4 z-30 flex flex-col items-end gap-2">
        {telefonoTienda && (
          <a
            href={`tel:${formatearTelParaLlamar(telefonoTienda)}`}
            className="w-12 h-12 rounded-full bg-clay-400 text-ink shadow-lg flex items-center justify-center text-xl"
            aria-label="Llamar a la tienda"
            title="Llamar a la tienda"
          >
            📞
          </a>
        )}
        <button
          onClick={() => setChatAbierto((v) => !v)}
          className="w-12 h-12 rounded-full bg-leaf-600 text-white shadow-lg flex items-center justify-center text-xl"
          aria-label="Escribir a la tienda"
          title="Escribir a la tienda"
        >
          💬
        </button>
      </div>

      {/* Panel de chat */}
      {chatAbierto && (
        <div className="fixed bottom-40 right-4 z-30 w-[calc(100vw-2rem)] max-w-sm bg-white border border-leaf-100 rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div className="bg-leaf-800 text-white px-4 py-3 flex items-center justify-between">
            <span className="font-medium text-sm">Escríbenos</span>
            <button onClick={() => setChatAbierto(false)} className="text-white/80 hover:text-white text-sm">
              ✕
            </button>
          </div>

          <div ref={listaRef} className="flex-1 max-h-72 overflow-y-auto px-3 py-3 space-y-2 bg-cream/40">
            {mensajes.length === 0 && (
              <p className="text-xs text-ink/50 text-center py-6">
                Escríbenos cualquier duda sobre tu pedido, disponibilidad o precios.
              </p>
            )}
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  m.remitente === "CLIENTE"
                    ? "ml-auto bg-leaf-600 text-white rounded-br-sm"
                    : "mr-auto bg-white border border-leaf-100 text-ink rounded-bl-sm"
                }`}
              >
                {m.texto}
              </div>
            ))}
          </div>

          <div className="border-t border-leaf-100 p-2 flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
              placeholder="Escribe tu mensaje..."
              className="flex-1 border border-leaf-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-leaf-500"
            />
            <button
              onClick={enviarMensaje}
              disabled={enviando || !texto.trim()}
              className="px-3 py-2 rounded-lg bg-leaf-600 text-white text-sm disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
