import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type LocalDatabase = Database.Database;

export interface OpenLocalDatabaseOptions {
  busyTimeoutMs?: number;
}

export const defaultLocalDatabasePath = 'data/local-runtime.sqlite';

export function resolveLocalDatabasePath(path = process.env.LOCAL_BACKEND_SQLITE_PATH ?? defaultLocalDatabasePath): string {
  return resolve(path);
}

export function applySqlitePolicy(db: LocalDatabase, busyTimeoutMs = 5000): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma(`busy_timeout = ${busyTimeoutMs}`);
}

export function openLocalDatabase(path = process.env.LOCAL_BACKEND_SQLITE_PATH ?? ':memory:', options: OpenLocalDatabaseOptions = {}): LocalDatabase {
  if (path !== ':memory:') {
    mkdirSync(dirname(resolve(path)), { recursive: true });
  }
  const db = new Database(path);
  applySqlitePolicy(db, options.busyTimeoutMs ?? 5000);
  return db;
}
