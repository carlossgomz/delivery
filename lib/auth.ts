import { cookies } from "next/headers";
import crypto from "crypto";
import {
  DURACION_SESION_SEGUNDOS,
  leerSesion,
  secretoDeSesion,
  type StaffRole
} from "./sesion-personal";

const COOKIE_NAME = "admin_session";

// --- Roles de personal ---
// "admin"    -> dueños de la empresa: configuración (tasa, teléfono) y productos.
// "delivery" -> empleado autorizado que atiende los deliverys: pedidos,
//               mensajes, clientes y llamadas. Puede además abrir/cerrar
//               la recepción de pedidos ("atendiendo en tienda").
// Cada rol entra con una clave distinta (ver /api/login), pero ambos
// comparten la misma cookie de sesión, firmada (ver lib/sesion-personal.ts).
export type { StaffRole };

function firmarSesion(carga: string, secreto: string): string {
  return crypto.createHmac("sha256", secreto).update(carga).digest("hex");
}

// La firma recibida ya debe tener 64 caracteres, igual que la calculada.
function firmaCorrecta(carga: string, firma: string, secreto: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(firmarSesion(carga, secreto)),
    Buffer.from(firma)
  );
}

// Devuelve null si falta SESSION_SECRET: sin él no se puede iniciar sesión.
export function crearSesionPersonal(rol: StaffRole): string | null {
  const secreto = secretoDeSesion();
  if (!secreto) return null;
  const vence = Math.floor(Date.now() / 1000) + DURACION_SESION_SEGUNDOS;
  const carga = `${rol}.${vence}`;
  return `${carga}.${firmarSesion(carga, secreto)}`;
}

export function getStaffRole(): StaffRole | null {
  const sesion = leerSesion(cookies().get(COOKIE_NAME)?.value);
  const secreto = secretoDeSesion();
  if (!sesion || !secreto) return null;

  return firmaCorrecta(sesion.carga, sesion.firma, secreto) ? sesion.rol : null;
}

// Cualquier miembro del personal autenticado (dueño o empleado de delivery).
// Se mantiene este nombre porque ya lo usan las rutas compartidas entre
// ambos roles (pedidos, mensajes, clientes, llamadas).
export function isAdminAuthed(): boolean {
  return getStaffRole() !== null;
}

// Solo el dueño de la empresa (rol "admin"): configuración de tasa/teléfono
// y gestión de productos/categorías.
export function isDuenoAuthed(): boolean {
  return getStaffRole() === "admin";
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

// --- Sesión de cliente (registro sencillo) ---
// La cookie es "idCliente.vence.firma". Lo firmado lleva el prefijo "cliente:"
// para que una firma del personal nunca sirva aquí, ni al revés.
const CLIENTE_COOKIE_NAME = "cliente_session";
export { CLIENTE_COOKIE_NAME };

export const DURACION_SESION_CLIENTE_SEGUNDOS = 60 * 60 * 24 * 180;

// Devuelve null si falta SESSION_SECRET: sin él no se puede iniciar sesión.
export function crearSesionCliente(clienteId: string): string | null {
  const secreto = secretoDeSesion();
  if (!secreto) return null;
  const vence = Math.floor(Date.now() / 1000) + DURACION_SESION_CLIENTE_SEGUNDOS;
  const carga = `${clienteId}.${vence}`;
  return `${carga}.${firmarSesion(`cliente:${carga}`, secreto)}`;
}

export function getClienteIdFromSession(): string | null {
  const partes = cookies().get(CLIENTE_COOKIE_NAME)?.value.split(".");
  const secreto = secretoDeSesion();
  if (partes?.length !== 3 || !secreto) return null;

  const [clienteId, vence, firma] = partes;
  if (!clienteId || !/^\d+$/.test(vence) || Number(vence) <= Date.now() / 1000) return null;
  if (!/^[0-9a-f]{64}$/.test(firma)) return null;

  return firmaCorrecta(`cliente:${clienteId}.${vence}`, firma, secreto) ? clienteId : null;
}

// Hash de contraseña con scrypt (nativo de Node, sin dependencias nuevas).
// Se guarda como "salt:hash" en un solo campo de texto.
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const testHash = crypto.scryptSync(password, salt, 64);
  if (hashBuffer.length !== testHash.length) return false;
  return crypto.timingSafeEqual(hashBuffer, testHash);
}

// --- Sincronización con el POS de la tienda ---
// Quien llama a /api/pos/* no es un navegador logueado (es el proceso Rust
// del POS, corriendo en la tienda) — no tiene cookie de sesión, así que se
// autentica con un token fijo compartido en el header Authorization, igual
// que cualquier integración servidor-a-servidor.
export function isPosSyncAuthed(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const esperado = process.env.POS_SYNC_TOKEN;
  if (!esperado || !token) return false;
  const tokenBuffer = Buffer.from(token);
  const esperadoBuffer = Buffer.from(esperado);
  if (tokenBuffer.length !== esperadoBuffer.length) return false;
  return crypto.timingSafeEqual(tokenBuffer, esperadoBuffer);
}
