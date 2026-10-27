import { cookies } from "next/headers";
import { getDb } from "@/lib/db/app";
import { SESSION_COOKIE, findSessionUser, readCookieToken } from "@/lib/auth/session";

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
}

/**
 * The only way a route learns who is calling. The cookie is verified against an
 * HMAC and looked up in the sessions table; a user id is never read from the
 * request body.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const sessionId = readCookieToken(jar.get(SESSION_COOKIE)?.value);
  if (!sessionId) return null;
  return findSessionUser(getDb(), sessionId);
}

export async function requireUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}
