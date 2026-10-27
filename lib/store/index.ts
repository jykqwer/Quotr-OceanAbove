import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { newId } from "@/lib/auth/session";
import type { Db } from "@/lib/db/app";
import type { Itinerary } from "@/lib/domain/itinerary";
import {
  decodeCursor,
  encodeCursor,
  foldText,
  searchTextOf,
} from "@/lib/store/search";
import { canonicalJson, hashSnapshot, snapshotOf, type QuoteSnapshot } from "@/lib/store/snapshot";
import type { Conversation, Journey, Leg, Message, Quote, Ticket, ToolTrace } from "@/lib/types";

/**
 * Persistence only. Every number here was produced by lib/domain and is stored
 * verbatim; this module never computes a distance, a route or a price.
 */

export const QUOTE_TTL_MS = 15 * 60 * 1000;
export const NONCE_TTL_MS = 2 * 60 * 1000;
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

export interface UserRow {
  id: string;
  username: string;
  displayName: string;
}

function nowIso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/* ---------------------------------------------------------------- users --- */

export function findUserById(db: Db, id: string): UserRow | null {
  const row = db
    .prepare("select id, username, display_name as displayName from users where id = ?")
    .get(id) as UserRow | undefined;
  return row ?? null;
}

export function findUserByUsername(db: Db, username: string): UserRow | null {
  const row = db
    .prepare("select id, username, display_name as displayName from users where username_key = ?")
    .get(username.trim().toLowerCase()) as UserRow | undefined;
  return row ?? null;
}

/** Returns null when the username is taken. */
export function createUser(
  db: Db,
  input: { username: string; password: string; displayName?: string },
): UserRow | null {
  const username = input.username.trim();
  if (findUserByUsername(db, username)) return null;
  const user: UserRow = {
    id: newId("u"),
    username,
    displayName: input.displayName?.trim() || username,
  };
  db.prepare(
    `insert into users (id, username_key, username, display_name, password_hash, created_at)
     values (?, ?, ?, ?, ?, ?)`,
  ).run(user.id, username.toLowerCase(), user.username, user.displayName, hashPassword(input.password), nowIso());
  audit(db, { userId: user.id, action: "user.register" });
  return user;
}

export function verifyCredentials(db: Db, username: string, password: string): UserRow | null {
  const row = db
    .prepare(
      "select id, username, display_name as displayName, password_hash as passwordHash from users where username_key = ?",
    )
    .get(username.trim().toLowerCase()) as (UserRow & { passwordHash: string }) | undefined;
  if (!row) return null;
  if (!verifyPassword(password, row.passwordHash)) return null;
  return { id: row.id, username: row.username, displayName: row.displayName };
}

/* -------------------------------------------------------- conversations --- */

interface ConversationRow {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  preview: string | null;
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview ?? "",
    messageCount: row.messageCount,
    updatedAt: row.updatedAt,
  };
}

const CONVERSATION_SELECT = `
  select c.id as id,
         c.title as title,
         c.updated_at as updatedAt,
         (select count(*) from messages m where m.conversation_id = c.id) as messageCount,
         (select m.content from messages m where m.conversation_id = c.id order by m.created_at desc, m.rowid desc limit 1) as preview
    from conversations c`;

export interface ConversationPage {
  conversations: Conversation[];
  nextCursor: string | null;
  total: number;
}

export interface ConversationQuery {
  search?: string;
  cursor?: string | null;
  limit?: number;
}

/**
 * Newest first, paged by `(updated_at, id)`. A search term matches the folded
 * title or any message body, so "bogota" finds "Bogotá → Osaka".
 */
export function searchConversations(db: Db, userId: string, query: ConversationQuery = {}): ConversationPage {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const term = foldText(query.search ?? "");
  const cursor = decodeCursor(query.cursor);

  const filters = ["c.user_id = ?"];
  const params: unknown[] = [userId];
  if (term) {
    filters.push("c.search_text like ? escape '\\'");
    params.push(`%${escapeLike(term)}%`);
  }
  if (cursor) {
    filters.push("(c.updated_at < ? or (c.updated_at = ? and c.id < ?))");
    params.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
  }
  const where = filters.join(" and ");

  const rows = db
    .prepare(`${CONVERSATION_SELECT} where ${where} order by c.updated_at desc, c.id desc limit ?`)
    .all(...params, limit + 1) as ConversationRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  const total =
    term === ""
      ? (db.prepare("select count(*) as n from conversations where user_id = ?").get(userId) as { n: number }).n
      : (
          db
            .prepare(
              "select count(*) as n from conversations where user_id = ? and search_text like ? escape '\\'",
            )
            .get(userId, `%${escapeLike(term)}%`) as { n: number }
        ).n;

  return {
    conversations: page.map(toConversation),
    nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : null,
    total,
  };
}

/** Keeps `%` and `_` in a search term literal instead of acting as wildcards. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function listConversations(db: Db, userId: string, limit?: number): Conversation[] {
  return searchConversations(db, userId, { limit: limit ?? MAX_PAGE_SIZE }).conversations;
}

export function getConversation(db: Db, userId: string, conversationId: string): Conversation | null {
  const row = db
    .prepare(`${CONVERSATION_SELECT} where c.user_id = ? and c.id = ?`)
    .get(userId, conversationId) as ConversationRow | undefined;
  return row ? toConversation(row) : null;
}

export function createConversation(db: Db, userId: string, title: string): Conversation {
  const id = newId("c");
  const now = nowIso();
  const trimmed = title.slice(0, 60) || "New conversation";
  db.prepare(
    "insert into conversations (id, user_id, title, search_text, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
  ).run(id, userId, trimmed, searchTextOf(trimmed, []), now, now);
  return { id, title: trimmed, preview: "", messageCount: 0, updatedAt: now };
}

/* ------------------------------------------------------------- messages --- */

interface MessageRow {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  quoteId: string | null;
  toolsJson: string | null;
}

function toMessage(db: Db, row: MessageRow): Message {
  const message: Message = {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  };
  if (row.toolsJson) {
    try {
      message.tools = JSON.parse(row.toolsJson) as ToolTrace[];
    } catch {
      message.tools = [];
    }
  }
  if (row.quoteId) {
    const quote = getQuote(db, row.quoteId);
    if (quote) message.quote = quote;
  }
  return message;
}

export function listMessages(db: Db, userId: string, conversationId: string): Message[] | null {
  const owns = db.prepare("select 1 as ok from conversations where id = ? and user_id = ?").get(conversationId, userId);
  if (!owns) return null;
  const rows = db
    .prepare(
      `select id, conversation_id as conversationId, role, content, created_at as createdAt,
              quote_id as quoteId, tools_json as toolsJson
         from messages where conversation_id = ?
        order by created_at, rowid`,
    )
    .all(conversationId) as MessageRow[];
  return rows.map((row) => toMessage(db, row));
}

export function appendMessage(
  db: Db,
  conversationId: string,
  input: { role: "user" | "assistant"; content: string; quoteId?: string; tools?: ToolTrace[] },
): Message {
  const id = newId("m");
  const now = nowIso();
  db.prepare(
    `insert into messages (id, conversation_id, role, content, quote_id, tools_json, created_at)
     values (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    conversationId,
    input.role,
    input.content,
    input.quoteId ?? null,
    input.tools ? JSON.stringify(input.tools) : null,
    now,
  );
  db.prepare(
    "update conversations set updated_at = ?, search_text = substr(search_text || ' ' || ?, 1, 20000) where id = ?",
  ).run(now, foldText(input.content), conversationId);
  const message: Message = { id, conversationId, role: input.role, content: input.content, createdAt: now };
  if (input.tools) message.tools = input.tools;
  return message;
}

/* --------------------------------------------------------------- quotes --- */

interface QuoteRow {
  id: string;
  conversationId: string;
  snapshotJson: string;
  snapshotHash: string;
  status: "pending" | "booked" | "expired";
  createdAt: string;
  expiresAt: string;
}

function toQuote(row: QuoteRow): Quote {
  const snapshot = JSON.parse(row.snapshotJson) as QuoteSnapshot;
  return {
    id: row.id,
    conversationId: row.conversationId,
    origin: snapshot.origin,
    destination: snapshot.destination,
    journeys: snapshot.journeys ?? [],
    passengers: snapshot.passengers ?? [],
    totalDistanceKm: snapshot.totalDistanceKm,
    departAt: snapshot.departAt ?? "",
    priceUsd: snapshot.priceUsd,
    totalPriceUsd: snapshot.totalPriceUsd ?? snapshot.priceUsd,
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    snapshotHash: row.snapshotHash,
  };
}

export function getQuote(db: Db, quoteId: string): Quote | null {
  const row = db
    .prepare(
      `select id, conversation_id as conversationId, snapshot_json as snapshotJson, snapshot_hash as snapshotHash,
              status, created_at as createdAt, expires_at as expiresAt
         from quotes where id = ?`,
    )
    .get(quoteId) as QuoteRow | undefined;
  if (!row) return null;
  if (row.status === "pending" && Date.parse(row.expiresAt) <= Date.now()) {
    db.prepare("update quotes set status = 'expired' where id = ? and status = 'pending'").run(quoteId);
    return toQuote({ ...row, status: "expired" });
  }
  return toQuote(row);
}

export function getQuoteHash(db: Db, quoteId: string): string | null {
  const row = db.prepare("select snapshot_hash as hash from quotes where id = ?").get(quoteId) as
    | { hash: string }
    | undefined;
  return row?.hash ?? null;
}

export function createQuote(
  db: Db,
  input: { userId: string; conversationId: string; itinerary: Itinerary },
): Quote {
  const { itinerary } = input;
  const snapshot = snapshotOf({
    // The trip as a whole: first departure to last arrival.
    origin: itinerary.journeys[0].origin,
    destination: itinerary.journeys[itinerary.journeys.length - 1].destination,
    journeys: itinerary.journeys,
    passengers: itinerary.passengers,
    totalDistanceKm: itinerary.totalDistanceKm,
    departAt: itinerary.departAt,
    priceUsd: itinerary.priceUsd,
    totalPriceUsd: itinerary.totalPriceUsd,
  });
  const id = newId("q");
  const hash = hashSnapshot(snapshot);
  const now = Date.now();
  db.prepare(
    `insert into quotes (id, user_id, conversation_id, snapshot_json, snapshot_hash, status, created_at, expires_at)
     values (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(
    id,
    input.userId,
    input.conversationId,
    canonicalJson(snapshot),
    hash,
    new Date(now).toISOString(),
    new Date(now + QUOTE_TTL_MS).toISOString(),
  );
  audit(db, { userId: input.userId, action: "quote.create", quoteId: id, snapshotHash: hash });
  return getQuote(db, id)!;
}

/* ------------------------------------------- confirmation nonce chain --- */

export type ConsentFailure = "not_found" | "not_pending" | "expired" | "snapshot_mismatch";

export type ConsentResult = { ok: true; nonce: string; expiresAt: string } | { ok: false; reason: ConsentFailure };

/**
 * Mints a single-use nonce for a quote the user has actually seen. The client
 * echoes the snapshot hash it rendered, so a quote that changed after rendering
 * cannot be confirmed.
 */
export function consentToQuote(
  db: Db,
  input: { userId: string; quoteId: string; snapshotHash: string },
): ConsentResult {
  const row = db
    .prepare(
      `select id, status, expires_at as expiresAt, snapshot_hash as snapshotHash
         from quotes where id = ? and user_id = ?`,
    )
    .get(input.quoteId, input.userId) as
    | { id: string; status: "pending" | "booked" | "expired"; expiresAt: string; snapshotHash: string }
    | undefined;

  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "expired") return { ok: false, reason: "expired" };
  if (row.status !== "pending") return { ok: false, reason: "not_pending" };
  if (Date.parse(row.expiresAt) <= Date.now()) {
    db.prepare("update quotes set status = 'expired' where id = ? and status = 'pending'").run(row.id);
    return { ok: false, reason: "expired" };
  }
  if (row.snapshotHash !== input.snapshotHash) return { ok: false, reason: "snapshot_mismatch" };

  const nonce = randomBytes(24).toString("base64url");
  const now = Date.now();
  const expiresAt = new Date(now + NONCE_TTL_MS).toISOString();
  db.prepare(
    `insert into confirmations (nonce, quote_id, user_id, snapshot_hash, created_at, expires_at)
     values (?, ?, ?, ?, ?, ?)`,
  ).run(nonce, row.id, input.userId, row.snapshotHash, new Date(now).toISOString(), expiresAt);
  audit(db, { userId: input.userId, action: "quote.consent", quoteId: row.id, snapshotHash: row.snapshotHash });
  return { ok: true, nonce, expiresAt };
}

export type ConfirmFailure =
  | "not_found"
  | "expired"
  | "bad_nonce"
  | "nonce_used"
  | "nonce_expired"
  | "snapshot_changed"
  | "not_pending";

export type ConfirmResult = { ok: true; quote: Quote; ticket: Ticket } | { ok: false; reason: ConfirmFailure };

/**
 * Issues a ticket. Requires an unused, unexpired nonce minted by
 * consentToQuote for this exact user, quote and snapshot. There is no other path
 * to a ticket, so a conversational "yes" cannot book anything.
 */
export function confirmQuote(db: Db, input: { userId: string; quoteId: string; nonce: string }): ConfirmResult {
  return db.transaction((): ConfirmResult => {
    const row = db
      .prepare(
        `select id, conversation_id as conversationId, snapshot_json as snapshotJson, snapshot_hash as snapshotHash,
                status, created_at as createdAt, expires_at as expiresAt
           from quotes where id = ? and user_id = ?`,
      )
      .get(input.quoteId, input.userId) as QuoteRow | undefined;
    if (!row) return { ok: false, reason: "not_found" };
    if (Date.parse(row.expiresAt) <= Date.now()) {
      db.prepare("update quotes set status = 'expired' where id = ? and status = 'pending'").run(row.id);
      return { ok: false, reason: "expired" };
    }

    const nonce = db
      .prepare(
        `select nonce, snapshot_hash as snapshotHash, expires_at as expiresAt, used_at as usedAt
           from confirmations where nonce = ? and quote_id = ? and user_id = ?`,
      )
      .get(input.nonce, row.id, input.userId) as
      | { nonce: string; snapshotHash: string; expiresAt: string; usedAt: string | null }
      | undefined;
    // Validate the nonce before looking at the quote state: a replayed request
    // must be reported as a replay, never silently answered with the old ticket.
    if (!nonce) return { ok: false, reason: "bad_nonce" };
    if (nonce.usedAt) return { ok: false, reason: "nonce_used" };
    if (Date.parse(nonce.expiresAt) <= Date.now()) return { ok: false, reason: "nonce_expired" };
    if (nonce.snapshotHash !== row.snapshotHash) return { ok: false, reason: "snapshot_changed" };
    if (row.status !== "pending") return { ok: false, reason: "not_pending" };

    const snapshot = JSON.parse(row.snapshotJson) as QuoteSnapshot;
    const user = findUserById(db, input.userId);
    const passengers = snapshot.passengers?.length
      ? snapshot.passengers
      : [user?.displayName ?? user?.username ?? "passenger"];
    const journeys: Journey[] = snapshot.journeys ?? [];
    const ticket: Ticket = {
      id: `OA-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      quoteId: row.id,
      origin: snapshot.origin,
      destination: snapshot.destination,
      journeys,
      passengers,
      totalDistanceKm: snapshot.totalDistanceKm,
      departAt: snapshot.departAt ?? "",
      priceUsd: snapshot.priceUsd,
      totalPriceUsd: snapshot.totalPriceUsd ?? snapshot.priceUsd,
      bookedAt: nowIso(),
    };

    db.prepare(
      `insert into tickets (id, user_id, quote_id, origin, destination, total_km, price_usd, total_price_usd,
                            passengers_json, passenger, depart_at, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      ticket.id,
      input.userId,
      ticket.quoteId,
      ticket.origin,
      ticket.destination,
      ticket.totalDistanceKm,
      ticket.priceUsd,
      ticket.totalPriceUsd,
      JSON.stringify(passengers),
      passengers.join(", "),
      ticket.departAt,
      ticket.bookedAt,
    );
    const insertLeg = db.prepare(
      "insert into ticket_legs (ticket_id, seq, journey_seq, from_city, to_city, distance_km) values (?, ?, ?, ?, ?, ?)",
    );
    let seq = 0;
    journeys.forEach((journey, journeyIndex) => {
      for (const leg of journey.legs) {
        seq += 1;
        insertLeg.run(ticket.id, seq, journeyIndex + 1, leg.from, leg.to, leg.distanceKm);
      }
    });

    db.prepare("update quotes set status = 'booked', confirmed_at = ? where id = ?").run(ticket.bookedAt, row.id);
    db.prepare("update confirmations set used_at = ? where nonce = ?").run(ticket.bookedAt, nonce.nonce);
    db.prepare("update conversations set updated_at = ? where id = ?").run(ticket.bookedAt, row.conversationId);

    audit(db, {
      userId: input.userId,
      action: "ticket.issue",
      quoteId: row.id,
      snapshotHash: row.snapshotHash,
      detail: ticket.id,
    });

    return { ok: true, quote: getQuote(db, row.id)!, ticket };
  })();
}

/* -------------------------------------------------------------- tickets --- */

interface TicketRow {
  id: string;
  quoteId: string;
  origin: string;
  destination: string;
  totalKm: number;
  priceUsd: number;
  totalPriceUsd: number;
  passengersJson: string;
  passenger: string;
  departAt: string;
  createdAt: string;
}

/** Journeys are reconstructed from the leg rows, which carry `journey_seq`. */
function toTicket(db: Db, row: TicketRow): Ticket {
  const legs = db
    .prepare(
      `select seq, journey_seq as journeySeq, from_city as fromCity, to_city as toCity, distance_km as distanceKm
         from ticket_legs where ticket_id = ? order by seq`,
    )
    .all(row.id) as { seq: number; journeySeq: number; fromCity: string; toCity: string; distanceKm: number }[];

  const byJourney = new Map<number, Leg[]>();
  for (const leg of legs) {
    const list = byJourney.get(leg.journeySeq) ?? [];
    list.push({ seq: leg.seq, from: leg.fromCity, to: leg.toCity, distanceKm: leg.distanceKm });
    byJourney.set(leg.journeySeq, list);
  }

  const journeys: Journey[] = [...byJourney.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, journeyLegs]) => ({
      origin: journeyLegs[0].from,
      destination: journeyLegs[journeyLegs.length - 1].to,
      legs: journeyLegs,
      transfers: journeyLegs.slice(0, -1).map((leg) => leg.to),
      totalDistanceKm: Math.round(journeyLegs.reduce((sum, leg) => sum + leg.distanceKm, 0) * 100) / 100,
    }));

  let passengers: string[] = [];
  try {
    passengers = JSON.parse(row.passengersJson) as string[];
  } catch {
    passengers = [];
  }
  if (passengers.length === 0) passengers = [row.passenger];

  return {
    id: row.id,
    quoteId: row.quoteId,
    origin: row.origin,
    destination: row.destination,
    journeys,
    passengers,
    totalDistanceKm: row.totalKm,
    departAt: row.departAt,
    priceUsd: row.priceUsd,
    totalPriceUsd: row.totalPriceUsd || Math.round(row.priceUsd * passengers.length * 100) / 100,
    bookedAt: row.createdAt,
  };
}

const TICKET_SELECT = `
  select id, quote_id as quoteId, origin, destination, total_km as totalKm, price_usd as priceUsd,
         total_price_usd as totalPriceUsd, passengers_json as passengersJson, passenger,
         depart_at as departAt, created_at as createdAt
    from tickets`;

export function findTicketByQuote(db: Db, quoteId: string): Ticket | null {
  const row = db.prepare(`${TICKET_SELECT} where quote_id = ?`).get(quoteId) as TicketRow | undefined;
  return row ? toTicket(db, row) : null;
}

export function listTickets(db: Db, userId: string): Ticket[] {
  const rows = db
    .prepare(`${TICKET_SELECT} where user_id = ? order by created_at desc`)
    .all(userId) as TicketRow[];
  return rows.map((row) => toTicket(db, row));
}

export function getTicket(db: Db, userId: string, ticketId: string): Ticket | null {
  const row = db
    .prepare(`${TICKET_SELECT} where user_id = ? and id = ?`)
    .get(userId, ticketId) as TicketRow | undefined;
  return row ? toTicket(db, row) : null;
}

/* ---------------------------------------------------------------- audit --- */

export function audit(
  db: Db,
  entry: { userId?: string; action: string; quoteId?: string; snapshotHash?: string; detail?: string },
): void {
  db.prepare(
    "insert into audit_log (user_id, action, quote_id, snapshot_hash, detail, created_at) values (?, ?, ?, ?, ?, ?)",
  ).run(
    entry.userId ?? null,
    entry.action,
    entry.quoteId ?? null,
    entry.snapshotHash ?? null,
    entry.detail ?? null,
    nowIso(),
  );
}

export function listAudit(db: Db, limit = 20) {
  return db
    .prepare(
      "select id, user_id as userId, action, quote_id as quoteId, snapshot_hash as snapshotHash, detail, created_at as createdAt from audit_log order by id desc limit ?",
    )
    .all(limit);
}
