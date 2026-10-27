import { distanceKm } from "@/lib/domain/pricing";
import type { DomainGraph } from "@/lib/domain/graph";

export type Resolution =
  | { status: "found"; city: string }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "no_service"; city: string; nearest: { city: string; distanceKm: number } }
  | { status: "not_found"; query: string };

const COMBINING = /[\u0300-\u036f]/g;

/** Fold case, diacritics and punctuation so "San José" and "san jose" compare equal. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function nearestServiced(graph: DomainGraph, city: string): { city: string; distanceKm: number } | null {
  const from = graph.cities.get(city);
  if (!from) return null;
  let best: { city: string; distanceKm: number } | null = null;
  for (const candidate of graph.serviced) {
    if (candidate === city) continue;
    const to = graph.cities.get(candidate);
    if (!to) continue;
    const km = distanceKm(from, to);
    if (best === null || km < best.distanceKm - 1e-9 || (Math.abs(km - best.distanceKm) <= 1e-9 && candidate < best.city)) {
      best = { city: candidate, distanceKm: km };
    }
  }
  return best;
}

/**
 * Resolve a user-supplied city name. Never guesses:
 * an ambiguous name returns candidates, and a city without service returns the
 * nearest one that has service rather than being silently substituted.
 */
export function resolveCity(graph: DomainGraph, query: string): Resolution {
  const needle = normalizeName(query);
  if (!needle) return { status: "not_found", query };

  const byNormalized = new Map<string, string[]>();
  for (const name of graph.cities.keys()) {
    const key = normalizeName(name);
    const list = byNormalized.get(key) ?? [];
    list.push(name);
    byNormalized.set(key, list);
  }

  const settle = (name: string): Resolution => {
    const city = graph.cities.get(name);
    if (!city) return { status: "not_found", query };
    const hasService = city.isHub || city.hubs.length > 0;
    if (hasService) return { status: "found", city: name };
    const nearest = nearestServiced(graph, name);
    if (!nearest) return { status: "not_found", query };
    return { status: "no_service", city: name, nearest };
  };

  const exact = byNormalized.get(needle);
  if (exact && exact.length === 1) return settle(exact[0]);
  if (exact && exact.length > 1) {
    return { status: "ambiguous", candidates: [...exact].sort(compare) };
  }

  const names = [...graph.cities.keys()];
  for (const matcher of [
    (name: string) => normalizeName(name).startsWith(needle),
    (name: string) => normalizeName(name).includes(needle),
  ]) {
    const hits = names.filter(matcher).sort(compare);
    if (hits.length === 1) return settle(hits[0]);
    if (hits.length > 1) {
      // Prefer an exact word match if one exists, e.g. "Santiago" over "Santiago de Cuba".
      const word = hits.filter((name) => normalizeName(name) === needle);
      if (word.length === 1) return settle(word[0]);
      return { status: "ambiguous", candidates: hits.slice(0, 6) };
    }
  }

  return { status: "not_found", query };
}

export interface CityMention {
  /** The matched text, e.g. "San Jose". */
  text: string;
  /** Every city whose folded name equals the match; more than one means ambiguity. */
  candidates: string[];
}

/**
 * City names mentioned in free text, longest match first, without overlapping
 * spans. Ambiguous matches are returned as-is so the caller can ask instead of
 * silently picking one.
 */
export function findCityMentions(graph: DomainGraph, text: string): CityMention[] {
  const tokens = text.split(/[^A-Za-z\u00c0-\u024f]+/).filter(Boolean);
  const lookup = new Map<string, string[]>();
  for (const name of graph.cities.keys()) {
    const key = normalizeName(name);
    const list = lookup.get(key) ?? [];
    list.push(name);
    lookup.set(key, list);
  }

  const taken = new Array<boolean>(tokens.length).fill(false);
  const found: CityMention[] = [];

  // Longest window first so "Santiago de Cuba" wins over "Santiago".
  for (let size = 4; size >= 1; size -= 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      if (taken.slice(start, start + size).some(Boolean)) continue;
      const window = tokens.slice(start, start + size);
      const matches = lookup.get(normalizeName(window.join("")));
      if (!matches) continue;
      found.push({ text: window.join(" "), candidates: [...matches].sort(compare) });
      for (let i = start; i < start + size; i += 1) taken[i] = true;
    }
  }
  return found;
}
