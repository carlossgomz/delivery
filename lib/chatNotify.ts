import { prisma } from "@/lib/prisma";
import { emitirNuevoMensaje } from "@/lib/chatEvents";

// Envía un mensaje automático de "TIENDA" a la conversación de un cliente
// con cuenta (mismo chat que usa el botón "💬 Contacto"). Se usa para
// avisar de cosas que pasaron del lado de la tienda sin que el cliente
// tenga que estar mirando la pantalla en ese momento (ej. un ajuste de
// cantidad/peso en su pedido). Los clientes invitados (sin cuenta) no
// tienen una conversación enlazable de forma confiable, así que esta
// función solo aplica a clienteId de cuentas registradas.
export async function notificarClientePorChat(clienteId: string, texto: string) {
  try {
    const conversacion = await prisma.conversacion.upsert({
      where: { clienteId },
      update: { updatedAt: new Date() },
      create: { clienteId }
    });

    await prisma.mensaje.create({
      data: {
        conversacionId: conversacion.id,
        remitente: "TIENDA",
        texto
      }
    });

    await emitirNuevoMensaje({ conversacionId: conversacion.id, remitente: "TIENDA" });
  } catch (e) {
    // Si esto falla, no debe tumbar la operación principal (ej. guardar el
    // ajuste de un pedido) — el aviso por chat es un plus, no algo crítico.
    console.error("Error al notificar al cliente por chat:", e);
  }
}
