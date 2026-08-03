-- Corrige el diseño de la migración anterior (20260802000000): el precio de
-- un producto híbrido SIEMPRE se cobra por peso (precioUsd, por kilo).
-- No existe un precio fijo por unidad — "por unidad" es solo una forma más
-- cómoda de pedir (ej. "3 tomates"), que da un precio ESTIMADO al cliente
-- basado en un peso promedio por unidad, y la tienda confirma el peso real
-- al chequear disponibilidad.

-- Product: reemplaza el precio fijo por unidad por un peso estimado por unidad
ALTER TABLE "Product" DROP COLUMN IF EXISTS "precioUnidadUsd";
ALTER TABLE "Product" ADD COLUMN "pesoEstimadoUnidadGramos" INTEGER;

-- OrderItem: reemplaza el "peso confirmado" (que duplicaba a "cantidad")
-- por "unidadesPedidas", que guarda cuántas unidades pidió el cliente
-- (ej. 3) de forma fija, independiente del peso que se termine confirmando
-- en "cantidad" (que ahora SÍ es directamente el peso real en kilos).
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "pesoConfirmadoGramos";
ALTER TABLE "OrderItem" ADD COLUMN "unidadesPedidas" INTEGER;
