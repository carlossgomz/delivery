// Fuente única de verdad para el precio de venta de un producto.
// precio = costo + margen% sobre el costo + una comisión fija de $0.15
// Si el producto no tiene margen propio configurado, se asume 0%.
export function calcularPrecioFinalUsd(
    costoUsd: number,
    margenPorcentaje?: number | null
): number {
    const margen = margenPorcentaje ?? 0;
    return costoUsd * (1 + margen / 100) + 0.15;
}