"use client";

import { useEffect, useState } from "react";

type ConversacionResumen = {
  id: string;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  updatedAt: string;
  ultimoMensaje: string | null;
  noLeidos: number;
};

type MensajeHilo = {
  id: string;
  remitente: "CLIENTE" | "TIENDA";
  texto: string;
  createdAt: string;
};

// Mismo "ding" que ya se usa en Pedidos, para avisar de mensajes nuevos.
function sonarAlerta() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Sin audio no pasa nada grave.
  }
}

export default function AdminMensajesPage() {
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([]);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [hilo, setHilo] = useState<MensajeHilo[]>([]);
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [conectado, setConectado] = useState(false);

  async function cargarConversaciones() {
    const res = await fetch("/api/chat/conversaciones");
    if (!res.ok) return;
    const data = await res.json();
    setConversaciones(data.conversaciones ?? []);
  }

  async function abrirConversacion(id: string) {
    setSeleccionada(id);
    const res = await fetch(`/api/chat/conversaciones/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setHilo(data.conversacion?.mensajes ?? []);
    cargarConversaciones(); // para refrescar el contador de no leídos
  }

  async function responder() {
    if (!seleccionada || !respuesta.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/chat/conversaciones/${seleccionada}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: respuesta.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setHilo((prev) => [...prev, data.mensaje]);
        setRespuesta("");
      }
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    cargarConversaciones();

    const source = new EventSource("/api/chat/stream");
    source.addEventListener("connected", () => setConectado(true));

    source.addEventListener("nuevo_mensaje", (e) => {
      const payload = JSON.parse((e as MessageEvent).data);
      cargarConversaciones();
      if (payload.remitente === "CLIENTE") {
        sonarAlerta();
        // Si el mensaje es de la conversación que ya tengo abierta, la recargo.
        if (payload.conversacionId === seleccionada) {
          abrirConversacion(seleccionada);
        }
      }
    });

    source.onerror = () => setConectado(false);
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionada]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl text-leaf-800">Mensajes</h1>
        <span className={`text-xs flex items-center gap-1.5 ${conectado ? "text-leaf-600" : "text-alert-600"}`}>
          <span className={`w-2 h-2 rounded-full ${conectado ? "bg-leaf-600" : "bg-alert-600"}`} />
          {conectado ? "Recibiendo mensajes en vivo" : "Sin conexión — reintentando…"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* LISTA DE CONVERSACIONES */}
        <div className="sm:col-span-1 bg-white border border-leaf-100 rounded-lg overflow-hidden">
          {conversaciones.length === 0 && (
            <p className="text-xs text-ink/50 text-center py-8 px-3">Todavía no hay mensajes de clientes.</p>
          )}
          <ul className="divide-y divide-leaf-100/50 max-h-[32rem] overflow-y-auto">
            {conversaciones.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => abrirConversacion(c.id)}
                  className={`w-full text-left px-3 py-3 hover:bg-leaf-50/50 ${
                    seleccionada === c.id ? "bg-leaf-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">
                      {c.clienteNombre || c.clienteTelefono || "Cliente"}
                    </p>
                    {c.noLeidos > 0 && (
                      <span className="shrink-0 text-[10px] bg-alert-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        {c.noLeidos}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink/50 truncate">{c.ultimoMensaje ?? "—"}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* HILO DE LA CONVERSACIÓN */}
        <div className="sm:col-span-2 bg-white border border-leaf-100 rounded-lg flex flex-col h-[32rem]">
          {!seleccionada ? (
            <p className="m-auto text-sm text-ink/50">Selecciona una conversación para verla.</p>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-cream/30">
                {hilo.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                      m.remitente === "TIENDA"
                        ? "ml-auto bg-leaf-600 text-white rounded-br-sm"
                        : "mr-auto bg-white border border-leaf-100 text-ink rounded-bl-sm"
                    }`}
                  >
                    {m.texto}
                  </div>
                ))}
              </div>
              <div className="border-t border-leaf-100 p-3 flex gap-2">
                <input
                  value={respuesta}
                  onChange={(e) => setRespuesta(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && responder()}
                  placeholder="Escribe tu respuesta..."
                  className="flex-1 border border-leaf-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-leaf-500"
                />
                <button
                  onClick={responder}
                  disabled={enviando || !respuesta.trim()}
                  className="px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
