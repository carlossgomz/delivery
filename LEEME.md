# Tanda 2 de cambios: puntos 5, 3 y 6 (imagen)

Copiá cada archivo sobre el mismo path en tu repo (pisando el existente).
No hace falta `npm install` para esta tanda (no se agregó ninguna
dependencia nueva) ni migración de base de datos (el campo `imagenUrl`
ya existía en el modelo `Product`).

## Archivos modificados

- `app/cliente/pedidos/page.tsx` — **Punto 5**: el total del pedido ahora
  se muestra solo en bolívares, sin el monto en dólares.

- `app/page.tsx` — **Punto 3**: el input de peso (productos que se venden
  por kilo) ya no agrega al carrito mientras escribís. Ahora muestra el
  precio estimado en Bs debajo del campo, y recién se agrega o actualiza el
  carrito al presionar el botón "Agregar"/"Actualizar".
  También agrega **punto 6 (imagen)**: cada producto del catálogo muestra
  una miniatura (o un ícono de placeholder 🛒 si todavía no tiene imagen
  cargada).

- `app/admin/productos/page.tsx` — **Punto 6 (imagen)**: nueva columna
  "Imagen" en la tabla de productos. Click sobre la miniatura para subir/
  cambiar la imagen del producto (se sube a Vercel Blob y se guarda en el
  producto automáticamente).

- `app/api/upload/route.ts` — se le agregó soporte para un campo opcional
  `carpeta` en el form-data (usa `productos/` para imágenes de producto,
  sigue usando `comprobantes/` por defecto para no romper el flujo de
  pagos existente).

- `app/api/products/[id]/route.ts` — el PATCH ahora acepta y guarda
  `imagenUrl`.

## Para probar

1. `npm run build` (o `npm run dev`) para confirmar que compila.
2. Admin → Productos: subir una imagen a un producto y confirmar que se ve
   la miniatura.
3. Catálogo del cliente: confirmar que aparece esa imagen, y que los
   productos sin imagen muestran el ícono de placeholder.
4. Catálogo del cliente: en un producto por peso, escribir un peso y
   confirmar que NO se agrega solo — recién al tocar "Agregar"/"Actualizar".
5. Cliente → Mis pedidos: confirmar que el total aparece solo en Bs.

## Pendientes (siguiente tanda)

- Punto 1: buscador que también traiga productos por nombre de categoría.
- Punto 2: opción para que el cliente confirme que recibió el pedido.
- Punto 4: editar categorías y ordenar productos dentro de una categoría
  (requiere agregar un campo nuevo a la base de datos — pendiente tu
  confirmación).
- Punto 6b: rediseño visual más grande del catálogo.
