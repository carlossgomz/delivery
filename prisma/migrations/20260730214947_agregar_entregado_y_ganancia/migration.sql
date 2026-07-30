-- AlterTable
ALTER TABLE "Config" ADD COLUMN     "ganancia" DOUBLE PRECISION NOT NULL DEFAULT 0.10;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "entregadoAt" TIMESTAMP(3);
