-- AlterTable: Product — permitir vender por unidad además de por peso
ALTER TABLE "Product" ADD COLUMN "permiteUnidad" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "precioUnidadUsd" DOUBLE PRECISION;

-- AlterTable: OrderItem — registrar modo de venta y peso real confirmado
ALTER TABLE "OrderItem" ADD COLUMN "vendidoPorUnidad" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "pesoConfirmadoGramos" INTEGER;
