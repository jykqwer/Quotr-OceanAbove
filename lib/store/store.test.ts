import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "@/lib/db/app";
import { buildItinerary, getGraph } from "@/lib/domain";
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
  searchConversations,
  verifyCredentials,
} from "@/lib/store";

function freshDb() {
  return openDatabase(":memory:");
}

/** Creates a user plus a pending quote, ready to consent. */
function setup(db = freshDb(), options: { passengers?: string[] } = {}) {
  const user = createUser(db, { username: "tester", password: "supersecret", displayName: "Tester" });
  assert.ok(user, "user created");
  const conversation = createConversation(db, user.id, "Test");
  const itinerary = buildItinerary(getGraph(), {
    journeys: [{ origin: "Chengdu", destination: "Split" }],
    passengers: options.passengers ?? ["Tester"],
  });
  const quote = createQuote(db, { userId: user.id, conversationId: conversation.id, itinerary });
  const hash = getQuoteHash(db, quote.id);
  assert.ok(hash, "quote hash stored");
  return { db, user, conversation, quote, hash, itinerary };
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

test("search matches folded titles and message bodies, but stays scoped to the user", () => {
  const db = freshDb();
  const ada = createUser(db, { username: "ada", password: "oceanabove", displayName: "Ada" });
  const grace = createUser(db, { username: "grace", password: "oceanabove", displayName: "Grace" });
  assert.ok(ada && grace);

  const bogota = createConversation(db, ada.id, "Bogotá → Osaka");
  appendMessage(db, bogota.id, { role: "user", content: "cheapest from Bogotá to Osaka" });
  const other = createConversation(db, ada.id, "Toronto → Tokyo");
  appendMessage(db, other.id, { role: "user", content: "one seat please" });
  createConversation(db, grace.id, "Bogotá → Osaka");

  // Diacritics and case are folded away, and the term matches a message body.
  const byTitle = searchConversations(db, ada.id, { search: "bogota" });
  assert.equal(byTitle.total, 1);
  assert.equal(byTitle.conversations[0].id, bogota.id);

  const byBody = searchConversations(db, ada.id, { search: "one seat" });
  assert.deepEqual(
    byBody.conversations.map((conversation) => conversation.id),
    [other.id],
  );

  assert.equal(searchConversations(db, ada.id, { search: "zzz" }).total, 0);
  assert.equal(searchConversations(db, ada.id, {}).total, 2);
});

test("a wildcard in the search term is literal", () => {
  const db = freshDb();
  const user = createUser(db, { username: "ada", password: "oceanabove", displayName: "Ada" });
  assert.ok(user);
  createConversation(db, user.id, "Tokyo");
  createConversation(db, user.id, "50% off");

  assert.equal(searchConversations(db, user.id, { search: "%" }).total, 1);
  assert.equal(searchConversations(db, user.id, { search: "_" }).total, 0);
});

test("conversation pages walk every row once, newest first", () => {
  const db = freshDb();
  const user = createUser(db, { username: "ada", password: "oceanabove", displayName: "Ada" });
  assert.ok(user);

  const ids: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    const conversation = createConversation(db, user.id, `Thread ${index}`);
    appendMessage(db, conversation.id, { role: "user", content: `message ${index}` });
    ids.push(conversation.id);
  }

  const walk = () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: ReturnType<typeof searchConversations> = searchConversations(db, user.id, {
        limit: 2,
        cursor,
      });
      seen.push(...page.conversations.map((conversation) => conversation.id));
      cursor = page.nextCursor;
      pages += 1;
      assert.ok(pages < 10, "pagination terminates");
    } while (cursor);
    return { seen, pages };
  };

  const first = walk();
  assert.equal(first.seen.length, 5, "every conversation appears exactly once");
  assert.equal(new Set(first.seen).size, 5);
  assert.equal(first.pages, 3);

  // The cursor must be stable: the same query twice returns the same order.
  assert.deepEqual(walk().seen, first.seen);
  assert.deepEqual(new Set(first.seen), new Set(ids));
});

test("multiple passengers multiply the fare exactly once", () => {
  const { db, user, quote, hash } = setup(freshDb(), { passengers: ["Ada", "Grace Hopper"] });

  assert.equal(quote.passengers.length, 2);
  assert.equal(quote.totalPriceUsd, Math.round(quote.priceUsd * 2 * 100) / 100);
  assert.equal(quote.priceUsd, 510.35);

  const consent = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
  assert.ok(consent.ok);
  const confirmed = confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: consent.nonce });
  assert.ok(confirmed.ok);

  assert.deepEqual(confirmed.ticket.passengers, ["Ada", "Grace Hopper"]);
  assert.equal(confirmed.ticket.totalPriceUsd, 1020.7);
  assert.equal(confirmed.ticket.priceUsd, 510.35);

  const stored = listTickets(db, user.id)[0];
  assert.deepEqual(stored.passengers, ["Ada", "Grace Hopper"]);
  assert.equal(stored.totalPriceUsd, 1020.7);
});

test("a multi-city ticket keeps both journeys and one total", () => {
  const db = freshDb();
  const user = createUser(db, { username: "ada", password: "oceanabove", displayName: "Ada" });
  assert.ok(user);
  const conversation = createConversation(db, user.id, "Round trip");

  const itinerary = buildItinerary(getGraph(), {
    journeys: [
      { origin: "Bogotá", destination: "Osaka" },
      { origin: "Osaka", destination: "Bogotá" },
    ],
    passengers: ["Ada"],
  });
  const quote = createQuote(db, { userId: user.id, conversationId: conversation.id, itinerary });
  const hash = getQuoteHash(db, quote.id)!;

  const consent = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
  assert.ok(consent.ok);
  const confirmed = confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: consent.nonce });
  assert.ok(confirmed.ok);

  const ticket = confirmed.ticket;
  assert.equal(ticket.journeys.length, 2);
  assert.equal(ticket.journeys[0].origin, "Bogotá");
  assert.equal(ticket.journeys[1].destination, "Bogotá");
  assert.equal(
    Math.round(ticket.journeys.reduce((sum, journey) => sum + journey.totalDistanceKm, 0) * 100) / 100,
    ticket.totalDistanceKm,
  );
  // Every leg is stored with the journey it belongs to, and keeps order.
  const legs = db
    .prepare("select journey_seq as journeySeq, seq from ticket_legs where ticket_id = ? order by seq")
    .all(ticket.id) as { journeySeq: number; seq: number }[];
  assert.equal(legs.length, ticket.journeys.reduce((sum, journey) => sum + journey.legs.length, 0));
  assert.equal(legs[0].journeySeq, 1);
  assert.equal(legs[legs.length - 1].journeySeq, 2);
});
