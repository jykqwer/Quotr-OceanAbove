import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA } from "@/lib/db/schema";
import { getGraph } from "@/lib/domain";
import { seedIfEmpty } from "@/lib/store/seed";

export type Db = Database.Database;

const DEFAULT_FILE = path.join(process.cwd(), "data", "app.db");

/** Opens (and migrates) the application database. Never used for locations.db. */
export function openDatabase(file: string = DEFAULT_FILE): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

const globalStore = globalThis as unknown as { __quotrDb?: Db };

export function getDb(): Db {
  if (!globalStore.__quotrDb) {
    const db = openDatabase();
    // Seeds the demo account the first time the file is created.
    seedIfEmpty(db, getGraph());
    globalStore.__quotrDb = db;
  }
  return globalStore.__quotrDb;
}
