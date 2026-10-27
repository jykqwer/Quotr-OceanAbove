import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "@/lib/db/app";
import { getGraph } from "@/lib/domain";
import { findRoute } from "@/lib/domain/route";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  appendMessage,
  confirmQuote,
  consentToQuote,
  createConversation,
  createQuote,
  createUser,
  findUserByUsername,
  getQuoteHash,
  listTickets,
  verifyCredentials,
} from "@/lib/store";

function freshDb() {
  return openDatabase(":memory:");
}

/** Creates a user plus a pending quote, ready to consent. */
function setup(db = freshDb()) {
  const user = createUser(db, { username: "tester", password: "supersecret", displayName: "Tester" });
  assert.ok(user, "user created");
  const conversation = createConversation(db, user.id, "Test");
  const route = findRoute(getGraph(), "Chengdu", "Split");
  assert.ok(route, "route found");
  const quote = createQuote(db, { userId: user.id, conversationId: conversation.id, route });
  const hash = getQuoteHash(db, quote.id);
  assert.ok(hash, "quote hash stored");
  return { db, user, conversation, quote, hash };
}

test("passwords are salted, hashed, and verify only on the exact value", () => {
  const first = hashPassword("hunter2");
  const second = hashPassword("hunter2");
  assert.notEqual(first, second, "same password hashes differently per salt");
  assert.match(first, /^scrypt\$/);
  assert.equal(verifyPassword("hunter2", first), true);
  assert.equal(verifyPassword("hunter3", first), false);
});

test("credentials are checked against the stored hash", () => {
  const db = freshDb();
  createUser(db, { username: "Ada", password: "oceanabove", displayName: "Ada" });
  assert.equal(verifyCredentials(db, "ada", "oceanabove")?.username, "Ada");
  assert.equal(verifyCredentials(db, "ada", "wrong"), null);
  assert.equal(verifyCredentials(db, "nobody", "oceanabove"), null);
});

test("a ticket cannot be issued without a nonce", () => {
  const { db, user, quote } = setup();
  const result = confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: "" });
  assert.deepEqual(result, { ok: false, reason: "bad_nonce" });
  assert.equal(listTickets(db, user.id).length, 0, "no ticket was created");
});

test("a fabricated nonce is refused", () => {
  const { db, user, quote } = setup();
  const result = confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: "made-up" });
  assert.equal(result.ok, false);
  assert.equal(listTickets(db, user.id).length, 0);
});

test("consent requires the snapshot hash the client rendered", () => {
  const { db, user, quote } = setup();
  const wrong = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: "deadbeef" });
  assert.deepEqual(wrong, { ok: false, reason: "snapshot_mismatch" });
  assert.equal(listTickets(db, user.id).length, 0);
});

test("consent + confirm issues exactly one ticket and is not reusable", () => {
  const { db, user, quote, hash } = setup();
  const consent = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
  assert.ok(consent.ok, "consent granted");

  const confirmed = confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: consent.nonce });
  assert.ok(confirmed.ok, "ticket issued");
  assert.equal(confirmed.ticket.priceUsd, quote.priceUsd);
  assert.equal(confirmed.quote.status, "booked");

  const replay = confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: consent.nonce });
  assert.deepEqual(replay, { ok: false, reason: "nonce_used" });
  assert.equal(listTickets(db, user.id).length, 1, "replay did not issue a second ticket");
});

test("another user cannot consent to or confirm someone else's quote", () => {
  const { db, quote, hash } = setup();
  const intruder = createUser(db, { username: "mallory", password: "supersecret", displayName: "M" });
  assert.ok(intruder);

  const consent = consentToQuote(db, { userId: intruder.id, quoteId: quote.id, snapshotHash: hash });
  assert.deepEqual(consent, { ok: false, reason: "not_found" });

  const confirmed = confirmQuote(db, { userId: intruder.id, quoteId: quote.id, nonce: "anything" });
  assert.deepEqual(confirmed, { ok: false, reason: "not_found" });
  assert.equal(listTickets(db, intruder.id).length, 0);
});

test("an expired quote cannot be consented to", () => {
  const { db, user, quote, hash } = setup();
  db.prepare("update quotes set expires_at = ? where id = ?").run(
    new Date(Date.now() - 1000).toISOString(),
    quote.id,
  );
  const consent = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
  assert.deepEqual(consent, { ok: false, reason: "expired" });
});

test("an expired nonce cannot be exchanged", () => {
  const { db, user, quote, hash } = setup();
  const consent = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
  assert.ok(consent.ok);
  db.prepare("update confirmations set expires_at = ? where nonce = ?").run(
    new Date(Date.now() - 1000).toISOString(),
    consent.nonce,
  );
  const confirmed = confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: consent.nonce });
  assert.deepEqual(confirmed, { ok: false, reason: "nonce_expired" });
  assert.equal(listTickets(db, user.id).length, 0);
});

test("a booked quote refuses a second consent", () => {
  const { db, user, quote, hash } = setup();
  const consent = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
  assert.ok(consent.ok);
  confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: consent.nonce });

  const again = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
  assert.deepEqual(again, { ok: false, reason: "not_pending" });
});

test("usernames are unique case-insensitively", () => {
  const db = freshDb();
  createUser(db, { username: "Ada", password: "oceanabove", displayName: "Ada" });

  assert.equal(createUser(db, { username: "ada", password: "otherpass", displayName: "Fake" }), null);
  assert.equal(findUserByUsername(db, "ada")?.username, "Ada", "original row is untouched");
});

test("messages belong to a conversation and keep their order", () => {
  const db = freshDb();
  const user = createUser(db, { username: "ada", password: "oceanabove", displayName: "Ada" });
  assert.ok(user);
  const conversation = createConversation(db, user.id, "Hello");
  appendMessage(db, conversation.id, { role: "user", content: "first" });
  appendMessage(db, conversation.id, { role: "assistant", content: "second" });

  const rows = db
    .prepare("select role, content from messages where conversation_id = ? order by rowid")
    .all(conversation.id) as { role: string; content: string }[];
  assert.deepEqual(
    rows.map((row) => `${row.role}:${row.content}`),
    ["user:first", "assistant:second"],
  );
});
