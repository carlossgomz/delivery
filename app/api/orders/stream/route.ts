import { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { orderEvents } from "@/lib/orderEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return new Response("No autorizado", { status: 401 });
  }

  let heartbeat: NodeJS.Timeout | null = null;
  let isClosed = false;

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

      function onNewOrder(order: unknown) {
        send("nuevo_pedido", order);
      }

      function onOrderUpdated(order: unknown) {
        send("pedido_actualizado", order);
      }

      function cleanup() {
        if (isClosed) return;
        isClosed = true;

        if (heartbeat) clearInterval(heartbeat);

        orderEvents.off("nuevo_pedido", onNewOrder);
        orderEvents.off("pedido_actualizado", onOrderUpdated);

        try {
          controller.close();
        } catch {
          // Si el controlador ya fue cerrado por el runtime
        }
      }

      // Enviar mensaje inicial de conexión
      send("connected", { ok: true });

      // Suscribir a los eventos globales de pedidos
      orderEvents.on("nuevo_pedido", onNewOrder);
      orderEvents.on("pedido_actualizado", onOrderUpdated);

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