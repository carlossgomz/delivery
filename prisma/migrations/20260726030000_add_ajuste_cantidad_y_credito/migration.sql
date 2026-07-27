-- AlterTable
-- Guarda la cantidad ORIGINALMENTE pedida cuando la tienda ajusta la
-- cantidad/peso real disponible de un OrderItem (ej. pidieron 3 y solo hay
-- 1, o pidieron 200g y al pesar salieron 220g). Queda en null mientras no
-- se haya ajustado nada.
ALTER TABLE "OrderItem" ADD COLUMN "cantidadOriginal" DOUBLE PRECISION;

-- AlterTable
-- Sistema de crédito autorizado por la tienda.
ALTER TABLE "Cliente" ADD COLUMN "creditoAutorizado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "esCredito" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "creditoPagado" BOOLEAN NOT NULL DEFAULT false;
