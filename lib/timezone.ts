// Venezuela usa un solo huso horario fijo (UTC-4, sin horario de verano),
// así que "America/Caracas" es seguro para usar todo el año. Las fechas
// se siguen guardando en la base de datos como siempre (instante UTC,
// que es lo correcto); este helper solo se encarga de que, a la hora de
// MOSTRARLAS o de agruparlas por día, se interpreten como hora de
// Venezuela sin importar en qué zona horaria esté el navegador o el
// servidor que renderiza la página.
export const ZONA_HORARIA = "America/Caracas";

// "YYYY-MM-DD" de una fecha, en hora de Venezuela. Formato "en-CA" da
// justo ese orden, que es el mismo que usa <input type="date">, así que
// se puede comparar directo con lo que el usuario selecciona en el filtro.
export function fechaVenezolana(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
}

// "dd/mm/aaaa, hh:mm" en hora de Venezuela, para mostrar junto a cada
// pedido.
export function formatFechaHoraVzla(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleString("es-VE", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatFechaVzla(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-VE", { timeZone: ZONA_HORARIA });
}

// "YYYY-MM" de una fecha, en hora de Venezuela. Se usa para agrupar
// pedidos por mes en las estadísticas (reporte mensual de ventas).
export function mesVenezolano(fecha: string | Date): string {
  return fechaVenezolana(fecha).slice(0, 7);
}

// "YYYY-MM" del mes actual, en hora de Venezuela.
export function mesActualVenezolano(): string {
  return mesVenezolano(new Date());
}
