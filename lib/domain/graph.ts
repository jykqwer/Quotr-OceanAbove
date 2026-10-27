import { EPSILON, distanceKm } from "@/lib/domain/pricing";
import type { Network, NetworkCity } from "@/lib/types";

/**
 * The flight graph, precomputed once from locations.db.
 *
 * Only hubs may be used as intermediate stops, so the expensive part is an
 * all-pairs shortest path over the 40-node hub subgraph. Endpoints are attached
 * afterwards by enumeration (see route.ts).
 */
export interface DomainGraph {
  cities: Map<string, NetworkCity>;
  /** Hubs reachable directly from a city: itself for a hub, `connected_hubs` otherwise. */
  endpoints: Map<string, string[]>;
  /** Direct hub-to-hub links (undirected). Adjacency only — never the APSP. */
  hubLinks: Map<string, Set<string>>;
  /** Unrounded hub-to-hub distance. */
  hubDistance: Map<string, Map<string, number>>;
  /** Hub-to-hub city sequence, inclusive of both ends. Deterministic. */
  hubPath: Map<string, Map<string, string[]>>;
  hubs: string[];
  /** Cities with at least one flight (hub, or non-hub with connected_hubs). */
  serviced: string[];
}

function byName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function floydWarshall(hubs: string[], edges: Map<string, Map<string, number>>): number[][] {
  const n = hubs.length;
  const index = new Map(hubs.map((name, i) => [name, i]));
  const dist: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
  for (let i = 0; i < n; i += 1) dist[i][i] = 0;

  for (const [from, targets] of edges) {
    const i = index.get(from);
    if (i === undefined) continue;
    for (const [to, weight] of targets) {
      const j = index.get(to);
      if (j !== undefined && weight < dist[i][j]) dist[i][j] = weight;
    }
  }

  for (let k = 0; k < n; k += 1) {
    for (let i = 0; i < n; i += 1) {
      if (dist[i][k] === Infinity) continue;
      for (let j = 0; j < n; j += 1) {
        if (dist[k][j] === Infinity) continue;
        const through = dist[i][k] + dist[k][j];
        if (through < dist[i][j] - EPSILON) dist[i][j] = through;
      }
    }
  }
  return dist;
}

/**
 * Shortest hub path from `from` to `to`, always the lexicographically smallest
 * one. Greedy on the next hop is exact here because lexicographic order is
 * decided by the first differing position; each step strictly shrinks the
 * remaining distance, so the walk terminates.
 */
function reconstruct(
  from: string,
  to: string,
  dist: Map<string, Map<string, number>>,
  edges: Map<string, Map<string, number>>,
): string[] | null {
  const target = dist.get(from)?.get(to);
  if (target === undefined) return null;

  const path = [from];
  let cursor = from;
  let guard = 0;
  while (cursor !== to) {
    const neighbours = [...(edges.get(cursor)?.keys() ?? [])].sort(byName);
    const next = neighbours.find((candidate) => {
      const step = edges.get(cursor)?.get(candidate) ?? Infinity;
      const rest = dist.get(candidate)?.get(to);
      if (rest === undefined) return false;
      return Math.abs(dist.get(cursor)?.get(to)! - (step + rest)) <= EPSILON;
    });
    if (!next) return null;
    path.push(next);
    cursor = next;
    guard += 1;
    if (guard > dist.size + 1) return null;
  }
  return path;
}

export function buildGraph(network: Network): DomainGraph {
  const cities = new Map(network.cities.map((city) => [city.name, city]));
  const hubs = network.cities
    .filter((city) => city.isHub)
    .map((city) => city.name)
    .sort(byName);

  const edges = new Map<string, Map<string, number>>();
  const hubLinks = new Map<string, Set<string>>();
  for (const hub of hubs) {
    edges.set(hub, new Map());
    hubLinks.set(hub, new Set());
  }
  for (const link of network.links) {
    const a = cities.get(link.a);
    const b = cities.get(link.b);
    if (!a || !b) throw new Error(`hub_links references unknown city: ${link.a} → ${link.b}`);
    const weight = distanceKm(a, b);
    edges.get(link.a)?.set(link.b, weight);
    edges.get(link.b)?.set(link.a, weight);
    hubLinks.get(link.a)?.add(link.b);
    hubLinks.get(link.b)?.add(link.a);
  }

  const endpoints = new Map<string, string[]>();
  const serviced: string[] = [];
  for (const city of network.cities) {
    if (city.isHub) {
      endpoints.set(city.name, [city.name]);
      serviced.push(city.name);
      continue;
    }
    const list = [...new Set(city.hubs)].sort(byName);
    for (const hub of list) {
      if (!cities.has(hub)) throw new Error(`connected_hubs of ${city.name} references unknown city: ${hub}`);
    }
    endpoints.set(city.name, list);
    if (list.length > 0) serviced.push(city.name);
  }

  const matrix = floydWarshall(hubs, edges);
  const distance = new Map<string, Map<string, number>>();
  const path = new Map<string, Map<string, string[]>>();
  for (let i = 0; i < hubs.length; i += 1) {
    const rowDistance = new Map<string, number>();
    const rowPath = new Map<string, string[]>();
    for (let j = 0; j < hubs.length; j += 1) {
      if (matrix[i][j] === Infinity) continue;
      rowDistance.set(hubs[j], matrix[i][j]);
    }
    distance.set(hubs[i], rowDistance);
    path.set(hubs[i], rowPath);
  }
  for (const from of hubs) {
    for (const to of hubs) {
      if (!distance.get(from)?.has(to)) continue;
      const sequence = reconstruct(from, to, distance, edges);
      if (!sequence) throw new Error(`hub path ${from} → ${to} could not be reconstructed`);
      path.get(from)!.set(to, sequence);
    }
  }

  return { cities, endpoints, hubLinks, hubDistance: distance, hubPath: path, hubs, serviced };
}
