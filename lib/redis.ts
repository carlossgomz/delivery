import { Redis } from "@upstash/redis";

// Cliente HTTP de Upstash: no mantiene una conexión TCP abierta, así que no
// importa cuántas instancias serverless levante Vercel — todas hablan con
// la misma base de Redis. Es justo lo que necesitamos para reemplazar el
// EventEmitter en memoria (ver lib/orderEvents.ts y lib/chatEvents.ts).
//
// La integración de Upstash desde el Marketplace de Vercel crea las
// variables con el naming legado de "Vercel KV" (KV_REST_API_URL /
// KV_REST_API_TOKEN) en vez de UPSTASH_REDIS_REST_URL / ...TOKEN. Soportamos
// ambos naming para no depender de cómo se haya conectado la integración.
const REST_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REST_URL || !REST_TOKEN) {
  throw new Error(
    "Faltan las variables de entorno de Redis (KV_REST_API_URL/KV_REST_API_TOKEN o UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN)"
  );
}

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis = globalForRedis.redis ?? new Redis({ url: REST_URL, token: REST_TOKEN });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
