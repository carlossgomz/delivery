import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";

export function isAdminAuthed(): boolean {
  return cookies().get(COOKIE_NAME)?.value === "ok";
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
