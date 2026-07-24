import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "admin_session";

export function isAdminAuthed(): boolean {
  return cookies().get(COOKIE_NAME)?.value === "ok";
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
