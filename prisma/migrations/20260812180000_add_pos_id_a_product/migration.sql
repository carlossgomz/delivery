-- Id del producto en la base del POS (productos.id, un UUID que nunca
-- cambia) — clave real de sincronización desde acá en adelante. El código
-- de barras ("codigo") puede cambiar en el POS (se le asigna el código real
-- después de crearse con uno provisional, o se corrige a mano), lo que
-- antes de este campo creaba un producto duplicado en vez de actualizar el
-- existente.
ALTER TABLE "Product" ADD COLUMN "posId" TEXT;
CREATE UNIQUE INDEX "Product_posId_key" ON "Product"("posId");
