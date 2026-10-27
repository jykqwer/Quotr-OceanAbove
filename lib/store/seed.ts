import { findRoute } from "@/lib/domain/route";
import { resolveCity } from "@/lib/domain/resolve";
import type { DomainGraph } from "@/lib/domain/graph";
import {
  appendMessage,
  consentToQuote,
  confirmQuote,
  createConversation,
  createQuote,
  createUser,
  findUserByUsername,
  getQuoteHash,
  listTickets,
} from "@/lib/store";
import type { Db } from "@/lib/db/app";
import { formatKm, formatUsd } from "@/lib/format";

const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "oceanabove";

/**
 * Seeds a demo account the first time the database is created, so the app is
 * explorable without registering. All numbers come from the domain engine.
 */
export function seedIfEmpty(db: Db, graph: DomainGraph): void {
  const anyUser = db.prepare("select 1 as ok from users limit 1").get();
  if (anyUser) return;

  const user = createUser(db, { username: DEMO_USERNAME, password: DEMO_PASSWORD, displayName: "Ada" });
  if (!user) return;

  // 1. A pending quote, mid-conversation.
  const londonRoute = findRoute(graph, "Shanghai", "London");
  if (londonRoute) {
    const conversation = createConversation(db, user.id, "Shanghai → London");
    appendMessage(db, conversation.id, {
      role: "user",
      content: "Cheapest flight from Shanghai to London please.",
    });
    const quote = createQuote(db, { userId: user.id, conversationId: conversation.id, route: londonRoute });
    appendMessage(db, conversation.id, {
      role: "assistant",
      content:
        `Cheapest route from ${londonRoute.origin} to ${londonRoute.destination}: ${londonRoute.legs.length} legs, ` +
        `transfer at ${londonRoute.transfers.join(", ")}. Total distance ${formatKm(londonRoute.totalDistanceKm)}, ` +
        `price ${formatUsd(londonRoute.priceUsd)}. Review the itinerary below and confirm to book.`,
      quoteId: quote.id,
      tools: [
        { name: "resolve_city", ok: true, ms: 1 },
        { name: "find_route", ok: true, ms: 2 },
        { name: "verify_route", ok: true, ms: 0 },
        { name: "create_booking_quote", ok: true, ms: 1 },
      ],
    });
  }

  // 2. A booked ticket, so "my tickets" is not empty on first run.
  const tokyoRoute = findRoute(graph, "Toronto", "Tokyo");
  if (tokyoRoute) {
    const conversation = createConversation(db, user.id, "Toronto → Tokyo");
    appendMessage(db, conversation.id, { role: "user", content: "Toronto to Tokyo, cheapest option." });
    const quote = createQuote(db, { userId: user.id, conversationId: conversation.id, route: tokyoRoute });
    appendMessage(db, conversation.id, {
      role: "assistant",
      content:
        `Cheapest route from ${tokyoRoute.origin} to ${tokyoRoute.destination}: ${tokyoRoute.legs.length} legs, ` +
        `transfer at ${tokyoRoute.transfers.join(", ")}. Total distance ${formatKm(tokyoRoute.totalDistanceKm)}, ` +
        `price ${formatUsd(tokyoRoute.priceUsd)}.`,
      quoteId: quote.id,
    });

    // The seed books through the real nonce chain, so the demo data cannot
    // bypass the confirmation rule either.
    const hash = getQuoteHash(db, quote.id);
    if (hash) {
      const consent = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
      if (consent.ok) confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: consent.nonce });
    }
  }

  const limaRoute = findRoute(graph, "Guangzhou", "Lima");
  if (limaRoute) {
    const conversation = createConversation(db, user.id, "Guangzhou → Lima");
    appendMessage(db, conversation.id, { role: "user", content: "How much is Guangzhou to Lima?" });
    const quote = createQuote(db, { userId: user.id, conversationId: conversation.id, route: limaRoute });
    appendMessage(db, conversation.id, {
      role: "assistant",
      content:
        `${limaRoute.legs.length} legs via ${limaRoute.transfers.join(", ")}. ` +
        `${formatKm(limaRoute.totalDistanceKm)}, ${formatUsd(limaRoute.priceUsd)}.`,
      quoteId: quote.id,
    });
    const hash = getQuoteHash(db, quote.id);
    if (hash) {
      const consent = consentToQuote(db, { userId: user.id, quoteId: quote.id, snapshotHash: hash });
      if (consent.ok) confirmQuote(db, { userId: user.id, quoteId: quote.id, nonce: consent.nonce });
    }
  }

  // 3. A no-service question, to show requirement 8 without guessing.
  const abuDhabi = createConversation(db, user.id, "Abu Dhabi");
  appendMessage(db, abuDhabi.id, { role: "user", content: "Do you fly to Abu Dhabi?" });
  const noService = resolveCity(graph, "Abu Dhabi");
  if (noService.status === "no_service") {
    appendMessage(db, abuDhabi.id, {
      role: "assistant",
      content:
        `${noService.city} currently has no flight service. The nearest city we serve is ` +
        `${noService.nearest.city}, about ${formatKm(noService.nearest.distanceKm)} away. ` +
        `Shall I look up flights to or from ${noService.nearest.city} instead?`,
      tools: [{ name: "resolve_city", ok: true, ms: 1 }],
    });
  }

  if (listTickets(db, user.id).length === 0) {
    // Should not happen: the two quotes above are booked through the nonce chain.
    throw new Error("seed failed to issue tickets");
  }
}

export const DEMO = { username: DEMO_USERNAME, password: DEMO_PASSWORD };
