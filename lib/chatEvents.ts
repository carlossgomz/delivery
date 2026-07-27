import { redis } from "@/lib/redis";

// Mismo cambio que en orderEvents.ts: de EventEmitter en memoria a pub/sub
// de Upstash Redis, para que funcione entre distintas instancias serverless.
const CANAL_CHAT = "chat";

export type MensajeChat = {
  conversacionId: string;
  remitente: "CLIENTE" | "TIENDA";
};

export async function emitirNuevoMensaje(payload: MensajeChat) {
  try {
    await redis.publish(CANAL_CHAT, payload);
  } catch (e) {
    console.error("Error al publicar evento de chat en Redis:", e);
  }
}

// Subscriber de @upstash/redis: usar .on("message", ...) y .unsubscribe()
// al terminar.
export function suscribirseAChat() {
  return redis.subscribe([CANAL_CHAT]);
}
