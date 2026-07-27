import { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { suscribirseAPedidos, type MensajePedido } from "@/lib/orderEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return new Response("No autorizado", { status: 401 });
  }

  let heartbeat: NodeJS.Timeout | null = null;
  let isClosed = false;
  const subscriber = suscribirseAPedidos();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          cleanup();
        }
      }

      function sendPing() {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }

      function onMessage({ message }: { message: MensajePedido }) {
        if (message.evento === "nuevo_pedido") send("nuevo_pedido", message.data);
        if (message.evento === "pedido_actualizado") send("pedido_actualizado", message.data);
      }

      function onError(err: unknown) {
        console.error("Error en suscripción Redis (pedidos):", err);
      }

      function cleanup() {
        if (isClosed) return;
        isClosed = true;

        if (heartbeat) clearInterval(heartbeat);

        // Cierra el stream HTTP de la suscripción en Redis. No hace falta
        // desenganchar los listeners a mano: una vez desuscritos no llega
        // nada más y el objeto se descarta junto con el resto del closure.
        subscriber.unsubscribe();

        try {
          controller.close();
        } catch {
          // Si el controlador ya fue cerrado por el runtime
        }
      }

      // Enviar mensaje inicial de conexión
      send("connected", { ok: true });

      // Suscribir al canal de pedidos en Redis (compartido entre todas las
      // instancias serverless, no solo el proceso actual)
      subscriber.on("message", onMessage);
      subscriber.on("error", onError);

      // Latido constante cada 20s para mantener viva la conexión HTTP
      heartbeat = setInterval(sendPing, 20000);

      // Si el cliente cierra la pestaña o aborta la petición
      if (req.signal.aborted) {
        cleanup();
      } else {
        req.signal.addEventListener("abort", cleanup, { once: true });
      }
    },
    cancel() {
      isClosed = true;
      if (heartbeat) clearInterval(heartbeat);
      subscriber.unsubscribe();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
