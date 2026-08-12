-- Permite que un producto por unidad (porPeso = false) se pueda vender
-- también en MEDIA unidad (0.5), ej. "HUEVO CARTON 36UND" como cartón
-- completo o medio cartón — ambas opciones descuentan del mismo Product.
ALTER TABLE "Product" ADD COLUMN "permiteMedia" BOOLEAN NOT NULL DEFAULT false;
