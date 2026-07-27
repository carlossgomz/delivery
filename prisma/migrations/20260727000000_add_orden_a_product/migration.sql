-- AlterTable
-- Orden manual del producto dentro de su categoría (menor = aparece
-- primero). Aditivo: todos los productos existentes quedan en 0 y no
-- cambia el orden actual hasta que se reordene desde el admin.
ALTER TABLE "Product" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;
