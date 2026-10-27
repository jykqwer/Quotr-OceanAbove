import type { DomainGraph } from "@/lib/domain/graph";
import { EPSILON, PRICE_PER_KM, distanceKm, round2 } from "@/lib/domain/pricing";
import type { Route } from "@/lib/domain/route";

export class RouteInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteInvariantError";
  }
}

/** True when the two cities have a direct flight, in either direction. */
export function isDirectFlight(graph: DomainGraph, a: string, b: string): boolean {
  const from = graph.cities.get(a);
  const to = graph.cities.get(b);
  if (!from || !to || from.name === to.name) return false;
  // Adjacency only: the APSP says every hub can reach every other hub, which
  // would let a two-hop hub leg pass as a direct flight.
  if (from.isHub && to.isHub) return graph.hubLinks.get(a)?.has(b) ?? false;
  if (from.isHub) return to.hubs.includes(a);
  if (to.isHub) return from.hubs.includes(b);
  // Two non-hub cities never share a flight, and neither may be a transfer.
  return false;
}

/**
 * Every guarantee the product makes about a route, asserted before it is stored
 * or shown. Throws instead of returning a flag: a violation is a bug, not a state.
 */
export function verifyRoute(graph: DomainGraph, route: Route): void {
  if (route.legs.length === 0) throw new RouteInvariantError("route has no legs");
  if (route.origin === route.destination) throw new RouteInvariantError("origin equals destination");

  const path = [route.legs[0].from, ...route.legs.map((leg) => leg.to)];
  if (path[0] !== route.origin) throw new RouteInvariantError("route does not start at origin");
  if (path[path.length - 1] !== route.destination) throw new RouteInvariantError("route does not end at destination");

  for (const [index, leg] of route.legs.entries()) {
    if (leg.seq !== index + 1) throw new RouteInvariantError(`leg ${index} has seq ${leg.seq}`);
    if (leg.from !== path[index] || leg.to !== path[index + 1]) {
      throw new RouteInvariantError(`leg ${leg.seq} does not chain`);
    }
    const from = graph.cities.get(leg.from);
    const to = graph.cities.get(leg.to);
    if (!from || !to) throw new RouteInvariantError(`leg ${leg.seq} uses an unknown city`);
    if (round2(distanceKm(from, to)) !== leg.distanceKm) {
      throw new RouteInvariantError(`leg ${leg.seq} distance is not the rounded Euclidean distance`);
    }
    if (!isDirectFlight(graph, leg.from, leg.to)) {
      throw new RouteInvariantError(`leg ${leg.seq} (${leg.from} → ${leg.to}) is not a direct flight`);
    }
  }

  // Transfers happen only at hubs: every interior city must be a hub.
  for (const city of path.slice(1, -1)) {
    if (!graph.cities.get(city)?.isHub) {
      throw new RouteInvariantError(`${city} is an interior stop but not a hub`);
    }
  }

  const summed = round2(route.legs.reduce((sum, leg) => sum + leg.distanceKm, 0));
  if (summed !== route.totalDistanceKm) {
    throw new RouteInvariantError(`total ${route.totalDistanceKm} is not the sum of legs ${summed}`);
  }
  const price = round2(route.totalDistanceKm * PRICE_PER_KM);
  if (price !== route.priceUsd) {
    throw new RouteInvariantError(`price ${route.priceUsd} is not round(total × ${PRICE_PER_KM}, 2) = ${price}`);
  }

  const expectedTransfers = route.legs.slice(0, -1).map((leg) => leg.to);
  if (route.transfers.join("|") !== expectedTransfers.join("|")) {
    throw new RouteInvariantError("transfers do not match the interior cities");
  }

  if (Math.abs(route.exactDistanceKm - route.legs.reduce(
    (sum, leg) => {
      const from = graph.cities.get(leg.from)!;
      const to = graph.cities.get(leg.to)!;
      return sum + distanceKm(from, to);
    },
    0,
  )) > EPSILON) {
    throw new RouteInvariantError("exact distance disagrees with the legs");
  }
}
