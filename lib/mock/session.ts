import { cookies } from "next/headers";

export const SESSION_COOKIE = "quotr_session";

export interface StoredSession {
  username: string;
}

export async function getSessionUsername(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export function sessionCookie(username: string) {
  return {
    name: SESSION_COOKIE,
    value: username,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    // Localhost-only preview: enable behind TLS in real deployments.
    secure: process.env.COOKIE_SECURE === "true",
  };
}
