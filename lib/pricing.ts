// Delivery fee fijo que se suma a cada producto (no es una tarifa aparte en
// el pedido, va incluido en el precio final de cada línea).
const DELIVERY_FEE_USD = 0.15;

/**
 * Calcula el precio final que ve el cliente a partir del costo de compra.
 * costoUsd: lo que paga la tienda por el producto (nunca se muestra al cliente).
 * margenProducto: % de ganancia específico de este producto, si tiene uno.
 * margenGlobal: % de ganancia por defecto (Config.margenPorcentaje), usado
 *               cuando el producto no tiene margen propio.
 */
export function calcularPrecioFinal(
    costoUsd: number,
    margenProducto: number | null | undefined,
    margenGlobal: number
): number {
    if (!costoUsd || costoUsd <= 0) return 0;
    const margen = margenProducto ?? margenGlobal;
    const precio = costoUsd * (1 + margen / 100) + DELIVERY_FEE_USD;
    return Math.round(precio * 100) / 100;
}