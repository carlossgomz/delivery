import { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { orderEvents } from "@/lib/orderEvents";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return new Response("No autorizado", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Captura silenciosa por si el cliente se desconecta abruptamente
        }
      }

      send("connected", { ok: true });

      function onNewOrder(order: unknown) {
        send("nuevo_pedido", order);
      }
      function onOrderUpdated(order: unknown) {
        send("pedido_actualizado", order);
      }

      orderEvents.on("nuevo_pedido", onNewOrder);
      orderEvents.on("pedido_actualizado", onOrderUpdated);

      // Latido (heartbeat) para mantener viva la conexión a través de proxies/navegadores.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 20000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        orderEvents.off("nuevo_pedido", onNewOrder);
        orderEvents.off("pedido_actualizado", onOrderUpdated);
        try {
          controller.close();
        } catch {
          // Ignorar si el controlador ya fue cerrado
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}