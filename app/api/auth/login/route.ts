import { NextResponse } from "next/server";
import { LOGIN_LIMIT, hit, reset } from "@/lib/auth/rate-limit";
import { cookieAttributes, createSession, serializeCookie, SESSION_COOKIE } from "@/lib/auth/session";
import { getDb } from "@/lib/db/app";
import { verifyCredentials } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  if (!username || !password) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const key = `login:${username.toLowerCase()}`;
  const limit = hit(key, LOGIN_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const db = getDb();
  const user = verifyCredentials(db, username, password);
  if (!user) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  reset(key);
  const sessionId = createSession(db, user.id);
  const response = NextResponse.json({ user: { username: user.username, displayName: user.displayName } });
  response.cookies.set({ name: SESSION_COOKIE, value: serializeCookie(sessionId), ...cookieAttributes() });
  return response;
}
