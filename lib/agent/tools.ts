import type { Db } from "@/lib/db/app";
import type { DomainGraph } from "@/lib/domain/graph";
import { resolveCity } from "@/lib/domain/resolve";
import { findRoute, type Route } from "@/lib/domain/route";
import { verifyRoute } from "@/lib/domain/verify";
import { formatKm, formatUsd } from "@/lib/format";
import type { Quote, Ticket } from "@/lib/types";
import type { LlmToolSchema } from "@/lib/agent/llm";

export interface ToolContext {
  graph: DomainGraph;
  db: Db;
  userId: string;
  conversationId: string;
  tickets: Ticket[];
  /** Injected so tests can exercise the loop without touching SQLite. */
  createQuote: (route: Route) => Quote;
}

export interface ToolOutcome {
  /** Payload sent back to the model: the only source of numbers it may print. */
  payload: unknown;
  ok: boolean;
}

export interface ToolState {
  route?: Route;
  quote?: Quote;
}

export const TOOL_SCHEMAS: LlmToolSchema[] = [
  {
    name: "resolve_city",
    description:
      "Resolve a city name exactly as the user wrote it. Returns the matched city, a list of candidates when the name is ambiguous, or the nearest served city when there is no service. Always call this before find_route.",
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
    name: "find_route",
    description:
      "Cheapest route between two already-resolved cities. Transfers are only allowed at hubs. Returns the legs, transfer cities, total distance and total price, already formatted for display.",
    parameters: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Exact origin city name from resolve_city." },
        destination: { type: "string", description: "Exact destination city name from resolve_city." },
      },
      required: ["origin", "destination"],
      additionalProperties: false,
    },
  },
  {
    name: "create_booking_quote",
    description:
      "Create the booking quote the user can confirm. Call this once you have a verified route for a concrete origin/destination pair. This only quotes; it never books.",
    parameters: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Exact origin city name from resolve_city." },
        destination: { type: "string", description: "Exact destination city name from resolve_city." },
      },
      required: ["origin", "destination"],
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
export function routePayload(route: Route) {
  return {
    origin: route.origin,
    destination: route.destination,
    legs: route.legs.map((leg) => ({
      seq: leg.seq,
      from: leg.from,
      to: leg.to,
      distance: formatKm(leg.distanceKm),
    })),
    transfers: route.transfers,
    legCount: route.legs.length,
    totalDistance: formatKm(route.totalDistanceKm),
    price: formatUsd(route.priceUsd),
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
    case "find_route":
      return findRouteTool(args, ctx, state);
    case "create_booking_quote":
      return createQuoteTool(args, ctx, state);
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
          nearest: {
            city: resolution.nearest.city,
            distance: formatKm(resolution.nearest.distanceKm),
          },
          ask: "There is no service to this city. Offer the nearest served city; never substitute it silently.",
        },
      };
    default:
      return { ok: false, payload: { status: "unknown", text } };
  }
}

function findRouteTool(args: Record<string, unknown>, ctx: ToolContext, state: ToolState): ToolOutcome {
  const origin = typeof args.origin === "string" ? args.origin : "";
  const destination = typeof args.destination === "string" ? args.destination : "";
  if (!origin || !destination) {
    return { ok: false, payload: { error: "origin_and_destination_required" } };
  }

  const route = findRoute(ctx.graph, origin, destination);
  if (!route) {
    return { ok: false, payload: { error: "no_route", origin, destination } };
  }

  // The invariant is checked here, not trusted from the model's narration.
  verifyRoute(ctx.graph, route);

  state.route = route;
  return { ok: true, payload: { status: "ok", verified: true, ...routePayload(route) } };
}

function createQuoteTool(args: Record<string, unknown>, ctx: ToolContext, state: ToolState): ToolOutcome {
  const origin = typeof args.origin === "string" ? args.origin : "";
  const destination = typeof args.destination === "string" ? args.destination : "";
  if (!origin || !destination) {
    return { ok: false, payload: { error: "origin_and_destination_required" } };
  }

  // Recompute from the engine so a quote can never come from model-provided numbers.
  const route = findRoute(ctx.graph, origin, destination);
  if (!route) return { ok: false, payload: { error: "no_route", origin, destination } };
  verifyRoute(ctx.graph, route);

  const quote = ctx.createQuote(route);
  state.route = route;
  state.quote = quote;
  return {
    ok: true,
    payload: {
      status: "quoted",
      quoteId: quote.id,
      expiresAt: quote.expiresAt,
      bookingRequiresUserConfirmation: true,
      ...routePayload(route),
    },
  };
}

function ticketsPayload(tickets: Ticket[]) {
  return {
    count: tickets.length,
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      route: `${ticket.origin} → ${ticket.destination}`,
      totalDistance: formatKm(ticket.totalDistanceKm),
      price: formatUsd(ticket.priceUsd),
      bookedAt: ticket.bookedAt,
    })),
  };
}
