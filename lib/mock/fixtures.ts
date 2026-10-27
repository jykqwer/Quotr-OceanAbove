import type { Leg } from "@/lib/types";

export interface RouteFixture {
  origin: string;
  destination: string;
  legs: Leg[];
  totalDistanceKm: number;
  priceUsd: number;
}

function route(origin: string, destination: string, legs: Leg[]): RouteFixture {
  const totalDistanceKm = Number(
    legs.reduce((sum, leg) => sum + leg.distanceKm, 0).toFixed(2),
  );
  return {
    origin,
    destination,
    legs,
    totalDistanceKm,
    priceUsd: Math.round(totalDistanceKm * 0.13 * 100) / 100,
  };
}

/**
 * Values computed from locations.db with the hub-constrained cheapest-route
 * algorithm. Legs are rounded to 2dp first, so total = sum of displayed legs
 * and price = round(total * 0.13, 2) — both reproducible by hand.
 */
export const ROUTES: RouteFixture[] = [
  route("Shanghai", "London", [
    { seq: 1, from: "Shanghai", to: "Hong Kong", distanceKm: 1717.86 },
    { seq: 2, from: "Hong Kong", to: "Lagos", distanceKm: 2819.14 },
    { seq: 3, from: "Lagos", to: "London", distanceKm: 1539.77 },
  ]),
  route("Guangzhou", "Lima", [
    { seq: 1, from: "Guangzhou", to: "Frankfurt", distanceKm: 1362.08 },
    { seq: 2, from: "Frankfurt", to: "Singapore", distanceKm: 1872.42 },
    { seq: 3, from: "Singapore", to: "Amsterdam", distanceKm: 4097.07 },
    { seq: 4, from: "Amsterdam", to: "Lima", distanceKm: 1596.99 },
  ]),
  route("Toronto", "Tokyo", [
    { seq: 1, from: "Toronto", to: "Sydney", distanceKm: 5135.59 },
    { seq: 2, from: "Sydney", to: "Tokyo", distanceKm: 1627.07 },
  ]),
  route("Chengdu", "Split", [
    { seq: 1, from: "Chengdu", to: "Shanghai", distanceKm: 1996.32 },
    { seq: 2, from: "Shanghai", to: "Split", distanceKm: 1929.44 },
  ]),
  route("Hue", "Osh", [
    { seq: 1, from: "Hue", to: "Atlanta", distanceKm: 938.38 },
    { seq: 2, from: "Atlanta", to: "Frankfurt", distanceKm: 11754.99 },
    { seq: 3, from: "Frankfurt", to: "Osh", distanceKm: 2273.83 },
  ]),
];

/** cities present in locations.db but with no flight service (connected_hubs is empty) */
export const NO_SERVICE: Record<string, { nearest: string; distanceKm: number }> = {
  "Abu Dhabi": { nearest: "Tirana", distanceKm: 350.9 },
  Stuttgart: { nearest: "Novi Sad", distanceKm: 175.1 },
  Austin: { nearest: "Copenhagen", distanceKm: 121.0 },
  Srinagar: { nearest: "Edmonton", distanceKm: 226.8 },
  Pokhara: { nearest: "Townsville", distanceKm: 209.0 },
};

/** names that collide after diacritic/case folding — must be disambiguated by the user */
export const AMBIGUOUS: Record<string, string[]> = {
  "san jose": ["San Jose", "San José"],
  georgetown: ["Georgetown", "George Town"],
  santiago: ["Santiago", "Santiago de Cuba", "Santiago de Compostela"],
};

export function legsToTransfers(legs: Leg[]): string[] {
  return legs.slice(0, -1).map((leg) => leg.to);
}
