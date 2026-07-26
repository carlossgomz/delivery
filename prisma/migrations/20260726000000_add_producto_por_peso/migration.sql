-- AlterTable
ALTER TABLE "Product" ADD COLUMN "porPeso" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- La cantidad de OrderItem pasa de entero a decimal para poder guardar
-- pesos en kilogramos (ej. 0.5, 1.25) en los productos que se venden por
-- peso. Los pedidos ya existentes (cantidades enteras) se convierten sin
-- pérdida de datos.
ALTER TABLE "OrderItem" ALTER COLUMN "cantidad" TYPE DOUBLE PRECISION;
