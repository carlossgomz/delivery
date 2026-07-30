// Cálculo de precio compartido por todo el sitio (catálogo, checkout,
// llamada, pedidos) para que el precio en bolívares que ve el cliente
// SIEMPRE se calcule igual, sin importar la pantalla.
//
// Fórmula: (precioUsd + ganancia) x tasaCambio = total en Bs
//
// "ganancia" es un monto en dólares que el dueño configura en
// /admin (Configuración) y se le suma a cada producto antes de convertir a
// bolívares. Por defecto es 0.10.
export function precioConGananciaUsd(precioUsd: number, ganancia: number): number {
  return precioUsd + (ganancia || 0);
}

export function precioBs(precioUsd: number, ganancia: number, tasaCambio: number): number {
  return precioConGananciaUsd(precioUsd, ganancia) * (tasaCambio || 0);
}
