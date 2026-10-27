import type { DomainGraph } from "@/lib/domain/graph";

export interface DirectDestinations {
  city: string;
  isHub: boolean;
  /** Cities reachable with a single flight, sorted. */
  cities: string[];
  /** The subset that are hubs (empty for a non-hub city). */
  hubs: string[];
}

/**
 * Everywhere one city flies to without changing planes.
 *
 * A hub reaches other hubs through `hub_links` plus the spoke cities that list
 * it in `connected_hubs`; a spoke reaches exactly the hubs it lists. Nothing
 * else is a direct flight, so this mirrors `isDirectFlight`.
 */
export function directDestinations(graph: DomainGraph, cityName: string): DirectDestinations | null {
  const city = graph.cities.get(cityName);
  if (!city) return null;

  const destinations = new Set<string>();

  if (city.isHub) {
    for (const other of graph.hubs) {
      if (other === city.name) continue;
      if (graph.hubDistance.get(city.name)?.has(other)) destinations.add(other);
    }
    for (const candidate of graph.cities.values()) {
      if (candidate.isHub) continue;
      if (candidate.hubs.includes(city.name)) destinations.add(candidate.name);
    }
  } else {
    for (const hub of city.hubs) destinations.add(hub);
  }

  const cities = [...destinations].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    city: city.name,
    isHub: city.isHub,
    cities,
    hubs: cities.filter((name) => graph.cities.get(name)?.isHub ?? false),
  };
}
