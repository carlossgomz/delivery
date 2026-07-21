# Delivery app (MVP)

App propia de pedidos por delivery para una tienda que también vende en físico.
No se sincroniza automáticamente con el sistema de facturación local (eso ya
quedó descartado por ser manejo manual en Excel) — en su lugar:

- El catálogo, los precios en USD y la tasa de cambio se cargan aquí, en el
  panel `/admin`.
- Cuando cambia el dólar, solo se actualiza **un número** (la tasa) y todos
  los precios se recalculan solos.
- Cada pedido pasa por una verificación manual de stock antes de pedir el
  pago, para no vender algo que no está físicamente disponible.

## Flujo

1. Cliente arma el pedido en `/` y llena sus datos en `/checkout`.
2. El pedido aparece en `/admin/pedidos` con estado "Por verificar stock".
3. El personal marca qué productos hay físicamente y confirma.
4. El sistema calcula el total (solo con lo disponible) y el cliente ve el
   monto a pagar y sube su comprobante.
5. El personal revisa el comprobante en `/admin/pedidos` y aprueba o
   rechaza el pago.
6. El pedido pasa a preparación y luego a entregado.

## Poner en marcha

```bash
npm install
cp .env.example .env
# Edita .env: define ADMIN_PASSWORD y, si quieres, otra ruta de DATABASE_URL

npm run db:push     # crea las tablas (SQLite local, dev.db)
npm run db:seed     # carga productos de ejemplo y una tasa inicial

npm run dev
```

Abre `http://localhost:3000` para el catálogo y
`http://localhost:3000/login` para entrar al panel de tienda con la
contraseña definida en `ADMIN_PASSWORD`.

## Qué falta para producción

- **Notificación instantánea a la tienda**: ahora mismo `/admin/pedidos` se
  actualiza solo, revisando cada 6 segundos (polling). Para algo más
  inmediato se puede sumar un WebSocket o una integración con WhatsApp
  Business API.
- **Pasarela/registro de pago**: hoy es "sube una foto del comprobante y el
  personal lo revisa a ojo". Si el volumen crece, vale la pena automatizar
  la verificación (por ejemplo, contra notificaciones del banco).
- **Fotos de producto**: el campo `imagenUrl` existe en el modelo pero el
  formulario de alta de productos todavía no sube imágenes.
- **Multiusuario en el panel**: hoy hay una sola contraseña compartida para
  toda la tienda. Si hay varios empleados conviene pasar a login individual.
- **Base de datos en producción**: SQLite es perfecto para arrancar; si el
  proyecto crece, cambiar `DATABASE_URL` a Postgres (Neon, Supabase, etc.)
  es un cambio de una línea en `prisma/schema.prisma` (`provider = "postgresql"`).
