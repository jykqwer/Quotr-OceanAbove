"""Independent reference implementation of the Ocean Above route engine.

Deliberately written with a different algorithm from lib/domain (Bellman-Ford
relaxation instead of Floyd-Warshall, explicit path enumeration instead of
reconstruction) so the two can cross-check each other. Emits golden fixtures
consumed by lib/domain/domain.test.ts.

    python scripts/oracle.py
"""

from __future__ import annotations

import json
import math
import random
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "locations.db"
OUT = ROOT / "lib" / "domain" / "__fixtures__" / "golden.json"

PRICE_PER_KM = 0.13
EPS = 1e-9


def round2(value: float) -> float:
    # Python's round() is banker's rounding; use the same half-up rule as JS.
    return math.floor(value * 100 + 0.5) / 100


def load():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    cities = {}
    for row in con.execute("select city_name, coordinate, is_hub, connected_hubs from locations"):
        x, y = row["coordinate"].split(",")
        hubs = [] if row["is_hub"] == 1 else [h.strip() for h in row["connected_hubs"].split(";") if h.strip()]
        cities[row["city_name"]] = {
            "x": float(x),
            "y": float(y),
            "is_hub": row["is_hub"] == 1,
            "hubs": hubs,
        }
    links = [tuple(r) for r in con.execute("select hub_a, hub_b from hub_links")]
    con.close()
    return cities, links


def dist(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def hub_apsp(cities, links):
    hubs = sorted(n for n, c in cities.items() if c["is_hub"])
    edges = [(a, b) for a, b in links] + [(b, a) for a, b in links]
    dist_m = {h: {g: math.inf for g in hubs} for h in hubs}
    prev = {h: {} for h in hubs}
    for h in hubs:
        dist_m[h][h] = 0.0
    for a, b in edges:
        w = dist(cities[a], cities[b])
        if w < dist_m[a][b]:
            dist_m[a][b] = w
            prev[a][b] = a

    # Bellman-Ford over each source: different relaxation strategy than Floyd-Warshall.
    for src in hubs:
        changed = True
        rounds = 0
        while changed and rounds < len(hubs) + 2:
            changed = False
            rounds += 1
            for a, b in edges:
                if dist_m[src][a] + dist(cities[a], cities[b]) < dist_m[src][b] - EPS:
                    dist_m[src][b] = dist_m[src][a] + dist(cities[a], cities[b])
                    prev[src][b] = a
                    changed = True

    def path(src, dst):
        if math.isinf(dist_m[src][dst]):
            return None
        out = [dst]
        cur = dst
        while cur != src:
            cur = prev[src].get(cur)
            if cur is None:
                return None
            out.append(cur)
        return list(reversed(out))

    return hubs, dist_m, path


def best_route(cities, hub_dist, hub_path, origin, destination):
    if origin == destination:
        return None
    a, b = cities.get(origin), cities.get(destination)
    if not a or not b:
        return None
    from_hubs = [origin] if a["is_hub"] else a["hubs"]
    to_hubs = [destination] if b["is_hub"] else b["hubs"]
    if not from_hubs or not to_hubs:
        return None

    best = None
    for ha in sorted(from_hubs):
        for hb in sorted(to_hubs):
            middle = hub_path(ha, hb)
            if middle is None:
                continue
            raw = [origin] + middle + [destination]
            seq = [c for i, c in enumerate(raw) if i == 0 or c != raw[i - 1]]
            legs = []
            exact = 0.0
            for i in range(len(seq) - 1):
                km = dist(cities[seq[i]], cities[seq[i + 1]])
                exact += km
                legs.append(
                    {"seq": i + 1, "from": seq[i], "to": seq[i + 1], "distanceKm": round2(km)}
                )
            total = round2(sum(leg["distanceKm"] for leg in legs))
            candidate = (
                exact,
                len(legs),
                [leg["from"] for leg in legs] + [seq[-1]],
                {
                    "origin": origin,
                    "destination": destination,
                    "legs": legs,
                    "transfers": [leg["to"] for leg in legs[:-1]],
                    "totalDistanceKm": total,
                    "priceUsd": round2(total * PRICE_PER_KM),
                    "exactDistanceKm": exact,
                },
            )
            if best is None:
                best = candidate
                continue
            if exact < best[0] - EPS:
                best = candidate
            elif abs(exact - best[0]) <= EPS and len(legs) < best[1]:
                best = candidate
            elif abs(exact - best[0]) <= EPS and len(legs) == best[1] and candidate[2] < best[2]:
                best = candidate
    return None if best is None else best[3]


def nearest_serviced(cities, city):
    origin = cities[city]
    best = None
    for name, candidate in cities.items():
        if name == city:
            continue
        if not (candidate["is_hub"] or candidate["hubs"]):
            continue
        km = dist(origin, candidate)
        if best is None or km < best[1] - EPS or (abs(km - best[1]) <= EPS and name < best[0]):
            best = (name, km)
    return None if best is None else {"city": best[0], "distanceKm": round2(best[1])}


def main():
    cities, links = load()
    hubs, hub_dist, hub_path = hub_apsp(cities, links)
    serviced = sorted(n for n, c in cities.items() if c["is_hub"] or c["hubs"])
    unserved = sorted(n for n, c in cities.items() if not c["is_hub"] and not c["hubs"])

    random.seed(20261027)
    pairs = set()
    for _ in range(240):
        a, b = random.sample(serviced, 2)
        pairs.add((a, b))
    for city in ["Shanghai", "Chengdu", "Guangzhou", "Toronto", "Hue", "Split", "Osh", "Lima", "London", "Tokyo"]:
        for other in ["London", "Tokyo", "Lima", "Split", "Osh", "Shanghai"]:
            if city in serviced and other in serviced and city != other:
                pairs.add((city, other))
    # Every hub pair, so the hub subgraph is covered exhaustively.
    for i, a in enumerate(hubs):
        for b in hubs[i + 1 :]:
            pairs.add((a, b))

    routes = []
    for a, b in sorted(pairs):
        route = best_route(cities, hub_dist, hub_path, a, b)
        if route:
            routes.append(route)

    fixture = {
        "generatedBy": "scripts/oracle.py",
        "stats": {
            "cities": len(cities),
            "hubs": len(hubs),
            "links": len(links),
            "serviced": len(serviced),
            "unserved": len(unserved),
        },
        "hubs": hubs,
        "unserved": unserved,
        "nearest": {name: nearest_serviced(cities, name) for name in unserved},
        "routes": routes,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(routes)} routes")
    print(f"stats: {fixture['stats']}")
    print(f"unserved: {len(unserved)} -> {unserved}")


if __name__ == "__main__":
    main()
