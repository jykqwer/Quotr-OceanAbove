import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA } from "@/lib/db/schema";
import { getGraph } from "@/lib/domain";
import { searchTextOf } from "@/lib/store/search";
import { seedIfEmpty } from "@/lib/store/seed";

export type Db = Database.Database;

const DEFAULT_FILE = path.join(process.cwd(), "data", "app.db");

/** Opens (and migrates) the application database. Never used for locations.db. */
export function openDatabase(file: string = DEFAULT_FILE): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/**
 * `create table if not exists` cannot add columns to an existing file, so each
 * addition is applied here and backfilled once.
 */
function migrate(db: Db): void {
  addColumn(db, "conversations", "search_text", "text not null default ''");
  addColumn(db, "tickets", "total_price_usd", "real not null default 0");
  addColumn(db, "tickets", "passengers_json", "text not null default '[]'");
  addColumn(db, "tickets", "depart_at", "text not null default ''");
  addColumn(db, "ticket_legs", "journey_seq", "integer not null default 1");

  db.prepare("update tickets set passengers_json = json_array(passenger) where passengers_json = '[]'").run();
  db.prepare("update tickets set total_price_usd = price_usd where total_price_usd = 0").run();
  // Old tickets have no departure column; take the one the quote was made with.
  db.prepare(
    `update tickets set depart_at = coalesce(
       (select json_extract(q.snapshot_json, '$.departAt') from quotes q where q.id = tickets.quote_id), '')
     where depart_at = ''`,
  ).run();

  // Rows written before the search column existed have no text to match on.
  const stale = db
    .prepare("select id, title from conversations where search_text = '' limit 500")
    .all() as { id: string; title: string }[];
  for (const row of stale) {
    const bodies = db
      .prepare("select content from messages where conversation_id = ?")
      .all(row.id) as { content: string }[];
    db.prepare("update conversations set search_text = ? where id = ?").run(
      searchTextOf(row.title, bodies.map((body) => body.content)),
      row.id,
    );
  }
}

function addColumn(db: Db, table: string, column: string, definition: string): void {
  const columns = db.prepare(`pragma table_info(${table})`).all() as { name: string }[];
  if (columns.some((entry) => entry.name === column)) return;
  db.exec(`alter table ${table} add column ${column} ${definition}`);
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
