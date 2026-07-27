# Migración del "tiempo real" a Upstash Redis

Este zip contiene SOLO los archivos que cambiaron respecto a tu proyecto,
con la misma ruta relativa. Para aplicarlo: copiá cada archivo sobre el
mismo path en tu repo (pisando el existente), respetando la estructura de
carpetas.

## Archivos

Nuevo:
- `lib/redis.ts` — cliente de Upstash Redis.

Modificados (reemplazan el EventEmitter en memoria por pub/sub de Redis):
- `lib/orderEvents.ts`
- `lib/chatEvents.ts`
- `lib/chatNotify.ts`
- `app/api/orders/route.ts`
- `app/api/orders/[id]/route.ts`
- `app/api/orders/telefono/route.ts`
- `app/api/orders/stream/route.ts`
- `app/api/chat/mensajes/route.ts`
- `app/api/chat/conversaciones/[id]/route.ts`
- `app/api/chat/stream/route.ts`
- `package.json` — se agregó la dependencia `@upstash/redis`.
- `.env.example` — se agregaron `UPSTASH_REDIS_REST_URL` y
  `UPSTASH_REDIS_REST_TOKEN` (con valores de ejemplo, no reales).

**Importante:** tu `.env` real NO está en este zip porque tiene tus
credenciales. Agregale a mano las dos variables de Upstash (ver abajo).

## Pasos

1. Copiar estos archivos sobre tu repo.
2. `npm install` (para bajar `@upstash/redis`, ya agregado a `package.json`).
3. Crear la base de Upstash y configurar las variables de entorno — ver los
   pasos que te pasé en el chat.
4. `npm run dev` y probar: abrir el panel de admin en una pestaña y crear
   un pedido en otra para confirmar que la alerta suena.
5. Deployar a Vercel con las variables ya configuradas ahí.
