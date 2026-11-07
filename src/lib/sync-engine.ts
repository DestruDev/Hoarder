// Offline-first sync between the local SQLite database and Supabase. Design and
// trade-offs: docs/sync.md. This module has no Expo/React Native imports; its
// storage, key-value store and server are passed in, so tests can run it
// against a real SQLite database and an in-memory server.

import type { SyncTableSpec } from '@/lib/sync-tables';

type Value = string | number | null;
export type Row = Record<string, Value>;

// The subset of expo-sqlite's async API sync needs.
export interface LocalDatabase {
  getAllAsync<T>(source: string, params: Value[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: Value[]): Promise<T | null>;
  runAsync(source: string, params: Value[]): Promise<unknown>;
}

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface SyncServer {
  // Insert-or-update by `key`. The server resolves conflicts (last write wins on
  // updated_at) and stamps accepted rows with server_updated_at. Throws on failure.
  upsert(table: string, rows: Row[], key: string): Promise<void>;
  // The account's rows with server_updated_at >= since, oldest first, ties by key.
  pullPage(
    table: string,
    query: { userId: string; since: string; key: string; limit: number },
  ): Promise<Row[]>;
}

export type SyncOptions = {
  // Rows per upload request. Each request is one server transaction.
  pushChunk?: number;
  // Rows per download page. Must be larger than pushChunk: one upload's rows
  // share a server_updated_at, and paging can only advance past a timestamp
  // once a page ends on a later one.
  pullPage?: number;
  // How far before the saved cursor each pull starts again. server_updated_at
  // is a transaction's start time, so a slow upload can commit rows stamped
  // earlier than rows already pulled; re-reading this window catches them.
  // It must exceed the longest an upload transaction can run.
  pullOverlapMs?: number;
};

export type SyncResult = {
  // Rows sent to the server (including ones it skipped as not newer).
  pushed: number;
  // Whether pulling changed any local data.
  changed: boolean;
};

const EPOCH = '1970-01-01T00:00:00.000Z';

export const DEFAULT_SYNC_OPTIONS: Required<SyncOptions> = {
  pushChunk: 500,
  pullPage: 1000,
  // Supabase cancels authenticated statements after 8s, so a minute is ample.
  pullOverlapMs: 60_000,
};

export function createSyncEngine({
  local,
  kv,
  server,
  tables,
  options = {},
}: {
  local: LocalDatabase;
  kv: KeyValueStore;
  server: SyncServer;
  tables: SyncTableSpec[];
  options?: SyncOptions;
}) {
  const { pushChunk, pullPage, pullOverlapMs } = { ...DEFAULT_SYNC_OPTIONS, ...options };
  if (pullPage <= pushChunk) {
    throw new Error('pullPage must be larger than pushChunk');
  }

  const cursorKey = (userId: string, table: SyncTableSpec, kind: 'pushedSeq' | 'pulledAt') =>
    `sync:${userId}:${table.remote}:${kind}`;

  // Uploads this account's rows written since the last upload. Local writes are
  // stamped with an increasing sync_seq by SQLite triggers (migration 0031), so
  // this doesn't depend on the device clock. Returns how many rows were sent.
  async function push(userId: string, table: SyncTableSpec): Promise<number> {
    const key = cursorKey(userId, table, 'pushedSeq');
    const pushedSeq = Number((await kv.getItem(key)) ?? 0);

    const rows = await local.getAllAsync<Row & { sync_seq: number }>(
      `SELECT ${table.columns.join(', ')}, sync_seq FROM ${table.local}
       WHERE user_id = ? AND sync_seq > ? ORDER BY sync_seq`,
      [userId, pushedSeq],
    );

    for (let start = 0; start < rows.length; start += pushChunk) {
      const chunk = rows.slice(start, start + pushChunk);
      const payload = chunk.map(({ sync_seq: _seq, ...row }) => row);
      try {
        await server.upsert(table.remote, payload, table.key);
      } catch (error) {
        throw new Error(
          `Push to ${table.remote} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // sync_seq values are unique, so resuming after this one skips nothing.
      await kv.setItem(key, String(chunk[chunk.length - 1]!.sync_seq));
    }

    return rows.length;
  }

  // Applies a server row if it wins against the local copy: last write wins on
  // updated_at, and on an exact tie the server's copy wins (it kept whichever
  // write reached it first), so devices can't settle on different versions.
  // Returns true when local data changed.
  async function applyRemoteRow(userId: string, table: SyncTableSpec, remoteRow: Row): Promise<boolean> {
    const row: Row = {
      ...remoteRow,
      updated_at: toIso(remoteRow.updated_at),
      ...('deleted_at' in remoteRow ? { deleted_at: toIso(remoteRow.deleted_at) } : {}),
    };

    const existing = await local.getFirstAsync<Row & { id: number }>(
      `SELECT id, ${table.columns.join(', ')} FROM ${table.local} WHERE ${table.key} = ?`,
      [table.key === 'user_id' ? userId : row[table.key]!],
    );
    const values = table.columns.map((column) => row[column] ?? null);

    if (existing) {
      const localTime = existing.updated_at ? Date.parse(String(existing.updated_at)) : -Infinity;
      const remoteTime = Date.parse(String(row.updated_at));
      if (localTime > remoteTime) {
        return false;
      }
      if (localTime === remoteTime && table.columns.every((column, i) => sameValue(existing[column], values[i]!))) {
        return false;
      }

      // Setting sync_seq to a different non-positive value tells the triggers
      // this write came from the server: it isn't stamped, so it isn't uploaded
      // back. (Flipping between 0 and -1 guarantees the value changes.)
      await local.runAsync(
        `UPDATE ${table.local}
         SET ${table.columns.map((column) => `${column} = ?`).join(', ')},
             sync_seq = CASE WHEN sync_seq = 0 THEN -1 ELSE 0 END
         WHERE id = ?`,
        [...values, existing.id],
      );
      return true;
    }

    // A row deleted before this device ever saw it needs no local copy.
    if (row.deleted_at) {
      return false;
    }

    await local.runAsync(
      `INSERT INTO ${table.local} (${table.columns.join(', ')}, sync_seq)
       VALUES (${table.columns.map(() => '?').join(', ')}, 0)`,
      values,
    );
    return true;
  }

  // Downloads the account's rows changed on the server since the last pull.
  async function pull(userId: string, table: SyncTableSpec): Promise<boolean> {
    const key = cursorKey(userId, table, 'pulledAt');
    const saved = await kv.getItem(key);
    let cursor = saved ?? EPOCH;
    // Only the first page reaches back by the overlap; later pages continue
    // exactly from the previous page's end so paging always moves forward.
    let since = saved ? shiftIso(saved, -pullOverlapMs) : EPOCH;
    let changed = false;

    for (;;) {
      // >= re-reads the boundary timestamp so a page ending mid-batch can't skip
      // the rest of that batch; re-applying a row is a no-op.
      const rows = await server.pullPage(table.remote, { userId, since, key: table.key, limit: pullPage });
      for (const row of rows) {
        changed = (await applyRemoteRow(userId, table, row)) || changed;
      }

      if (rows.length > 0) {
        since = String(rows[rows.length - 1]!.server_updated_at);
        if (Date.parse(since) >= Date.parse(cursor)) {
          cursor = since;
          await kv.setItem(key, cursor);
        }
      }

      if (rows.length < pullPage) {
        return changed;
      }
    }
  }

  // One full pass: for each table, upload local changes, then download remote ones.
  async function runSync(userId: string): Promise<SyncResult> {
    let pushed = 0;
    let changed = false;
    for (const table of tables) {
      pushed += await push(userId, table);
      changed = (await pull(userId, table)) || changed;
    }
    return { pushed, changed };
  }

  return { runSync };
}

// Server and SQLite can spell the same value differently: numbers vs numeric
// strings, and timestamps in different ISO formats.
function sameValue(left: Value | undefined, right: Value): boolean {
  if (left == null || right == null) {
    return left == null && right == null;
  }
  if (left === right || String(left) === String(right)) {
    return true;
  }
  if (typeof left === 'number' || typeof right === 'number') {
    return Number(left) === Number(right);
  }
  const leftTime = Date.parse(left);
  return !Number.isNaN(leftTime) && leftTime === Date.parse(right);
}

function toIso(value: Value): string | null {
  return value == null ? null : new Date(value).toISOString();
}

function shiftIso(iso: string, ms: number): string {
  const shifted = Date.parse(iso) + ms;
  return Number.isNaN(shifted) || shifted < 0 ? EPOCH : new Date(shifted).toISOString();
}
