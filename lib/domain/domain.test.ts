import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadNetwork } from "@/lib/db/locations";
import { buildGraph } from "@/lib/domain/graph";
import { directDestinations } from "@/lib/domain/network";
import { nearestServiced, resolveCity, suggestCities } from "@/lib/domain/resolve";
import {
  MAX_PASSENGERS,
  buildItinerary,
  defaultDeparture,
  normalizePassengers,
  resolveDeparture,
  verifyItinerary,
} from "@/lib/domain/itinerary";
import { PRICE_PER_KM, round2 } from "@/lib/domain/pricing";
import { findCityMentions } from "@/lib/domain/resolve";
import { findRoute } from "@/lib/domain/route";
import { isDirectFlight, verifyRoute } from "@/lib/domain/verify";

interface GoldenRoute {
  origin: string;
  destination: string;
  legs: { seq: number; from: string; to: string; distanceKm: number }[];
  transfers: string[];
  totalDistanceKm: number;
  priceUsd: number;
}

interface Golden {
  stats: { cities: number; hubs: number; links: number; serviced: number; unserved: number };
  hubs: string[];
  unserved: string[];
  nearest: Record<string, { city: string; distanceKm: number }>;
  routes: GoldenRoute[];
}

const golden = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/domain/__fixtures__/golden.json"), "utf8"),
) as Golden;

const network = loadNetwork();
const graph = buildGraph(network);

test("dataset facts match the fixture", () => {
  assert.deepEqual(
    {
      cities: network.stats.cities,
      hubs: network.stats.hubs,
      links: network.stats.links,
      serviced: graph.serviced.length,
      unserved: network.stats.citiesWithoutService,
    },
    golden.stats,
  );
});

test("hub list matches", () => {
  assert.deepEqual([...graph.hubs], golden.hubs);
});

test("agrees with the Python oracle on every fixture route", () => {
  for (const expected of golden.routes) {
    const actual = findRoute(graph, expected.origin, expected.destination);
    assert.ok(actual, `no route ${expected.origin} → ${expected.destination}`);
    assert.equal(actual.legs.length, expected.legs.length, `legs for ${expected.origin} → ${expected.destination}`);
    assert.deepEqual(
      actual.legs.map((leg) => [leg.from, leg.to, leg.distanceKm]),
      expected.legs.map((leg) => [leg.from, leg.to, leg.distanceKm]),
      `legs differ for ${expected.origin} → ${expected.destination}`,
    );
    assert.equal(actual.totalDistanceKm, expected.totalDistanceKm);
    assert.equal(actual.priceUsd, expected.priceUsd);
    assert.deepEqual(actual.transfers, expected.transfers);
  }
});

test("every produced route satisfies the product invariants", () => {
  for (const expected of golden.routes) {
    const route = findRoute(graph, expected.origin, expected.destination);
    assert.ok(route);
    verifyRoute(graph, route);
  }
});

test("routes only transfer at hubs and only use direct flights", () => {
  for (const expected of golden.routes.slice(0, 120)) {
    const route = findRoute(graph, expected.origin, expected.destination)!;
    for (const city of route.transfers) {
      assert.ok(graph.cities.get(city)?.isHub, `${city} is a transfer but not a hub`);
    }
    for (const leg of route.legs) {
      assert.ok(isDirectFlight(graph, leg.from, leg.to), `${leg.from} → ${leg.to} is not a direct flight`);
    }
  }
});

test("legs sum to the total and the price is distance × 0.13", () => {
  for (const expected of golden.routes) {
    const route = findRoute(graph, expected.origin, expected.destination)!;
    const summed = Math.round(route.legs.reduce((sum, leg) => sum + leg.distanceKm, 0) * 100) / 100;
    assert.equal(route.totalDistanceKm, summed);
    assert.equal(route.priceUsd, Math.round(summed * 0.13 * 100) / 100);
  }
});

test("a route and its reverse have the same distance and price", () => {
  for (const expected of golden.routes.slice(0, 80)) {
    const forward = findRoute(graph, expected.origin, expected.destination)!;
    const backward = findRoute(graph, expected.destination, expected.origin);
    if (!backward) continue;
    assert.equal(backward.totalDistanceKm, forward.totalDistanceKm);
    assert.equal(backward.priceUsd, forward.priceUsd);
  }
});

test("the engine never uses a non-hub city as a transfer", () => {
  // Full-graph shortest paths would allow this; it is the bug the hub model avoids.
  const nonHubTransfers = golden.routes.filter((route) =>
    route.transfers.some((city) => !graph.cities.get(city)?.isHub),
  );
  assert.deepEqual(nonHubTransfers, []);
});

test("cities without service return the nearest served city", () => {
  for (const city of golden.unserved) {
    const resolution = resolveCity(graph, city);
    assert.equal(resolution.status, "no_service", `${city} should report no service`);
    if (resolution.status !== "no_service") continue;
    assert.equal(resolution.nearest.city, golden.nearest[city].city);
    assert.equal(
      Math.round(resolution.nearest.distanceKm * 100) / 100,
      golden.nearest[city].distanceKm,
    );
  }
});

test("cities without service have no route", () => {
  for (const city of golden.unserved) {
    assert.equal(findRoute(graph, city, "London"), null);
    assert.equal(findRoute(graph, "London", city), null);
  }
});

test("ambiguous names return candidates instead of guessing", () => {
  const sanJose = resolveCity(graph, "San Jose");
  assert.equal(sanJose.status, "ambiguous");
  if (sanJose.status === "ambiguous") assert.deepEqual(sanJose.candidates, ["San Jose", "San José"]);

  const georgetown = resolveCity(graph, "Georgetown");
  assert.equal(georgetown.status, "ambiguous");

  const santiago = resolveCity(graph, "Santiago");
  assert.equal(santiago.status, "found");
  if (santiago.status === "found") assert.equal(santiago.city, "Santiago");

  const partial = resolveCity(graph, "Santiago de");
  assert.equal(partial.status, "ambiguous");
});

test("diacritics and case are folded", () => {
  for (const query of ["bogota", "BOGOTÁ", "Bogotá", " bogota "]) {
    const resolution = resolveCity(graph, query);
    assert.equal(resolution.status, "found", query);
    if (resolution.status === "found") assert.equal(resolution.city, "Bogotá");
  }
});

test("unknown names are not guessed", () => {
  assert.equal(resolveCity(graph, "Atlantis").status, "not_found");
  assert.equal(resolveCity(graph, "").status, "not_found");
});

test("free text keeps ambiguous mentions for the caller to resolve", () => {
  const mentions = findCityMentions(graph, "San Jose to Tokyo cheapest");
  assert.deepEqual(
    mentions.map((mention) => mention.candidates),
    [["San Jose", "San José"], ["Tokyo"]],
  );

  const long = findCityMentions(graph, "from Santiago de Cuba to Lisbon");
  assert.deepEqual(long[0].candidates, ["Santiago de Cuba"]);
});

test("same city is not a route", () => {
  assert.equal(findRoute(graph, "London", "London"), null);
});

test("passengers are trimmed, de-duplicated and bounded", () => {
  assert.deepEqual(normalizePassengers(undefined, "Ada"), ["Ada"]);
  assert.deepEqual(normalizePassengers([], "Ada"), ["Ada"]);
  assert.deepEqual(normalizePassengers(["  Ada  ", "ada", "Grace"], "Ada"), ["Ada", "Grace"]);
  assert.deepEqual(normalizePassengers("Ada，Grace、Ada", "Ada"), ["Ada", "Grace"]);
  assert.deepEqual(normalizePassengers(["", "   "], "Ada"), ["Ada"]);
  assert.equal(normalizePassengers(Array.from({ length: 9 }, (_, i) => `P${i}`), "Ada").length, MAX_PASSENGERS);
});

test("an itinerary total is the sum of journeys, priced once", () => {
  const oneWay = buildItinerary(graph, {
    journeys: [{ origin: "Chengdu", destination: "Split" }],
    passengers: ["Ada"],
  });
  assert.equal(oneWay.totalDistanceKm, 3925.76);
  assert.equal(oneWay.priceUsd, 510.35);
  assert.equal(oneWay.totalPriceUsd, 510.35);

  const roundTrip = buildItinerary(graph, {
    journeys: [
      { origin: "Chengdu", destination: "Split" },
      { origin: "Split", destination: "Chengdu" },
    ],
    passengers: ["Ada"],
  });
  assert.equal(roundTrip.journeys.length, 2);
  assert.equal(
    roundTrip.totalDistanceKm,
    Math.round((oneWay.totalDistanceKm + roundTrip.journeys[1].totalDistanceKm) * 100) / 100,
  );
  // The fare is round(total × 0.13) once, not the sum of two rounded fares.
  assert.equal(roundTrip.priceUsd, round2(roundTrip.totalDistanceKm * PRICE_PER_KM));
  verifyItinerary(graph, roundTrip);
});

test("multiple passengers multiply the fare without re-rounding it", () => {
  const solo = buildItinerary(graph, {
    journeys: [{ origin: "Chengdu", destination: "Split" }],
    passengers: ["Ada"],
  });
  const pair = buildItinerary(graph, {
    journeys: [{ origin: "Chengdu", destination: "Split" }],
    passengers: ["Ada", "Grace"],
  });

  assert.equal(pair.priceUsd, solo.priceUsd, "the per-passenger fare does not change");
  assert.equal(pair.totalPriceUsd, round2(solo.priceUsd * 2));
  verifyItinerary(graph, pair);
});

test("an itinerary rejects the trips it cannot price", () => {
  assert.throws(() => buildItinerary(graph, { journeys: [], passengers: [] }), /at least one journey/);
  assert.throws(
    () => buildItinerary(graph, { journeys: [{ origin: "London", destination: "London" }], passengers: [] }),
    /not a trip/,
  );
  assert.throws(
    () =>
      buildItinerary(graph, {
        journeys: [{ origin: "London", destination: "Nowhere City" }],
        passengers: [],
      }),
    /no route/,
  );
});

test("multi-leg trips chain: later legs only name their destination", () => {
  const chained = buildItinerary(graph, {
    journeys: [
      { origin: "Chengdu", destination: "Split" },
      { destination: "Lisbon" },
      { destination: "Ottawa" },
    ],
    passengers: ["Ada"],
  });

  assert.equal(chained.journeys.length, 3);
  assert.deepEqual(
    chained.journeys.map((journey) => `${journey.origin}->${journey.destination}`),
    ["Chengdu->Split", "Split->Lisbon", "Lisbon->Ottawa"],
  );
  verifyItinerary(graph, chained);

  // A leg that does not continue from the previous destination is refused.
  assert.throws(
    () =>
      buildItinerary(graph, {
        journeys: [
          { origin: "Chengdu", destination: "Split" },
          { origin: "Lisbon", destination: "Ottawa" },
        ],
        passengers: [],
      }),
    /does not continue from Split/,
  );

  // The verifier catches a tampered chain too.
  const tainted = {
    ...chained,
    journeys: [chained.journeys[0], { ...chained.journeys[1], origin: "Osaka" }, chained.journeys[2]],
  };
  assert.throws(() => verifyItinerary(graph, tainted), /does not continue from Split/);
});

test("verifyItinerary catches a tampered total", () => {
  const itinerary = buildItinerary(graph, {
    journeys: [{ origin: "Chengdu", destination: "Split" }],
    passengers: ["Ada", "Grace"],
  });
  verifyItinerary(graph, itinerary);

  assert.throws(
    () => verifyItinerary(graph, { ...itinerary, totalPriceUsd: 1 }),
    /order total/,
  );
  assert.throws(
    () =>
      verifyItinerary(graph, {
        ...itinerary,
        totalDistanceKm: itinerary.totalDistanceKm + 1,
      }),
    /not the sum of journeys/,
  );
});

test("a hub only flies to hubs it is actually linked to", () => {
  // Regression: the all-pairs matrix used to make every hub pair look direct.
  const unlinked: [string, string] | null = (() => {
    for (const a of graph.hubs) {
      for (const b of graph.hubs) {
        if (a === b) continue;
        if (!graph.hubLinks.get(a)?.has(b)) return [a, b];
      }
    }
    return null;
  })();
  assert.ok(unlinked, "the hub graph is not complete");
  const [a, b] = unlinked;
  assert.equal(isDirectFlight(graph, a, b), false, `${a} → ${b} is two or more hops`);

  const linked = [...(graph.hubLinks.get("New York") ?? [])][0];
  assert.ok(linked);
  assert.equal(isDirectFlight(graph, "New York", linked), true);

  // New York's direct reach is its 7 hub links plus the 26 cities attached to it.
  const newYork = directDestinations(graph, "New York");
  assert.ok(newYork);
  assert.equal(newYork.hubs.length, graph.hubLinks.get("New York")!.size);
  assert.equal(newYork.hubs.length, 7);
  assert.equal(newYork.cities.length, 33);
  assert.ok(newYork.cities.every((name) => isDirectFlight(graph, "New York", name)));
});

test("direct destinations match the one-flight rule", () => {
  // A spoke reaches exactly the hubs it lists.
  const split = directDestinations(graph, "Split");
  assert.ok(split);
  assert.equal(split.isHub, false);
  assert.deepEqual(split.cities, ["Lagos", "Shanghai"]);
  assert.deepEqual(split.hubs, split.cities);
  assert.ok(split.cities.every((name) => isDirectFlight(graph, "Split", name)));

  assert.equal(directDestinations(graph, "Nowhere City"), null);
});

test("a misspelt or unknown city suggests the closest known names", () => {
  assert.deepEqual(suggestCities(graph, "New York City").slice(0, 1), ["New York"]);
  assert.ok(suggestCities(graph, "Santiago de").slice(0, 3).includes("Santiago de Compostela"));
  assert.ok(suggestCities(graph, "xyzzy").length === 0);
  // A city we do hold a row for is never "unknown".
  assert.equal(resolveCity(graph, "New York").status, "found");
});

test("an unserved city recommends the nearest served one, with a real distance", () => {
  const abuDhabi = resolveCity(graph, "Abu Dhabi");
  assert.equal(abuDhabi.status, "no_service");
  if (abuDhabi.status !== "no_service") return;
  assert.ok(Number.isFinite(abuDhabi.nearest.distanceKm));
  assert.ok(abuDhabi.nearest.distanceKm > 0);
  // The replacement must be serviced, and must not be the city itself.
  assert.notEqual(abuDhabi.nearest.city, "Abu Dhabi");
  const replacement = graph.cities.get(abuDhabi.nearest.city)!;
  assert.ok(replacement.isHub || replacement.hubs.length > 0);
});

test("a city that is not in the dataset has no coordinates and no distance", () => {
  const unknown = resolveCity(graph, "Atlantis");
  assert.equal(unknown.status, "not_found");
  assert.equal(nearestServiced(graph, "Atlantis"), null);
});

test("a departure is required, readable and never changes the fare", () => {
  const now = Date.parse("2026-03-01T10:00:00.000Z");
  const base = { journeys: [{ origin: "Chengdu", destination: "Split" }], passengers: ["Ada"] };

  // No request → a readable default, and the money is identical either way.
  const automatic = buildItinerary(graph, base);
  assert.ok(Number.isFinite(Date.parse(automatic.departAt)));

  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const requested = buildItinerary(graph, { ...base, departAt: future });
  assert.equal(requested.departAt, future);
  assert.equal(requested.priceUsd, automatic.priceUsd, "the departure never changes the fare");

  assert.throws(() => buildItinerary(graph, { ...base, departAt: "next tuesday" }), /cannot read departure/);
  assert.throws(
    () => resolveDeparture(new Date(now - 7 * 60 * 60 * 1000).toISOString(), now),
    /departure is in the past/,
  );
  // A client in another timezone keeps six hours of slack.
  assert.ok(resolveDeparture(new Date(now - 60 * 60 * 1000).toISOString(), now));
  assert.equal(Date.parse(resolveDeparture(null, now)), Date.parse(defaultDeparture(now)));

  verifyItinerary(graph, requested);
  assert.throws(
    () => verifyItinerary(graph, { ...requested, departAt: "not a date" }),
    /no readable departure/,
  );
});
