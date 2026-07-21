import { EventEmitter } from "events";

// Vive mientras el proceso de Next.js esté corriendo (npm run dev / npm start).
// Sirve para un solo servidor. Si el día de mañana se despliega en varias
// instancias (ej. serverless con autoescalado), esto habría que moverlo a
// algo compartido como Redis pub/sub — para el tamaño de esta tienda, esto alcanza.
const globalForEvents = globalThis as unknown as { orderEvents?: EventEmitter };

export const orderEvents = globalForEvents.orderEvents ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") globalForEvents.orderEvents = orderEvents;
