# Tanda 3 de cambios: puntos 1 y 2

Copiá cada archivo sobre el mismo path en tu repo. No hace falta
`npm install` ni migración de base de datos para esta tanda — el punto 2
reutiliza el estado "ENTREGADO" que ya existía.

## Archivos modificados

- `app/page.tsx` — **Punto 1**: el buscador del catálogo ahora también
  matchea por nombre de categoría. Buscar "Refresco" trae los productos
  que se llaman así Y los que pertenecen a la categoría "Refrescos",
  aunque el nombre del producto no contenga esa palabra.

- `app/api/orders/[id]/route.ts` — **Punto 2**: nueva acción
  `confirmar_recibido` (no requiere sesión de admin). Solo funciona
  mientras el pedido está "En camino"; al confirmar, pasa a "Entregado" —
  el mismo estado final al que llega la tienda si lo marca manualmente
  desde el admin. Quedan las dos formas de confirmar, como pediste.

- `app/cliente/pedidos/page.tsx` y `app/checkout/page.tsx` — se agregó el
  botón "✓ Ya recibí mi pedido" en la pantalla de seguimiento (aparece
  solo cuando el pedido está "En camino"). `checkout/page.tsx` es la
  pantalla que ven los pedidos de invitados sin cuenta; `cliente/pedidos`
  es la de "Mis pedidos" para cuentas registradas — agregué el botón en
  ambas para cubrir los dos casos.

## Para probar

1. `npm run build` para confirmar que compila.
2. Buscador: escribir el nombre de una categoría (ej. "Refrescos") y
   confirmar que trae todos los productos de esa categoría, no solo los
   que tienen esa palabra en el nombre.
3. Llevar un pedido de prueba hasta "En camino" desde el admin, y
   confirmar que en la pantalla del cliente aparece el botón y que al
   tocarlo el pedido pasa a "Entregado" (y desaparece de "pedidos
   pendientes").
4. Confirmar que la tienda TODAVÍA puede marcarlo "Entregado" manualmente
   desde el admin sin depender del cliente.

## Pendientes

- Punto 4: editar categorías y ordenar productos (esperando tu
  confirmación sobre la migración de base de datos).
- Punto 6b: rediseño visual más grande del catálogo.
