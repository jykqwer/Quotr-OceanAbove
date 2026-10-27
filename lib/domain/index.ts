import { loadNetwork } from "@/lib/db/locations";
import { buildGraph, type DomainGraph } from "@/lib/domain/graph";

export type { DomainGraph } from "@/lib/domain/graph";
export { buildGraph } from "@/lib/domain/graph";
export { directDestinations, type DirectDestinations } from "@/lib/domain/network";
export { EPSILON, PRICE_PER_KM, distanceKm, priceFor, round2 } from "@/lib/domain/pricing";
export { findRoute, type Route } from "@/lib/domain/route";
export {
  ItineraryError,
  MAX_JOURNEYS,
  MAX_PASSENGERS,
  buildItinerary,
  defaultDeparture,
  journeyOf,
  normalizePassengers,
  resolveDeparture,
  verifyItinerary,
  type Itinerary,
  type JourneyRequest,
} from "@/lib/domain/itinerary";
export { findCityMentions, nearestServiced, normalizeName, resolveCity, suggestCities, type CityMention, type Resolution } from "@/lib/domain/resolve";
export { RouteInvariantError, isDirectFlight, verifyRoute } from "@/lib/domain/verify";

let cached: DomainGraph | null = null;

/**
 * Server-only: the graph is built from the read-only dataset once per process.
 * Never import this module from a "use client" file.
 */
export function getGraph(): DomainGraph {
  if (!cached) cached = buildGraph(loadNetwork());
  return cached;
}
