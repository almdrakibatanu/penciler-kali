import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export * from './schema.js';
export { schema };

export type DB = BetterSQLite3Database<typeof schema>;

let _db: DB | null = null;
let _raw: Database.Database | null = null;

function resolveDbPath(url: string): string {
  // Accept "file:./storage/data/penciler.db" or a bare path.
  const stripped = url.startsWith('file:') ? url.slice('file:'.length) : url;
  return resolve(process.cwd(), stripped);
}

export function getDb(databaseUrl = process.env.DATABASE_URL ?? 'file:./storage/data/penciler.db'): DB {
  if (_db) return _db;
  if (databaseUrl.startsWith('postgres')) {
    throw new Error(
      'Postgres driver is wired in @pk/db but not bundled in this build. ' +
      'Install drizzle-orm/node-postgres + pg, or use the SQLite default.',
    );
  }
  const path = resolveDbPath(databaseUrl);
  mkdirSync(dirname(path), { recursive: true });
  _raw = new Database(path);
  _raw.pragma('journal_mode = WAL');
  _raw.pragma('foreign_keys = ON');
  _raw.pragma('synchronous = NORMAL');
  _db = drizzle(_raw, { schema });
  return _db;
}

export function rawDb(): Database.Database {
  if (!_raw) getDb();
  return _raw!;
}

export function closeDb(): void {
  _raw?.close();
  _raw = null;
  _db = null;
}
