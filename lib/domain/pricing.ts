/**
 * The rounding contract, in one place.
 *
 * A quote is reproducible by hand:
 *   each leg rounded to 2dp → total = sum of those rounded legs → price = round(total × 0.13, 2)
 *
 * Optimality is decided on unrounded distances (see route.ts); only presentation
 * values are rounded, so two nearly-equal candidates never flip on a rounding artefact.
 */

export const PRICE_PER_KM = 0.13;

/** Comparison slack for floating point distances (km). Far below 0.005, the display precision. */
export const EPSILON = 1e-9;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function distanceKm(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function priceFor(totalDistanceKm: number): number {
  return round2(totalDistanceKm * PRICE_PER_KM);
}
