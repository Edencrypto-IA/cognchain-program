import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type SessionRecord<TData extends JsonObject = JsonObject> = {
  id: string;
  data: TData;
  createdAt: string;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
};

const DEFAULT_DB_PATH = path.join(process.cwd(), 'db', 'mythos-session-buffer.sqlite');

let database: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (database) return database;

  mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });
  database = new Database(DEFAULT_DB_PATH);
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
  `);
  return database;
}

function parseSessionData<TData extends JsonObject>(rawData: string): TData {
  const parsed = JSON.parse(rawData) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Session data is not a JSON object.');
  }
  return parsed as TData;
}

function mapSessionRow<TData extends JsonObject>(row: SessionRow): SessionRecord<TData> {
  return {
    id: row.id,
    data: parseSessionData<TData>(row.data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveSession<TData extends JsonObject>(id: string, data: TData): SessionRecord<TData> {
  const safeId = id.trim();
  if (!safeId) throw new Error('Session id is required.');

  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id, data, created_at, updated_at FROM sessions WHERE id = ?')
    .get(safeId) as SessionRow | undefined;
  const createdAt = existing?.created_at || now;

  db.prepare(`
    INSERT INTO sessions (id, data, created_at, updated_at)
    VALUES (@id, @data, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run({
    id: safeId,
    data: JSON.stringify(data),
    createdAt,
    updatedAt: now,
  });

  return {
    id: safeId,
    data,
    createdAt,
    updatedAt: now,
  };
}

export function getSession<TData extends JsonObject = JsonObject>(id: string): SessionRecord<TData> | null {
  const safeId = id.trim();
  if (!safeId) return null;

  const row = getDatabase()
    .prepare('SELECT id, data, created_at, updated_at FROM sessions WHERE id = ?')
    .get(safeId) as SessionRow | undefined;

  return row ? mapSessionRow<TData>(row) : null;
}

export function listSessions<TData extends JsonObject = JsonObject>(): Array<SessionRecord<TData>> {
  const rows = getDatabase()
    .prepare('SELECT id, data, created_at, updated_at FROM sessions ORDER BY updated_at DESC')
    .all() as SessionRow[];

  return rows.map(row => mapSessionRow<TData>(row));
}
