// En Venezuela la gente suele escribir la cédula con el prefijo de
// nacionalidad (V-12345678, E-12345678) porque así aparece impresa en el
// documento, pero en el sistema se guarda y se busca solo por números.
// Esta función se usa tanto al escribir en los formularios (deja pasar
// solo dígitos mientras el usuario teclea) como al validar en el servidor.
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}
