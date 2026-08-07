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

// Redondea un precio en USD a 2 decimales (precisión estándar de moneda).
// La sincronización con el POS y la carga manual desde /admin pueden traer
// decimales de más (ej. 2.457142857142857, arrastrado de una división) —
// esto se aplica en todo punto donde se ESCRIBE Product.precioUsd para que
// nunca quede guardado así.
export function redondearPrecio(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function precioBs(precioUsd: number, ganancia: number, tasaCambio: number): number {
  return precioConGananciaUsd(precioUsd, ganancia) * (tasaCambio || 0);
}

// Total en Bs de UNA línea de pedido/carrito (precio x cantidad, con la
// ganancia ya incluida). Este es el cálculo que usa TODO el catálogo por
// defecto: la ganancia se suma por cada kg/unidad, así que pedir más
// siempre suma más ganancia total (3 leches = +$0.30, 4kg de arroz =
// +$0.40 de ganancia, etc.) — eso no cambia.
//
// La ÚNICA excepción es gananciaFijaPorLinea = true, pensado
// exclusivamente para una línea pedida "por unidad" de un producto
// híbrido que se vende por peso (ej. cliente pide "3 tomates"): ahí la
// ganancia se suma UNA sola vez por línea, sin importar cuántos kilos
// termine pesando, porque en ese caso ya es un monto por venta y no por
// kilo. El resto del catálogo (incluidos productos por peso pedidos en
// kg directamente) sigue sin usar este parámetro.
export function totalBsLinea(
  precioUsd: number,
  ganancia: number,
  tasaCambio: number,
  cantidad: number,
  gananciaFijaPorLinea = false
): number {
  const tasa = tasaCambio || 0;
  if (gananciaFijaPorLinea) {
    return precioUsd * cantidad * tasa + (ganancia || 0) * tasa;
  }
  return precioConGananciaUsd(precioUsd, ganancia) * tasa * cantidad;
}
