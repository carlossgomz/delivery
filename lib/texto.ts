// Normaliza texto para comparaciones de búsqueda "tolerantes": pasa a
// minúsculas y quita acentos/diacríticos, para que buscar "maiz" encuentre
// "Maíz" (y viceversa). Se usa en los buscadores del admin (productos, etc).
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
