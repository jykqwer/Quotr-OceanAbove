import { createHash, randomUUID } from "node:crypto";
import { ROUTES, legsToTransfers, type RouteFixture } from "@/lib/mock/fixtures";
import type { Conversation, Message, Quote, Ticket } from "@/lib/types";

/**
 * In-memory stand-in for app.db so the UI is fully interactive while the real
 * persistence + agent layer is being built. Replace with SQLite repositories in
 * the next phase; the API contract stays the same.
 */

interface MockUser {
  username: string;
  displayName: string;
  passwordHash: string;
}

interface Store {
  users: Map<string, MockUser>;
  conversations: Map<string, Conversation[]>;
  messages: Map<string, Message[]>;
  quotes: Map<string, Quote>;
  tickets: Map<string, Ticket[]>;
  owners: Map<string, string>;
}

const QUOTE_TTL_MS = 15 * 60 * 1000;

function hashPassword(password: string): string {
  // Placeholder only: the real implementation will use scrypt with a per-user salt.
  return createHash("sha256").update(password).digest("hex");
}

function nowIso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function quoteId(): string {
  return `qt_${randomUUID().slice(0, 8)}`;
}

function ticketId(): string {
  return `OA-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function buildQuote(
  conversationId: string,
  route: RouteFixture,
  status: Quote["status"] = "pending",
): Quote {
  return {
    id: quoteId(),
    conversationId,
    origin: route.origin,
    destination: route.destination,
    legs: route.legs,
    transfers: legsToTransfers(route.legs),
    totalDistanceKm: route.totalDistanceKm,
    priceUsd: route.priceUsd,
    status,
    createdAt: nowIso(),
    expiresAt: nowIso(QUOTE_TTL_MS),
  };
}

function seed(): Store {
  const store: Store = {
    users: new Map(),
    conversations: new Map(),
    messages: new Map(),
    quotes: new Map(),
    tickets: new Map(),
    owners: new Map(),
  };

  const username = "demo";
  store.users.set(username, {
    username,
    displayName: "Ada",
    passwordHash: hashPassword("oceanabove"),
  });

  const london = ROUTES[0];
  const lima = ROUTES[1];
  const tokyo = ROUTES[2];

  const londonConversation: Conversation = {
    id: "c_london",
    title: "Shanghai → London",
    preview: "Cheapest route found — waiting for your confirmation.",
    messageCount: 0,
    updatedAt: nowIso(-2 * 60 * 60 * 1000),
  };
  const tokyoConversation: Conversation = {
    id: "c_tokyo",
    title: "Toronto → Tokyo",
    preview: "Ticket OA-7F3C21 issued.",
    messageCount: 0,
    updatedAt: nowIso(-26 * 60 * 60 * 1000),
  };
  const abuDhabiConversation: Conversation = {
    id: "c_abudhabi",
    title: "Abu Dhabi",
    preview: "No service — nearest served city is Tirana.",
    messageCount: 0,
    updatedAt: nowIso(-3 * 24 * 60 * 60 * 1000),
  };

  store.conversations.set(username, [
    londonConversation,
    tokyoConversation,
    abuDhabiConversation,
  ]);
  for (const conversation of [londonConversation, tokyoConversation, abuDhabiConversation]) {
    store.owners.set(conversation.id, username);
  }

  const londonQuote = buildQuote(londonConversation.id, london);

  const tokyoQuote = buildQuote(tokyoConversation.id, tokyo, "booked");
  const tokyoTicket: Ticket = {
    id: ticketId(),
    quoteId: tokyoQuote.id,
    origin: tokyo.origin,
    destination: tokyo.destination,
    legs: tokyo.legs,
    totalDistanceKm: tokyo.totalDistanceKm,
    priceUsd: tokyo.priceUsd,
    bookedAt: nowIso(-26 * 60 * 60 * 1000),
    passenger: "Ada",
  };

  const limaTicket: Ticket = {
    id: ticketId(),
    quoteId: "qt_archive1",
    origin: lima.origin,
    destination: lima.destination,
    legs: lima.legs,
    totalDistanceKm: lima.totalDistanceKm,
    priceUsd: lima.priceUsd,
    bookedAt: nowIso(-9 * 24 * 60 * 60 * 1000),
    passenger: "Ada",
  };

  store.quotes.set(londonQuote.id, londonQuote);
  store.quotes.set(tokyoQuote.id, tokyoQuote);
  store.tickets.set(username, [limaTicket, tokyoTicket]);

  store.messages.set(londonConversation.id, [
    {
      id: randomUUID(),
      conversationId: londonConversation.id,
      role: "user",
      content: "Cheapest flight from Shanghai to London please.",
      createdAt: nowIso(-2 * 60 * 60 * 1000 - 90 * 1000),
    },
    {
      id: randomUUID(),
      conversationId: londonConversation.id,
      role: "assistant",
      content:
        `Cheapest route from Shanghai to London: 3 legs, transfer at Hong Kong, Lagos. ` +
        `Total distance ${london.totalDistanceKm.toFixed(2)} km, price $${london.priceUsd.toFixed(2)}. ` +
        `Review the itinerary below and confirm to book.`,
      createdAt: nowIso(-2 * 60 * 60 * 1000 - 60 * 1000),
      quote: londonQuote,
      tools: [
        { name: "resolve_city", ok: true, ms: 4 },
        { name: "find_route", ok: true, ms: 12 },
        { name: "create_booking_quote", ok: true, ms: 9 },
      ],
    },
  ]);

  store.messages.set(tokyoConversation.id, [
    {
      id: randomUUID(),
      conversationId: tokyoConversation.id,
      role: "user",
      content: "Toronto to Tokyo, cheapest option.",
      createdAt: nowIso(-26 * 60 * 60 * 1000 - 120 * 1000),
    },
    {
      id: randomUUID(),
      conversationId: tokyoConversation.id,
      role: "assistant",
      content:
        `Cheapest route from Toronto to Tokyo: 2 legs, transfer at Sydney. ` +
        `Total distance ${tokyo.totalDistanceKm.toFixed(2)} km, price $${tokyo.priceUsd.toFixed(2)}.`,
      createdAt: nowIso(-26 * 60 * 60 * 1000 - 100 * 1000),
      quote: tokyoQuote,
      tools: [
        { name: "resolve_city", ok: true, ms: 3 },
        { name: "find_route", ok: true, ms: 11 },
        { name: "create_booking_quote", ok: true, ms: 8 },
      ],
    },
    {
      id: randomUUID(),
      conversationId: tokyoConversation.id,
      role: "user",
      content: "Looks good, book it.",
      createdAt: nowIso(-26 * 60 * 60 * 1000 - 40 * 1000),
    },
    {
      id: randomUUID(),
      conversationId: tokyoConversation.id,
      role: "assistant",
      content: `Confirmed — ticket ${tokyoTicket.id} has been issued.`,
      createdAt: nowIso(-26 * 60 * 60 * 1000 - 20 * 1000),
      tools: [{ name: "confirm_booking", ok: true, ms: 21 }],
    },
  ]);

  store.messages.set(abuDhabiConversation.id, [
    {
      id: randomUUID(),
      conversationId: abuDhabiConversation.id,
      role: "user",
      content: "Do you fly to Abu Dhabi?",
      createdAt: nowIso(-3 * 24 * 60 * 60 * 1000 - 60 * 1000),
    },
    {
      id: randomUUID(),
      conversationId: abuDhabiConversation.id,
      role: "assistant",
      content:
        "Abu Dhabi currently has no flight service. The nearest city we serve is Tirana, about 350.90 km away. " +
        "Shall I look up flights to or from Tirana instead?",
      createdAt: nowIso(-3 * 24 * 60 * 60 * 1000 - 40 * 1000),
      tools: [{ name: "resolve_city", ok: true, ms: 5 }],
    },
  ]);

  for (const conversation of [londonConversation, tokyoConversation, abuDhabiConversation]) {
    conversation.messageCount = store.messages.get(conversation.id)?.length ?? 0;
  }

  return store;
}

const globalStore = globalThis as unknown as { __quotrMockStore?: Store };

export function getStore(): Store {
  if (!globalStore.__quotrMockStore) {
    globalStore.__quotrMockStore = seed();
  }
  return globalStore.__quotrMockStore;
}

export function findUser(username: string): MockUser | undefined {
  return getStore().users.get(username.toLowerCase());
}

export function registerUser(username: string, password: string): MockUser {
  const store = getStore();
  const key = username.toLowerCase();
  if (store.users.has(key)) throw new Error("username_taken");
  const user: MockUser = {
    username: key,
    displayName: username,
    passwordHash: hashPassword(password),
  };
  store.users.set(key, user);
  store.conversations.set(key, []);
  store.tickets.set(key, []);
  return user;
}

export function verifyCredentials(username: string, password: string): MockUser | null {
  const user = findUser(username);
  if (!user) return null;
  return user.passwordHash === hashPassword(password) ? user : null;
}

export function listConversations(username: string): Conversation[] {
  return [...(getStore().conversations.get(username) ?? [])].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export function createConversation(username: string, title: string): Conversation {
  const store = getStore();
  const conversation: Conversation = {
    id: `c_${randomUUID().slice(0, 8)}`,
    title,
    preview: "",
    messageCount: 0,
    updatedAt: nowIso(),
  };
  const list = store.conversations.get(username) ?? [];
  store.conversations.set(username, [conversation, ...list]);
  store.messages.set(conversation.id, []);
  store.owners.set(conversation.id, username);
  return conversation;
}

export function getConversation(username: string, conversationId: string): Conversation | null {
  return listConversations(username).find((item) => item.id === conversationId) ?? null;
}

export function listMessages(username: string, conversationId: string): Message[] | null {
  const store = getStore();
  if (store.owners.get(conversationId) !== username) return null;
  const list = store.messages.get(conversationId) ?? [];
  for (const message of list) {
    if (!message.quote) continue;
    const next = applyExpiry(message.quote);
    if (next !== message.quote) {
      message.quote = next;
      store.quotes.set(next.id, next);
    }
  }
  return list;
}

export function syncQuoteInMessages(conversationId: string, quote: Quote): void {
  const list = getStore().messages.get(conversationId) ?? [];
  for (const message of list) {
    if (message.quote?.id === quote.id) message.quote = quote;
  }
}

export function appendMessage(
  conversationId: string,
  message: Omit<Message, "id" | "createdAt">,
): Message {
  const store = getStore();
  const full: Message = { ...message, id: randomUUID(), createdAt: nowIso() };
  const list = store.messages.get(conversationId) ?? [];
  list.push(full);
  store.messages.set(conversationId, list);

  const owner = store.owners.get(conversationId);
  if (owner) {
    const conversation = store.conversations.get(owner)?.find((item) => item.id === conversationId);
    if (conversation) {
      conversation.messageCount = list.length;
      conversation.preview = full.content.slice(0, 90);
      conversation.updatedAt = full.createdAt;
      if (conversation.title === "New conversation" && full.role === "user") {
        conversation.title = full.content.slice(0, 48);
      }
    }
  }
  return full;
}

export function createQuoteForRoute(conversationId: string, route: RouteFixture): Quote {
  const quote = buildQuote(conversationId, route);
  getStore().quotes.set(quote.id, quote);
  return quote;
}

function applyExpiry(quote: Quote): Quote {
  if (quote.status === "pending" && Date.parse(quote.expiresAt) < Date.now()) {
    return { ...quote, status: "expired" };
  }
  return quote;
}

export function confirmQuote(
  username: string,
  conversationId: string,
  quoteIdValue: string,
): { quote: Quote; ticket: Ticket } | null {
  const store = getStore();
  if (store.owners.get(conversationId) !== username) return null;
  const quote = store.quotes.get(quoteIdValue);
  if (!quote || quote.conversationId !== conversationId) return null;
  if (quote.status === "booked") {
    const existing = (store.tickets.get(username) ?? []).find((item) => item.quoteId === quote.id);
    return existing ? { quote, ticket: existing } : null;
  }

  const current = applyExpiry(quote);
  if (current.status !== "pending") {
    store.quotes.set(quote.id, current);
    return null;
  }

  const ticket: Ticket = {
    id: ticketId(),
    quoteId: quote.id,
    origin: quote.origin,
    destination: quote.destination,
    legs: quote.legs,
    totalDistanceKm: quote.totalDistanceKm,
    priceUsd: quote.priceUsd,
    bookedAt: nowIso(),
    passenger: store.users.get(username)?.displayName ?? username,
  };

  const booked: Quote = { ...quote, status: "booked" };
  store.quotes.set(quote.id, booked);
  const tickets = store.tickets.get(username) ?? [];
  store.tickets.set(username, [ticket, ...tickets]);

  const conversation = store.conversations
    .get(username)
    ?.find((item) => item.id === conversationId);
  if (conversation) {
    conversation.preview = `${quote.origin} → ${quote.destination} · booked ${ticket.id}`;
    conversation.updatedAt = nowIso();
  }

  return { quote: booked, ticket };
}

export function listTickets(username: string): Ticket[] {
  return [...(getStore().tickets.get(username) ?? [])].sort(
    (a, b) => Date.parse(b.bookedAt) - Date.parse(a.bookedAt),
  );
}
