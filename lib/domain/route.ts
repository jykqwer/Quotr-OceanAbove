import { EPSILON, distanceKm, priceFor, round2 } from "@/lib/domain/pricing";
import type { DomainGraph } from "@/lib/domain/graph";
import type { Leg } from "@/lib/types";

export interface Route {
  origin: string;
  destination: string;
  legs: Leg[];
  transfers: string[];
  /** Sum of the rounded legs — the number shown to the user. */
  totalDistanceKm: number;
  /** round(totalDistanceKm × 0.13, 2). */
  priceUsd: number;
  /** Unrounded distance, used for choosing between candidates. */
  exactDistanceKm: number;
}

function sequence(origin: string, destination: string, hubs: string[]): string[] {
  const raw = [origin, ...hubs, destination];
  // A hub endpoint appears twice in `raw` (as origin and as first hub); drop the repeat.
  return raw.filter((city, index) => index === 0 || city !== raw[index - 1]);
}

function toRoute(graph: DomainGraph, path: string[]): Route {
  const legs: Leg[] = [];
  let exact = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = graph.cities.get(path[i]);
    const to = graph.cities.get(path[i + 1]);
    if (!from || !to) throw new Error(`route references unknown city: ${path[i]} → ${path[i + 1]}`);
    const km = distanceKm(from, to);
    exact += km;
    legs.push({ seq: i + 1, from: from.name, to: to.name, distanceKm: round2(km) });
  }
  const totalDistanceKm = round2(legs.reduce((sum, leg) => sum + leg.distanceKm, 0));
  return {
    origin: path[0],
    destination: path[path.length - 1],
    legs,
    transfers: legs.slice(0, -1).map((leg) => leg.to),
    totalDistanceKm,
    priceUsd: priceFor(totalDistanceKm),
    exactDistanceKm: exact,
  };
}

function compareKeys(a: Route, b: Route): number {
  if (Math.abs(a.exactDistanceKm - b.exactDistanceKm) > EPSILON) {
    return a.exactDistanceKm - b.exactDistanceKm;
  }
  if (a.legs.length !== b.legs.length) return a.legs.length - b.legs.length;
  const left = a.legs.map((leg) => leg.from).concat(a.destination);
  const right = b.legs.map((leg) => leg.from).concat(b.destination);
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return left.length - right.length;
}

/**
 * Cheapest valid route: `origin → hub → … → hub → destination`.
 *
 * Transfers may only happen at hubs, so this enumerates the hub pair
 * (hubsOf(origin) × hubsOf(destination)) and adds the two connector legs to the
 * precomputed hub distance. A shortest path over the full city graph would be
 * wrong — it would let passengers change planes in non-hub cities.
 *
 * Ties are broken deterministically: distance → fewest legs → city sequence.
 */
export function findRoute(graph: DomainGraph, origin: string, destination: string): Route | null {
  if (origin === destination) return null;
  if (!graph.cities.has(origin) || !graph.cities.has(destination)) return null;

  const fromHubs = graph.endpoints.get(origin) ?? [];
  const toHubs = graph.endpoints.get(destination) ?? [];
  if (fromHubs.length === 0 || toHubs.length === 0) return null;

  const originCity = graph.cities.get(origin)!;
  const destinationCity = graph.cities.get(destination)!;

  let best: Route | null = null;
  for (const hubA of fromHubs) {
    const hubACity = graph.cities.get(hubA);
    if (!hubACity) continue;
    const leadIn = hubA === origin ? 0 : distanceKm(originCity, hubACity);

    for (const hubB of toHubs) {
      const hubBCity = graph.cities.get(hubB);
      if (!hubBCity) continue;
      const middle = graph.hubPath.get(hubA)?.get(hubB);
      if (!middle) continue;

      const leadOut = hubB === destination ? 0 : distanceKm(hubBCity, destinationCity);
      const candidate = toRoute(graph, sequence(origin, destination, middle));

      // Guard against a reconstruction drifting from the recorded hub distance.
      if (Math.abs(candidate.exactDistanceKm - (leadIn + (graph.hubDistance.get(hubA)?.get(hubB) ?? 0) + leadOut)) > 1e-6) {
        throw new Error(`route ${origin} → ${destination} via ${hubA}/${hubB} is inconsistent`);
      }

      if (best === null || compareKeys(candidate, best) < 0) best = candidate;
    }
  }
  return best;
}
