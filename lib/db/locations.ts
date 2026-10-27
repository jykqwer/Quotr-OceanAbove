import Database from "better-sqlite3";
import path from "node:path";
import type { Network, NetworkCity } from "@/lib/types";

const DB_FILE = path.join(process.cwd(), "locations.db");

interface LocationRow {
  city_name: string;
  coordinate: string;
  is_hub: number;
  connected_hubs: string;
}

interface LinkRow {
  hub_a: string;
  hub_b: string;
}

function parseCoordinate(value: string, city: string): { x: number; y: number } {
  const parts = value.split(",");
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (parts.length !== 2 || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`locations.db: bad coordinate for "${city}": ${JSON.stringify(value)}`);
  }
  return { x, y };
}

let cached: Network | null = null;

/** Reads the read-only dataset; the file is never opened for writing. */
export function loadNetwork(): Network {
  if (cached) return cached;

  const db = new Database(DB_FILE, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare("select city_name, coordinate, is_hub, connected_hubs from locations order by city_name")
      .all() as LocationRow[];
    const linkRows = db
      .prepare("select hub_a, hub_b from hub_links order by hub_a, hub_b")
      .all() as LinkRow[];

    const cities: NetworkCity[] = rows.map((row) => {
      const { x, y } = parseCoordinate(row.coordinate, row.city_name);
      return {
        name: row.city_name,
        x,
        y,
        isHub: row.is_hub === 1,
        hubs:
          row.is_hub === 1
            ? []
            : row.connected_hubs
                .split(";")
                .map((hub) => hub.trim())
                .filter(Boolean),
      };
    });

    const known = new Set(cities.map((city) => city.name));
    const links = linkRows.map((row) => {
      if (!known.has(row.hub_a) || !known.has(row.hub_b)) {
        throw new Error(`hub_links references unknown city: ${row.hub_a} → ${row.hub_b}`);
      }
      return { a: row.hub_a, b: row.hub_b };
    });

    cached = {
      cities,
      links,
      stats: {
        cities: cities.length,
        hubs: cities.filter((city) => city.isHub).length,
        links: links.length,
        citiesWithoutService: cities.filter((city) => !city.isHub && city.hubs.length === 0).length,
      },
    };
    return cached;
  } finally {
    db.close();
  }
}
