import { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { suscribirseAChat, type MensajeChat } from "@/lib/chatEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return new Response("No autorizado", { status: 401 });
  }

  const subscriber = suscribirseAChat();
  let heartbeat: NodeJS.Timeout | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        if (isClosed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      function cleanup() {
        if (isClosed) return;
        isClosed = true;
        if (heartbeat) clearInterval(heartbeat);
        subscriber.unsubscribe();
        try {
          controller.close();
        } catch {
          // Si el controlador ya fue cerrado por el runtime
        }
      }

      send("connected", { ok: true });

      subscriber.on("message", (data: { message: unknown }) => {
        const message = data.message as MensajeChat;
        send("nuevo_mensaje", message);
      });

      subscriber.on("error", (err: unknown) => {
        console.error("Error en suscripción Redis (chat):", err);
      });

      heartbeat = setInterval(() => {
        if (isClosed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 20000);

      req.signal.addEventListener("abort", cleanup, { once: true });
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
      Connection: "keep-alive"
    }
  });
}
