import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "admin_session";

// --- Roles de personal ---
// "admin"    -> dueños de la empresa: configuración (tasa, teléfono) y productos.
// "delivery" -> empleado autorizado que atiende los deliverys: pedidos,
//               mensajes, clientes y llamadas. Puede además abrir/cerrar
//               la recepción de pedidos ("atendiendo en tienda").
// Cada rol entra con una clave distinta (ver /api/login), pero ambos
// comparten la misma cookie de sesión: lo único que cambia es su valor.
export type StaffRole = "admin" | "delivery";

export function getStaffRole(): StaffRole | null {
  const value = cookies().get(COOKIE_NAME)?.value;
  return value === "admin" || value === "delivery" ? value : null;
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
// La cookie guarda directamente el id del cliente (igual de "sencillo" que
// el admin_session actual). Alcanza para el tamaño de esta tienda; si más
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
