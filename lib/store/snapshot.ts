import { createHash } from "node:crypto";
import type { Leg } from "@/lib/types";

/**
 * The immutable part of a quote. `status`, timestamps and the conversation link
 * are deliberately excluded: the hash must change only if what the user was
 * shown changes.
 */
export interface QuoteSnapshot {
  origin: string;
  destination: string;
  legs: Leg[];
  transfers: string[];
  totalDistanceKm: number;
  priceUsd: number;
}

export function snapshotOf(route: QuoteSnapshot): QuoteSnapshot {
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
    priceUsd: route.priceUsd,
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
