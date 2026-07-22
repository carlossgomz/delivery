import { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { chatEvents } from "@/lib/chatEvents";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return new Response("No autorizado", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      send("connected", { ok: true });

      function onNuevoMensaje(payload: unknown) {
        send("nuevo_mensaje", payload);
      }

      chatEvents.on("nuevo_mensaje", onNuevoMensaje);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 20000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        chatEvents.off("nuevo_mensaje", onNuevoMensaje);
        controller.close();
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
