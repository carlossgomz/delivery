-- CreateTable
-- Tabla aparte solo para guardar una imagen representativa por nombre de
-- categoría (los círculos del catálogo). Product.categoria sigue siendo
-- texto libre; esta tabla no tiene relación (FK) con Product a propósito,
-- para no tener que migrar datos existentes.
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "imagenUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");
