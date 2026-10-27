import { createHash } from "node:crypto";
import type { Journey } from "@/lib/types";

/**
 * The immutable part of a quote. `status`, timestamps and the conversation link
 * are deliberately excluded: the hash must change only if what the user was
 * shown changes.
 */
export interface QuoteSnapshot {
  origin: string;
  destination: string;
  journeys: Journey[];
  passengers: string[];
  totalDistanceKm: number;
  departAt: string;
  priceUsd: number;
  totalPriceUsd: number;
}

export function snapshotOf(source: QuoteSnapshot): QuoteSnapshot {
  return {
    origin: source.origin,
    destination: source.destination,
    journeys: source.journeys.map((journey) => ({
      origin: journey.origin,
      destination: journey.destination,
      legs: journey.legs.map((leg) => ({
        seq: leg.seq,
        from: leg.from,
        to: leg.to,
        distanceKm: leg.distanceKm,
      })),
      transfers: [...journey.transfers],
      totalDistanceKm: journey.totalDistanceKm,
    })),
    passengers: [...source.passengers],
    totalDistanceKm: source.totalDistanceKm,
    departAt: source.departAt,
    priceUsd: source.priceUsd,
    totalPriceUsd: source.totalPriceUsd,
  };
}

/** Deterministic JSON: keys sorted at every level, so the hash is stable. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export function hashSnapshot(snapshot: QuoteSnapshot): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}
