# Tanda 4 de cambios: punto 4 (categorías + orden)

Esta tanda SÍ requiere aplicar una migración a la base de datos. Es
aditiva (agrega una columna nueva con default 0) — no borra ni modifica
datos existentes.

## Pasos para aplicar

1. Copiá estos archivos sobre el mismo path en tu repo:
   - `prisma/schema.prisma`
   - `prisma/migrations/20260727000000_add_orden_a_product/migration.sql`
     (creá la carpeta si no existe)
   - `app/api/products/route.ts`
   - `app/api/products/[id]/route.ts`
   - `app/api/categorias/renombrar/route.ts` (archivo nuevo — creá también
     las carpetas `app/api/categorias/renombrar/`)
   - `app/admin/productos/page.tsx`

2. Aplicá la migración contra tu base de Supabase:
   ```
   npx prisma migrate deploy
   ```
   (o `npx prisma migrate dev` si querés hacerlo desde tu entorno local de
   desarrollo; con `deploy` no te pide confirmación ni genera archivos
   nuevos, solo aplica los que ya existen — ideal para no tocar nada más).

3. Regenerá el cliente de Prisma (por si el paso anterior no lo hizo solo):
   ```
   npx prisma generate
   ```

4. `npm run build` para confirmar que compila.

## Qué cambia

- **Nueva sección "Categorías"** arriba de la tabla de productos: lista
  cada categoría existente con un campo de texto — cambiás el nombre y
  tocás "Guardar", y se renombra en TODOS los productos que la tenían
  asignada, de una sola vez (antes había que editar producto por
  producto).

- **Columna "Categoría"** en la tabla de productos: cada fila tiene su
  propio campo (con autocompletado de categorías existentes) para mover
  ESE producto en particular a otra categoría, sin afectar al resto.
  Se guarda con el mismo botón "Guardar" de siempre.

- **Tabla agrupada por categoría**, con un encabezado por grupo mostrando
  el nombre y la cantidad de productos.

- **Flechas ▲▼** junto al nombre de cada producto para moverlo arriba/abajo
  dentro de su categoría. Están deshabilitadas mientras hay una búsqueda
  activa (para no desordenar productos que en ese momento están ocultos
  por el filtro) — el mensaje arriba de la tabla te avisa cuando pasa eso.

- El catálogo del cliente (`app/page.tsx`, ya en un zip anterior) y el
  admin ahora muestran los productos en ese mismo orden manual dentro de
  cada categoría.

## Para probar

1. En "Categorías", renombrar una y confirmar que TODOS sus productos
   quedan con el nombre nuevo (tanto en el admin como en el catálogo del
   cliente).
2. Mover un producto a otra categoría usando el campo "Categoría" de su
   fila, y confirmar que aparece en el grupo correcto.
3. Usar las flechas ▲▼ para reordenar productos dentro de una categoría, y
   confirmar que el catálogo del cliente respeta ese orden.

## Pendiente

- Punto 6b: rediseño visual más grande del catálogo (el único que queda).
