import { NextResponse } from "next/server";
import { CLIENTE_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLIENTE_COOKIE_NAME, "", { maxAge: 0 });
  return res;
}
