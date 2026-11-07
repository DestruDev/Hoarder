// Test doubles for the sync engine: a device (real SQLite with the app's real
// migrations, plus an in-memory key-value store) and an in-memory server that
// follows the same rules as supabase/migrations/20261105000001_sync_skip_echo.sql.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import {
  createSyncEngine,
  type KeyValueStore,
  type LocalDatabase,
  type Row,
  type SyncOptions,
  type SyncResult,
  type SyncServer,
} from '@/lib/sync-engine';
import { SYNC_TABLES } from '@/lib/sync-tables';

type Value = string | number | null;

const DRIZZLE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');
const START = Date.parse('2026-01-01T00:00:00.000Z');

// Builds the schema the app ships with by running every local migration in order.
function migratedDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  for (const { tag } of journal.entries) {
    const sql = readFileSync(join(DRIZZLE_DIR, `${tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) {
        db.exec(statement);
      }
    }
  }
  return db;
}

class NodeSqlite implements LocalDatabase {
  constructor(readonly db: DatabaseSync) {}

  async getAllAsync<T>(source: string, params: Value[]): Promise<T[]> {
    return this.db.prepare(source).all(...params) as T[];
  }

  async getFirstAsync<T>(source: string, params: Value[]): Promise<T | null> {
    return (this.db.prepare(source).get(...params) as T | undefined) ?? null;
  }

  async runAsync(source: string, params: Value[]): Promise<unknown> {
    return this.db.prepare(source).run(...params);
  }
}

class MemoryKeyValue implements KeyValueStore {
  readonly values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

// Postgres timestamptz as PostgREST returns it: microseconds, +00:00 offset.
function postgresTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace('Z', '000+00:00');
}

// The Supabase side of sync. Like the real trigger: an upsert carrying an
// updated_at that isn't newer than the stored row is skipped, and accepted rows
// are stamped with the transaction's start time as server_updated_at.
export class FakeServer implements SyncServer {
  readonly tables = new Map<string, Map<string, Row>>();
  private clock = START;
  private failures: string[] = [];
  upserts = 0;

  // Makes the next upload (or the nth from now) fail, like a dropped connection.
  failUpload(afterSuccessfulUploads = 0, message = 'network error') {
    this.failures[afterSuccessfulUploads] = message;
  }

  async upsert(table: string, rows: Row[], key: string): Promise<void> {
    const failure = this.failures.shift();
    if (failure) {
      throw new Error(failure);
    }
    this.upserts += 1;
    this.commit(table, rows, key, this.tick());
  }

  // Commits rows stamped with an explicit server time: a transaction that began
  // at `startedAt` but only became visible now.
  commit(table: string, rows: Row[], key: string, startedAt: number) {
    const spec = SYNC_TABLES.find((candidate) => candidate.remote === table)!;
    const stored = this.table(table);
    for (const row of rows) {
      for (const column of Object.keys(row)) {
        if (!spec.columns.includes(column)) {
          throw new Error(`column "${column}" of relation "${table}" does not exist`);
        }
      }
      const existing = stored.get(String(row[key]));
      if (existing && Date.parse(String(row.updated_at)) <= Date.parse(String(existing.updated_at))) {
        continue;
      }
      stored.set(String(row[key]), {
        ...row,
        updated_at: postgresTimestamp(Date.parse(String(row.updated_at))),
        ...(row.deleted_at ? { deleted_at: postgresTimestamp(Date.parse(String(row.deleted_at))) } : {}),
        server_updated_at: postgresTimestamp(startedAt),
      });
    }
  }

  async pullPage(
    table: string,
    { userId, since, key, limit }: { userId: string; since: string; key: string; limit: number },
  ): Promise<Row[]> {
    const from = Date.parse(since);
    return [...this.table(table).values()]
      .filter((row) => row.user_id === userId && Date.parse(String(row.server_updated_at)) >= from)
      .sort(
        (left, right) =>
          Date.parse(String(left.server_updated_at)) - Date.parse(String(right.server_updated_at)) ||
          String(left[key]).localeCompare(String(right[key])),
      )
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  now(): number {
    return this.clock;
  }

  // Server time moves forward a little with every transaction.
  tick(ms = 10): number {
    const startedAt = this.clock;
    this.clock += ms;
    return startedAt;
  }

  row(table: string, key: string): Row | undefined {
    return this.table(table).get(key);
  }

  private table(name: string): Map<string, Row> {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }
}

let nextItemId = 0;

// One install of the app: its own SQLite database, key-value store and clock.
export class Device {
  readonly sqlite = new NodeSqlite(migratedDatabase());
  readonly kv = new MemoryKeyValue();
  // Device wall clock in ms; tests move it freely, including backwards.
  clock = START;
  private readonly engine;

  constructor(server: SyncServer, options?: SyncOptions) {
    this.engine = createSyncEngine({ local: this.sqlite, kv: this.kv, server, tables: SYNC_TABLES, options });
  }

  sync(userId: string): Promise<SyncResult> {
    return this.engine.runSync(userId);
  }

  // Like the app's stores: every write stamps updated_at from the device clock.
  private stamp(advance: number): string {
    this.clock += advance;
    return new Date(this.clock).toISOString();
  }

  addItem(userId: string, fields: Partial<{ title: string; status: string }> = {}, advance = 1000): string {
    const syncId = `00000000-0000-4000-8000-${String(++nextItemId).padStart(12, '0')}`;
    const now = this.stamp(advance);
    this.sqlite.db
      .prepare(
        `INSERT INTO items (user_id, sync_id, title, media_type, status, date_added, updated_at)
         VALUES (?, ?, ?, 'anime', ?, ?, ?)`,
      )
      .run(userId, syncId, fields.title ?? `Item ${nextItemId}`, fields.status ?? 'planning', now, now);
    return syncId;
  }

  editItem(syncId: string, fields: Partial<{ title: string; status: string }>, advance = 1000) {
    const now = this.stamp(advance);
    const sets = Object.keys(fields).map((column) => `${column} = ?`);
    this.sqlite.db
      .prepare(`UPDATE items SET ${[...sets, 'updated_at = ?'].join(', ')} WHERE sync_id = ?`)
      .run(...(Object.values(fields) as string[]), now, syncId);
  }

  deleteItem(syncId: string, advance = 1000) {
    const now = this.stamp(advance);
    this.sqlite.db
      .prepare('UPDATE items SET deleted_at = ?, updated_at = ? WHERE sync_id = ?')
      .run(now, now, syncId);
  }

  setProfileName(userId: string, name: string, advance = 1000) {
    const now = this.stamp(advance);
    this.sqlite.db
      .prepare(
        `INSERT INTO profile (user_id, name, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
      )
      .run(userId, name, now);
  }

  item(syncId: string): Record<string, Value> | undefined {
    return this.sqlite.db.prepare('SELECT * FROM items WHERE sync_id = ?').get(syncId) as
      | Record<string, Value>
      | undefined;
  }

  profileName(userId: string): Value | undefined {
    const row = this.sqlite.db.prepare('SELECT name FROM profile WHERE user_id = ?').get(userId) as
      | { name: Value }
      | undefined;
    return row?.name;
  }

  // The account's live (not deleted) items as comparable plain data: local-only
  // columns dropped, timestamps normalized, sorted by sync_id. Deleted rows are
  // left out because a device never stores a deletion for an item it never saw.
  snapshot(userId: string): Record<string, Value>[] {
    const columns = SYNC_TABLES[0]!.columns;
    const rows = this.sqlite.db
      .prepare(
        `SELECT ${columns.join(', ')} FROM items
         WHERE user_id = ? AND deleted_at IS NULL ORDER BY sync_id`,
      )
      .all(userId) as Record<string, Value>[];
    return rows.map(normalize);
  }
}

// Same shape as Device.snapshot (live items only), from the server's copy.
export function serverSnapshot(server: FakeServer, userId: string): Record<string, Value>[] {
  const columns = SYNC_TABLES[0]!.columns;
  return [...(server.tables.get('items')?.values() ?? [])]
    .filter((row) => row.user_id === userId && row.deleted_at == null)
    .map((row) => normalize(Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))))
    .sort((left, right) => String(left.sync_id).localeCompare(String(right.sync_id)));
}

function normalize(row: Record<string, Value>): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [
      column,
      (column === 'updated_at' || column === 'deleted_at') && value != null
        ? new Date(String(value)).toISOString()
        : value,
    ]),
  );
}
