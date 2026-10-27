import type { Db } from "@/lib/db/app";
import type { DomainGraph } from "@/lib/domain/graph";
import {
  ItineraryError,
  MAX_JOURNEYS,
  MAX_PASSENGERS,
  buildItinerary,
  type Itinerary,
} from "@/lib/domain/itinerary";
import { resolveCity, suggestCities } from "@/lib/domain/resolve";
import { directDestinations } from "@/lib/domain/network";
import { formatDateTime, formatKm, formatUsd } from "@/lib/format";
import type { Quote, Ticket } from "@/lib/types";
import type { LlmToolSchema } from "@/lib/agent/llm";

export interface ToolContext {
  graph: DomainGraph;
  db: Db;
  userId: string;
  conversationId: string;
  tickets: Ticket[];
  /** Used when the passenger names nobody: the account holder. */
  defaultPassenger: string;
  /** Injected so tests can exercise the loop without touching SQLite. */
  createQuote: (itinerary: Itinerary) => Quote;
}

export interface ToolOutcome {
  /** Payload sent back to the model: the only source of numbers it may print. */
  payload: unknown;
  ok: boolean;
}

export interface ToolState {
  itinerary?: Itinerary;
  quote?: Quote;
}

const JOURNEYS_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: MAX_JOURNEYS,
  description:
    "One entry per city pair the passenger flies. A one-way trip has exactly one entry; a round trip or open jaw has one entry per city pair. Never split one city pair into several entries.",
  items: {
    type: "object",
    properties: {
      origin: { type: "string", description: "Exact origin city name from resolve_city." },
      destination: { type: "string", description: "Exact destination city name from resolve_city." },
    },
    required: ["origin", "destination"],
    additionalProperties: false,
  },
};

const PASSENGERS_SCHEMA = {
  type: "array",
  maxItems: MAX_PASSENGERS,
  description: "Traveller names. Omit for a single passenger.",
  items: { type: "string" },
};

const DEPART_AT_SCHEMA = {
  type: "string",
  description:
    "Requested departure as ISO 8601 (YYYY-MM-DDTHH:mm). Only pass this when the passenger named a date or time; otherwise omit it and the system picks the next available departure.",
};

export const TOOL_SCHEMAS: LlmToolSchema[] = [
  {
    name: "resolve_city",
    description:
      "Resolve a city name exactly as the user wrote it. Returns the matched city, a list of candidates when the name is ambiguous, or the nearest served city when there is no service. Always call this before pricing anything.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "The city name as written by the user." },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "find_itinerary",
    description:
      "Cheapest route for every city pair, priced as one itinerary. Transfers are only allowed at hubs. Returns the legs, transfer cities, per-passenger fare and order total, already formatted for display.",
    parameters: {
      type: "object",
      properties: { journeys: JOURNEYS_SCHEMA, passengers: PASSENGERS_SCHEMA },
      required: ["journeys"],
      additionalProperties: false,
    },
  },
  {
    name: "direct_destinations",
    description:
      "List the cities reachable from one city with a single flight. Use this when the passenger asks where a city flies to. Transfers are not included.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "Exact city name from resolve_city." },
      },
      required: ["city"],
      additionalProperties: false,
    },
  },
  {
    name: "nearest_served_city",
    description:
      "For a city the network does not serve, find the nearest city that does, measured on our own map. Call this after resolve_city answers \"no_service\" so the recommendation is visible. It returns no distance for a city that is not in the dataset at all — never invent one in that case.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "The city as the user wrote it." },
      },
      required: ["city"],
      additionalProperties: false,
    },
  },
  {
    name: "create_booking_quote",
    description:
      "Create the booking quote the passenger can confirm for exactly these city pairs and travellers. Call this once you have a priced itinerary. This only quotes; it never books.",
    parameters: {
      type: "object",
      properties: { journeys: JOURNEYS_SCHEMA, passengers: PASSENGERS_SCHEMA, departAt: DEPART_AT_SCHEMA },
      required: ["journeys"],
      additionalProperties: false,
    },
  },
  {
    name: "list_my_tickets",
    description: "List the tickets this passenger has already booked. Takes no arguments.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
];

/** Numbers and city names the assistant is allowed to repeat. */
export function itineraryPayload(itinerary: Itinerary) {
  return {
    journeys: itinerary.journeys.map((journey, index) => ({
      index: index + 1,
      origin: journey.origin,
      destination: journey.destination,
      legs: journey.legs.map((leg) => ({
        seq: leg.seq,
        from: leg.from,
        to: leg.to,
        distance: formatKm(leg.distanceKm),
      })),
      transfers: journey.transfers,
      legCount: journey.legs.length,
      distance: formatKm(journey.totalDistanceKm),
    })),
    journeyCount: itinerary.journeys.length,
    passengers: itinerary.passengers,
    passengerCount: itinerary.passengers.length,
    totalDistance: formatKm(itinerary.totalDistanceKm),
    departure: formatDateTime(itinerary.departAt, "en"),
    farePerPassenger: formatUsd(itinerary.priceUsd),
    orderTotal: formatUsd(itinerary.totalPriceUsd),
  };
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  state: ToolState,
): Promise<ToolOutcome> {
  switch (name) {
    case "resolve_city":
      return resolveCityTool(args, ctx);
    case "find_itinerary":
      return priceItinerary(args, ctx, state, false);
    case "direct_destinations":
      return directDestinationsTool(args, ctx);
    case "nearest_served_city":
      return nearestServedTool(args, ctx);
    case "create_booking_quote":
      return priceItinerary(args, ctx, state, true);
    case "list_my_tickets":
      return { ok: true, payload: ticketsPayload(ctx.tickets) };
    default:
      return { ok: false, payload: { error: "unknown_tool", name } };
  }
}

function resolveCityTool(args: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const text = typeof args.text === "string" ? args.text : "";
  const resolution = resolveCity(ctx.graph, text);

  switch (resolution.status) {
    case "found":
      return {
        ok: true,
        payload: {
          status: "found",
          city: resolution.city,
          isHub: ctx.graph.cities.get(resolution.city)?.isHub ?? false,
        },
      };
    case "ambiguous":
      return {
        ok: true,
        payload: {
          status: "ambiguous",
          ask: "Which city does the user mean?",
          candidates: resolution.candidates,
        },
      };
    case "no_service":
      return {
        ok: true,
        payload: {
          status: "no_service",
          city: resolution.city,
          ask: "Call nearest_served_city for this city, tell the passenger it has no service, and offer the nearest one instead. Never substitute it silently.",
        },
      };
    default: {
      // No row in the dataset means no coordinates: a distance here would be
      // fabricated, so offer the closest names we do know instead.
      const suggestions = suggestCities(ctx.graph, text);
      return {
        ok: false,
        payload: {
          status: "not_found",
          query: text,
          suggestions,
          note: "This city is not in our dataset, so we cannot measure how far it is. Ask which of the suggestions the passenger meant.",
        },
      };
    }
  }
}

function nearestServedTool(args: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const text = typeof args.city === "string" ? args.city : "";
  const resolution = resolveCity(ctx.graph, text);

  if (resolution.status === "found") {
    return { ok: true, payload: { status: "has_service", city: resolution.city } };
  }
  if (resolution.status !== "no_service") {
    return {
      ok: false,
      payload: {
        status: "no_coordinates",
        query: text,
        suggestions: suggestCities(ctx.graph, text),
        note: "Not in our dataset — no distance can be computed without inventing coordinates.",
      },
    };
  }

  return {
    ok: true,
    payload: {
      status: "no_service",
      city: resolution.city,
      nearest: {
        city: resolution.nearest.city,
        distance: formatKm(resolution.nearest.distanceKm),
      },
      basis: "locations.db coordinates",
    },
  };
}

function directDestinationsTool(args: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const requested = typeof args.city === "string" ? args.city.trim() : "";
  if (!requested) return { ok: false, payload: { error: "city_required" } };

  const resolution = resolveCity(ctx.graph, requested);
  if (resolution.status !== "found") {
    return { ok: false, payload: { error: `city_${resolution.status}`, city: requested } };
  }

  const direct = directDestinations(ctx.graph, resolution.city);
  if (!direct) return { ok: false, payload: { error: "city_unknown", city: resolution.city } };

  return {
    ok: true,
    payload: {
      status: "ok",
      city: direct.city,
      isHub: direct.isHub,
      destinationCount: direct.cities.length,
      hubCount: direct.hubs.length,
      hubs: direct.hubs,
      // Spoke cities are the fewest useful names; the hub count above is exact.
      cities: direct.cities.slice(0, 40),
      truncated: direct.cities.length > 40,
    },
  };
}

function priceItinerary(  args: Record<string, unknown>,
  ctx: ToolContext,
  state: ToolState,
  alsoCreateQuote: boolean,
): ToolOutcome {
  const rawJourneys = Array.isArray(args.journeys) ? args.journeys : [];
  const journeys = rawJourneys
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      origin: typeof entry.origin === "string" ? entry.origin : "",
      destination: typeof entry.destination === "string" ? entry.destination : "",
    }))
    .filter((entry) => entry.origin && entry.destination);

  if (journeys.length === 0) return { ok: false, payload: { error: "journeys_required" } };

  let itinerary: Itinerary;
  try {
    itinerary = buildItinerary(ctx.graph, {
      journeys,
      passengers:
        Array.isArray(args.passengers) && args.passengers.length > 0
          ? (args.passengers as string[])
          : [ctx.defaultPassenger],
      departAt: typeof args.departAt === "string" ? args.departAt : undefined,
    });
  } catch (cause) {
    const error = cause instanceof ItineraryError ? cause.code : "itinerary_failed";
    return { ok: false, payload: { error, journeys } };
  }

  state.itinerary = itinerary;
  if (!alsoCreateQuote) {
    return { ok: true, payload: { status: "ok", verified: true, ...itineraryPayload(itinerary) } };
  }

  const quote = ctx.createQuote(itinerary);
  state.quote = quote;
  return {
    ok: true,
    payload: {
      status: "quoted",
      quoteId: quote.id,
      expiresAt: quote.expiresAt,
      bookingRequiresUserConfirmation: true,
      ...itineraryPayload(itinerary),
    },
  };
}

function ticketsPayload(tickets: Ticket[]) {
  return {
    count: tickets.length,
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      route:
        ticket.journeys.length > 1
          ? ticket.journeys.map((journey) => `${journey.origin} → ${journey.destination}`).join(" / ")
          : `${ticket.origin} → ${ticket.destination}`,
      passengers: ticket.passengers,
      totalDistance: formatKm(ticket.totalDistanceKm),
      departure: ticket.departAt ? formatDateTime(ticket.departAt, "en") : null,
      farePerPassenger: formatUsd(ticket.priceUsd),
      orderTotal: formatUsd(ticket.totalPriceUsd),
      bookedAt: ticket.bookedAt,
    })),
  };
}
