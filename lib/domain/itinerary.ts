import type { DomainGraph } from "@/lib/domain/graph";
import { PRICE_PER_KM, distanceKm, round2 } from "@/lib/domain/pricing";
import { findRoute, type Route } from "@/lib/domain/route";
import { RouteInvariantError, verifyRoute } from "@/lib/domain/verify";
import type { Journey } from "@/lib/types";

export const MAX_JOURNEYS = 4;
export const MAX_PASSENGERS = 6;

export interface Itinerary {
  journeys: Journey[];
  passengers: string[];
  totalDistanceKm: number;
  /** Requested departure; every time is assumed available, so it never affects money. */
  departAt: string;
  /** Fare per passenger, still round(total × 0.13, 2). */
  priceUsd: number;
  totalPriceUsd: number;
}

export class ItineraryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ItineraryError";
    this.code = code;
  }
}

export function journeyOf(route: Route): Journey {
  return {
    origin: route.origin,
    destination: route.destination,
    legs: route.legs.map((leg) => ({
      seq: leg.seq,
      from: leg.from,
      to: leg.to,
      distanceKm: leg.distanceKm,
    })),
    transfers: [...route.transfers],
    totalDistanceKm: route.totalDistanceKm,
  };
}

/**
 * Passengers are named travellers. Blank entries are dropped, names are
 * trimmed and de-duplicated case-insensitively, and the list is bounded so a
 * typo cannot create a hundred-seat order.
 */
export function normalizePassengers(input: unknown, fallback: string): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,，、;；]/) : [];
  const seen = new Set<string>();
  const names: string[] = [];

  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const name = entry.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === MAX_PASSENGERS) break;
  }

  if (names.length === 0) names.push(fallback);
  return names;
}

export interface JourneyRequest {
  /** Omit for every journey after the first: it starts where the previous one ends. */
  origin?: string;
  destination: string;
}

export interface BuildItineraryInput {
  journeys: JourneyRequest[];
  passengers: string[];
  departAt?: string | null;
}

/** Six hours of slack so a client in another timezone is never rejected. */
export const DEPARTURE_PAST_GRACE_MS = 6 * 60 * 60 * 1000;

/** Tomorrow 09:00 local time — the default when the passenger names no time. */
export function defaultDeparture(now: number = Date.now()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

/**
 * Accepts an ISO timestamp (or anything the Date parser understands) and
 * rejects values that are already in the past. Every departure is assumed to
 * exist, so no schedule lookup happens here.
 */
export function resolveDeparture(input: string | null | undefined, now: number = Date.now()): string {
  const raw = (input ?? "").trim();
  if (!raw) return defaultDeparture(now);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new ItineraryError("bad_departure", `cannot read departure "${raw}"`);
  if (parsed < now - DEPARTURE_PAST_GRACE_MS) {
    throw new ItineraryError("bad_departure", "departure is in the past");
  }
  return new Date(parsed).toISOString();
}

/**
 * Builds a priced itinerary from requested city pairs. Every journey is routed
 * by the domain engine and verified; the itinerary total is the sum of the
 * journeys' distances, and the fare is still round(total × 0.13, 2) rather than
 * a sum of separately rounded fares, so the contract cannot drift.
 */
export function buildItinerary(graph: DomainGraph, input: BuildItineraryInput): Itinerary {
  const requests = input.journeys.slice(0, MAX_JOURNEYS);
  if (requests.length === 0) throw new ItineraryError("empty", "an itinerary needs at least one journey");

  const journeys: Journey[] = [];
  for (const request of requests) {
    // A trip is a chain: every journey after the first departs from where the
    // previous one landed, so only its destination is needed.
    const previous = journeys[journeys.length - 1]?.destination;
    const origin = (request.origin ?? "").trim() || previous || "";
    const destination = request.destination.trim();
    if (!origin || !destination) {
      throw new ItineraryError("bad_city", "both cities are required");
    }
    if (previous && origin !== previous) {
      throw new ItineraryError("broken_chain", `${origin} does not continue from ${previous}`);
    }
    if (origin === destination) {
      throw new ItineraryError("same_city", `${origin} to ${origin} is not a trip`);
    }
    const route = findRoute(graph, origin, destination);
    if (!route) throw new ItineraryError("no_route", `no route from ${origin} to ${destination}`);
    verifyRoute(graph, route);
    journeys.push(journeyOf(route));
  }

  const totalDistanceKm = round2(journeys.reduce((sum, journey) => sum + journey.totalDistanceKm, 0));
  const passengers = normalizePassengers(input.passengers, "Passenger");
  const departAt = resolveDeparture(input.departAt);
  const priceUsd = round2(totalDistanceKm * PRICE_PER_KM);

  return {
    journeys,
    passengers,
    totalDistanceKm,
    departAt,
    priceUsd,
    totalPriceUsd: round2(priceUsd * passengers.length),
  };
}

/** Re-asserts the whole-itinerary contract: every journey plus the totals. */
export function verifyItinerary(graph: DomainGraph, itinerary: Itinerary): void {
  if (itinerary.journeys.length === 0) throw new RouteInvariantError("itinerary has no journeys");

  // Every journey must start where the previous one ended.
  for (const [index, journey] of itinerary.journeys.entries()) {
    if (index === 0) continue;
    const previous = itinerary.journeys[index - 1];
    if (journey.origin !== previous.destination) {
      throw new RouteInvariantError(`journey ${index + 1} does not continue from ${previous.destination}`);
    }
  }

  for (const journey of itinerary.journeys) {
    const exactDistanceKm = journey.legs.reduce((sum, leg) => {
      const from = graph.cities.get(leg.from);
      const to = graph.cities.get(leg.to);
      if (!from || !to) throw new RouteInvariantError(`leg ${leg.seq} uses an unknown city`);
      return sum + distanceKm(from, to);
    }, 0);

    verifyRoute(graph, {
      origin: journey.origin,
      destination: journey.destination,
      legs: journey.legs,
      transfers: journey.transfers,
      totalDistanceKm: journey.totalDistanceKm,
      priceUsd: round2(journey.totalDistanceKm * PRICE_PER_KM),
      exactDistanceKm,
    });
  }

  const summed = round2(itinerary.journeys.reduce((sum, journey) => sum + journey.totalDistanceKm, 0));
  if (summed !== itinerary.totalDistanceKm) {
    throw new RouteInvariantError(`itinerary total ${itinerary.totalDistanceKm} is not the sum of journeys`);
  }

  const price = round2(itinerary.totalDistanceKm * PRICE_PER_KM);
  if (price !== itinerary.priceUsd) {
    throw new RouteInvariantError(`fare ${itinerary.priceUsd} is not round(total × ${PRICE_PER_KM}, 2)`);
  }

  const orderTotal = round2(itinerary.priceUsd * itinerary.passengers.length);
  if (orderTotal !== itinerary.totalPriceUsd) {
    throw new RouteInvariantError(`order total ${itinerary.totalPriceUsd} is not fare × passengers`);
  }

  if (!Number.isFinite(Date.parse(itinerary.departAt))) {
    throw new RouteInvariantError("itinerary has no readable departure");
  }
}
