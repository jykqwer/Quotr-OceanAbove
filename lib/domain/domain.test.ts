import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadNetwork } from "@/lib/db/locations";
import { buildGraph } from "@/lib/domain/graph";
import { findCityMentions, resolveCity } from "@/lib/domain/resolve";
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
