import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySession, readCookieToken } from "@/lib/auth/session";
import { getDb } from "@/lib/db/app";

export async function POST() {
  const jar = await cookies();
  const sessionId = readCookieToken(jar.get(SESSION_COOKIE)?.value);
  if (sessionId) destroySession(getDb(), sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}
