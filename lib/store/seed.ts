import { buildItinerary, type JourneyRequest } from "@/lib/domain/itinerary";
import type { DomainGraph } from "@/lib/domain/graph";
import { resolveCity } from "@/lib/domain/resolve";
import {
  appendMessage,
  consentToQuote,
  confirmQuote,
  createConversation,
  createQuote,
  createUser,
  getQuoteHash,
  listTickets,
} from "@/lib/store";
import type { Db } from "@/lib/db/app";
import { formatKm, formatUsd } from "@/lib/format";
import type { Itinerary } from "@/lib/domain/itinerary";
import type { Quote } from "@/lib/types";

const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "oceanabove";

/**
 * Seeds a demo account the first time the database is created, so the app is
 * explorable without registering. All numbers come from the domain engine, and
 * the seeded tickets are issued through the real nonce chain.
 */
export function seedIfEmpty(db: Db, graph: DomainGraph): void {
  const anyUser = db.prepare("select 1 as ok from users limit 1").get();
  if (anyUser) return;

  const user = createUser(db, { username: DEMO_USERNAME, password: DEMO_PASSWORD, displayName: "Ada" });
  if (!user) return;
  const me = user.displayName;

  const quote = (
    title: string,
    journeys: JourneyRequest[],
    passengers: string[],
  ): { quote: Quote; itinerary: Itinerary } | null => {
    let itinerary: Itinerary;
    try {
      itinerary = buildItinerary(graph, { journeys, passengers });
    } catch {
      return null;
    }
    const conversation = createConversation(db, user.id, title);
    appendMessage(db, conversation.id, {
      role: "user",
      content: describeRequest(title),
    });
    const created = createQuote(db, { userId: user.id, conversationId: conversation.id, itinerary });
    appendMessage(db, conversation.id, {
      role: "assistant",
      content: summarize(itinerary),
      quoteId: created.id,
      tools: [
        { name: "resolve_city", ok: true, ms: 1 },
        { name: "find_route", ok: true, ms: 2 },
        { name: "create_booking_quote", ok: true, ms: 1 },
      ],
    });
    return { quote: created, itinerary };
  };

  const book = (created: { quote: Quote } | null) => {
    if (!created) return;
    const hash = getQuoteHash(db, created.quote.id);
    if (!hash) return;
    const consent = consentToQuote(db, { userId: user.id, quoteId: created.quote.id, snapshotHash: hash });
    if (consent.ok) confirmQuote(db, { userId: user.id, quoteId: created.quote.id, nonce: consent.nonce });
  };

  // 1. A pending single-trip quote.
  quote("Shanghai → London", [{ origin: "Shanghai", destination: "London" }], [me]);

  // 2. Two booked single-trip tickets.
  book(quote("Toronto → Tokyo", [{ origin: "Toronto", destination: "Tokyo" }], [me]));
  book(quote("Guangzhou → Lima", [{ origin: "Guangzhou", destination: "Lima" }], [me]));

  // 3. A booked ticket for two passengers, to show that fares multiply per head.
  book(
    quote("Osaka → Nairobi · 2 passengers", [{ origin: "Osaka", destination: "Nairobi" }], [me, "Grace Hopper"]),
  );

  // 4. A pending multi-city quote (two journeys in one itinerary).
  quote(
    "Bogotá → Osaka · round trip",
    [
      { origin: "Bogotá", destination: "Osaka" },
      { origin: "Osaka", destination: "Bogotá" },
    ],
    [me],
  );

  // 5. A no-service question, so requirement 8 is visible without guessing.
  const noService = resolveCity(graph, "Abu Dhabi");
  if (noService.status === "no_service") {
    const conversation = createConversation(db, user.id, "Abu Dhabi");
    appendMessage(db, conversation.id, { role: "user", content: "Do you fly to Abu Dhabi?" });
    appendMessage(db, conversation.id, {
      role: "assistant",
      content:
        `${noService.city} currently has no flight service. The nearest city we serve is ` +
        `${noService.nearest.city}, about ${formatKm(noService.nearest.distanceKm)} away. ` +
        `Shall I look up flights to or from ${noService.nearest.city} instead?`,
      tools: [{ name: "resolve_city", ok: true, ms: 1 }],
    });
  }

  if (listTickets(db, user.id).length === 0) {
    // Should not happen: the quotes above are booked through the nonce chain.
    throw new Error("seed failed to issue tickets");
  }
}

function describeRequest(title: string): string {
  return title.includes("round trip")
    ? "Bogotá to Osaka and back, cheapest both ways."
    : `${title.split(" ·")[0]}, cheapest option please.`;
}

function summarize(itinerary: Itinerary): string {
  const legs = itinerary.journeys.reduce((sum, journey) => sum + journey.legs.length, 0);
  const heads = itinerary.passengers.length;
  const scope =
    itinerary.journeys.length === 1
      ? `${itinerary.journeys[0].origin} to ${itinerary.journeys[0].destination}`
      : `${itinerary.journeys.length} journeys`;

  return (
    `Cheapest route for ${scope}: ${legs} leg${legs > 1 ? "s" : ""}, ` +
    `total distance ${formatKm(itinerary.totalDistanceKm)}. ` +
    `Fare ${formatUsd(itinerary.priceUsd)} per passenger` +
    (heads > 1 ? `, ${formatUsd(itinerary.totalPriceUsd)} for ${heads} passengers` : "") +
    `. Review the itinerary below and confirm to book.`
  );
}

export const DEMO = { username: DEMO_USERNAME, password: DEMO_PASSWORD };
