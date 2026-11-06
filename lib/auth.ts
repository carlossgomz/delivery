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

  const esperada = Buffer.from(firmarSesion(sesion.carga, secreto));
  const recibida = Buffer.from(sesion.firma);
  return crypto.timingSafeEqual(esperada, recibida) ? sesion.rol : null;
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
// La cookie guarda directamente el id del cliente. Alcanza para el tamaño de esta tienda; si más
// adelante se necesita más seguridad, se puede cambiar por un token opaco
// guardado en su propia tabla de sesiones.
const CLIENTE_COOKIE_NAME = "cliente_session";
export { CLIENTE_COOKIE_NAME };

export function getClienteIdFromSession(): string | null {
  return cookies().get(CLIENTE_COOKIE_NAME)?.value ?? null;
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
