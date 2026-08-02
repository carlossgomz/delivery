import { redis } from "@/lib/redis";

// Antes esto era un EventEmitter en memoria. Funcionaba en local (un solo
// proceso de Node) pero en Vercel cada request puede caer en una instancia
// (lambda) distinta: el emit() de un POST /api/orders no le llegaba al
// listener de la conexión SSE del panel de admin si esta vivía en otra
// instancia — por eso a veces no sonaba la alerta de pedido nuevo.
//
// Ahora usamos el pub/sub de Upstash Redis (HTTP streaming, no requiere una
// conexión TCP persistente), que es compartido por todas las instancias.
const CANAL_PEDIDOS = "pedidos";

export type EventoPedido = "nuevo_pedido" | "pedido_actualizado" | "pedido_eliminado";

export type MensajePedido = {
  evento: EventoPedido;
  data: unknown;
};

export async function emitirEventoPedido(evento: EventoPedido, data: unknown) {
  try {
    await redis.publish(CANAL_PEDIDOS, { evento, data } satisfies MensajePedido);
  } catch (e) {
    // Igual que antes: si falla la notificación en vivo, no debe tumbar la
    // operación principal (crear/actualizar el pedido ya se guardó en la BD).
    console.error("Error al publicar evento de pedido en Redis:", e);
  }
}

// Devuelve un Subscriber (ver @upstash/redis) al que hay que engancharle
// .on("message", ...) y, al terminar, llamarle .unsubscribe().
export function suscribirseAPedidos() {
  return redis.subscribe([CANAL_PEDIDOS]);
}
