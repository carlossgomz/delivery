// Helpers compartidos para productos que se venden por peso (Product.porPeso).
// En esos productos, "cantidad" (en OrderItem/carrito) se guarda en
// KILOGRAMOS en vez de unidades, y precioUsd es el precio por kilo.

// Opciones rápidas que se muestran como botones en el catálogo y en el
// armado de pedidos por llamada. El cliente igual puede escribir un valor
// distinto a mano (ej. 0.75, 3.2, etc.).
export const PESOS_SUGERIDOS = [0.25, 0.5, 1, 1.5, 2, 3, 5];

// Peso inicial al agregar por primera vez un producto por peso al carrito.
export const PESO_INICIAL = 0.5;

// Formatea una cantidad para mostrarla al cliente o a la tienda:
// - Producto por unidad: "3" (se muestra como "×3" donde se use)
// - Producto por peso, menos de 1kg: "500 g"
// - Producto por peso, 1kg o más: "1.5 kg" (sin ceros de más)
export function formatCantidad(cantidad: number, porPeso?: boolean): string {
  if (!porPeso) {
    return `${cantidad}`;
  }
  if (cantidad < 1) {
    const gramos = Math.round(cantidad * 1000);
    return `${gramos} g`;
  }
  const kilos = Number(cantidad.toFixed(2)).toString();
  return `${kilos} kg`;
}

// Mismo formato pero pensado para ir junto al nombre del producto, ej.
// "500 g de Queso Mozzarella" o "×3 Coca-Cola 1.5L".
export function prefijoCantidad(cantidad: number, porPeso?: boolean): string {
  if (!porPeso) return `${cantidad}×`;
  return `${formatCantidad(cantidad, true)} de`;
}

// Formatea el peso real (en gramos) que la tienda confirmó al pesar un
// pedido hecho "por unidad" en un producto híbrido (ej. "3 tomates" ->
// "340 g"). Solo aplica a OrderItem.pesoConfirmadoGramos.
export function formatPesoConfirmado(gramos: number): string {
  if (gramos < 1000) return `${Math.round(gramos)} g`;
  const kilos = Number((gramos / 1000).toFixed(2)).toString();
  return `${kilos} kg`;
}
