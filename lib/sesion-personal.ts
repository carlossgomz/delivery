// Formato de la cookie de sesión del personal: "rol.vence.firma".
// - vence: segundos desde 1970; el servidor lo comprueba además del maxAge.
// - firma: HMAC-SHA256 en hexadecimal de "rol.vence" con SESSION_SECRET.
// Sin dependencias de Node porque también lo importa middleware.ts, que corre
// en Edge. La firma se calcula en lib/auth.ts (Node) y en middleware.ts (Web
// Crypto): el resultado de ambos debe ser idéntico.
export type StaffRole = "admin" | "delivery";

export const DURACION_SESION_SEGUNDOS = 60 * 60 * 12;

const LARGO_MINIMO_SECRETO = 32;

// Sin un secreto válido no se crea ni se acepta ninguna sesión.
export function secretoDeSesion(): string | null {
  const secreto = process.env.SESSION_SECRET;
  return secreto && secreto.length >= LARGO_MINIMO_SECRETO ? secreto : null;
}

export function leerSesion(
  valor: string | undefined
): { rol: StaffRole; carga: string; firma: string } | null {
  const partes = valor?.split(".");
  if (partes?.length !== 3) return null;

  const [rol, vence, firma] = partes;
  if (rol !== "admin" && rol !== "delivery") return null;
  if (!/^\d+$/.test(vence) || Number(vence) <= Date.now() / 1000) return null;
  if (!/^[0-9a-f]{64}$/.test(firma)) return null;

  return { rol, carga: `${rol}.${vence}`, firma };
}
