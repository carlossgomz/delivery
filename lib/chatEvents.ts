import { EventEmitter } from "events";

// Mismo patrón que orderEvents.ts: vive mientras el proceso de Next.js esté
// corriendo, alcanza para un solo servidor.
const globalForEvents = globalThis as unknown as { chatEvents?: EventEmitter };

export const chatEvents = globalForEvents.chatEvents ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") globalForEvents.chatEvents = chatEvents;
