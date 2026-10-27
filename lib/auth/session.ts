import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "@/lib/db/app";

/**
 * Server-side sessions. The cookie carries `<sessionId>.<hmac>`; the id alone
 * grants nothing, so a forged cookie cannot name another user the way a bare
 * username cookie could.
 */

export const SESSION_COOKIE = "quotr_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cachedSecret: Buffer | null = null;

function sessionSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = Buffer.from(fromEnv, "utf8");
    return cachedSecret;
  }
  // Local development convenience: generate once and keep it out of git.
  const file = path.join(process.cwd(), "data", ".session-secret");
  mkdirSync(path.dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
  cachedSecret = Buffer.from(readFileSync(file, "utf8").trim(), "utf8");
  return cachedSecret;
}

function sign(sessionId: string): string {
  return createHmac("sha256", sessionSecret()).update(sessionId).digest("base64url");
}

export function issueSessionToken(): string {
  return randomBytes(16).toString("base64url");
}

export function serializeCookie(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

/** Returns the session id when the signature is valid, otherwise null. */
export function readCookieToken(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const presented = raw.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

export function createSession(db: Db, userId: string): string {
  const id = issueSessionToken();
  const now = Date.now();
  db.prepare("insert into sessions (id, user_id, created_at, expires_at) values (?, ?, ?, ?)").run(
    id,
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
  );
  return id;
}

export function findSessionUser(db: Db, sessionId: string): { id: string; username: string; displayName: string } | null {
  const row = db
    .prepare(
      `select s.expires_at as expiresAt, u.id as id, u.username as username, u.display_name as displayName
         from sessions s join users u on u.id = s.user_id
        where s.id = ?`,
    )
    .get(sessionId) as { expiresAt: string; id: string; username: string; displayName: string } | undefined;
  if (!row) return null;
  if (Date.parse(row.expiresAt) <= Date.now()) {
    db.prepare("delete from sessions where id = ?").run(sessionId);
    return null;
  }
  return { id: row.id, username: row.username, displayName: row.displayName };
}

export function destroySession(db: Db, sessionId: string): void {
  db.prepare("delete from sessions where id = ?").run(sessionId);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function cookieAttributes() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: process.env.COOKIE_SECURE === "true",
  };
}
