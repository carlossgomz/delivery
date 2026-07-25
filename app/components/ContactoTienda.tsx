"use client";

import { useEffect, useRef, useState } from "react";

type Mensaje = {
  id: string;
  remitente: "CLIENTE" | "TIENDA";
  texto: string;
  createdAt: string;
};

type Cliente = { id: string; nombre: string; telefono: string } | null;

const CLIENTE_ID_KEY = "delivery_cliente_id";
const POLL_MS = 4000;

function obtenerClienteIdInvitado(): string {
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

// Panel de chat con la tienda. Vive en su propia página (/mensajes) en vez
// de flotar sobre el catálogo: así no tapa productos ni botones mientras
// el cliente compra. Si el cliente tiene una cuenta iniciada, la
// conversación queda ligada a su cuenta (mismo id en cualquier
// dispositivo) y el mensaje llega a la tienda con su nombre real; si es
// invitado, se usa un id anónimo guardado en este navegador y en el panel
// de la tienda aparece simplemente como "Cliente".
export default function ContactoTienda() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const clienteIdRef = useRef<string>("");
  const clienteRef = useRef<Cliente>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function iniciar() {
      try {
        const meRes = await fetch("/api/clientes/me");
        const meData = meRes.ok ? await meRes.json() : { cliente: null };
        if (meData.cliente) {
          clienteRef.current = meData.cliente;
          clienteIdRef.current = meData.cliente.id;
        } else {
          clienteIdRef.current = obtenerClienteIdInvitado();
        }
      } catch {
        clienteIdRef.current = obtenerClienteIdInvitado();
      } finally {
        setListo(true);
      }
    }
    iniciar();
  }, []);

  useEffect(() => {
    if (!listo) return;

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
  }, [listo]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensajes]);

  async function enviarMensaje() {
    const contenido = texto.trim();
    if (!contenido) return;

    setEnviando(true);
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
        body: JSON.stringify({
          clienteId: clienteIdRef.current,
          texto: contenido,
          clienteNombre: clienteRef.current?.nombre,
          clienteTelefono: clienteRef.current?.telefono
        })
      });
    } catch (e) {
      console.error("Error al enviar mensaje:", e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-white border border-leaf-100 rounded-lg shadow-sm flex flex-col overflow-hidden h-[28rem]">
      <div ref={listaRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-cream/40">
        {listo && mensajes.length === 0 && (
          <p className="text-xs text-ink/50 text-center py-8">
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
  );
}
