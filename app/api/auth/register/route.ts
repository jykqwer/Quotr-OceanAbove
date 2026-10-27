import { NextResponse } from "next/server";
import { REGISTER_LIMIT, hit } from "@/lib/auth/rate-limit";
import { cookieAttributes, createSession, serializeCookie, SESSION_COOKIE } from "@/lib/auth/session";
import { getDb } from "@/lib/db/app";
import { createUser } from "@/lib/store";

/** Same rule the form shows: 8–16 letters or digits, nothing else. */
const ACCOUNT_NAME = /^[A-Za-z0-9]{8,16}$/;

/**
 * A display name is whatever the person calls themselves — any script, spaces,
 * middle dots, one character or forty. It is required, but never judged by
 * character class.
 */
const DISPLAY_NAME_MAX = 48;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string; displayName?: string }
    | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  const displayName = body?.displayName?.trim() ?? "";

  if (!ACCOUNT_NAME.test(username)) {
    return NextResponse.json({ error: "bad_username" }, { status: 400 });
  }
  if (!ACCOUNT_NAME.test(password)) {
    return NextResponse.json({ error: "bad_password" }, { status: 400 });
  }
  if (displayName.length === 0 || displayName.length > DISPLAY_NAME_MAX) {
    return NextResponse.json({ error: "bad_display_name" }, { status: 400 });
  }

  const limit = hit(`register:${username.toLowerCase()}`, REGISTER_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const db = getDb();
  const user = createUser(db, { username, password, displayName });
  if (!user) return NextResponse.json({ error: "username_taken" }, { status: 409 });

  const sessionId = createSession(db, user.id);
  const response = NextResponse.json({ user: { username: user.username, displayName: user.displayName } });
  response.cookies.set({ name: SESSION_COOKIE, value: serializeCookie(sessionId), ...cookieAttributes() });
  return response;
}
