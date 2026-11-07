import { getTableColumns, getTableName } from 'drizzle-orm';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { appSettings, items, profile, savedFilters, sqlite } from '@/lib/db';
import { onLocalWrite } from '@/lib/db/changes';
import { supabase } from '@/lib/supabase';

// Local tables mirrored to Supabase (supabase/migrations/20261105000000_sync.sql).
// Column names match on both sides except the local integer `id`, which never
// leaves the device.
const SYNC_TABLES = [
  { table: items, remote: 'items', key: 'sync_id' },
  { table: savedFilters, remote: 'saved_filters', key: 'sync_id' },
  { table: profile, remote: 'profiles', key: 'user_id' },
  { table: appSettings, remote: 'app_settings', key: 'user_id' },
] as const;

type SyncTable = (typeof SYNC_TABLES)[number];
type Row = Record<string, string | number | null>;

// Each push request is one Postgres transaction, so its rows share a
// server_updated_at. PULL_PAGE must stay above PUSH_CHUNK for paging to advance.
const PUSH_CHUNK = 500;
const PULL_PAGE = 1000;
const WRITE_DEBOUNCE_MS = 2000;

function columnsOf(table: SyncTable['table']): string[] {
  return Object.values(getTableColumns(table))
    .map((column) => column.name)
    .filter((name) => name !== 'id');
}

function cursorKey(userId: string, remote: string, kind: 'pushedAt' | 'pulledAt'): string {
  return `sync:${userId}:${remote}:${kind}`;
}

function toIso(value: string | number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

// Returns how many rows were sent.
async function push(userId: string, { table, remote, key }: SyncTable): Promise<number> {
  const columns = columnsOf(table);
  const cursor = cursorKey(userId, remote, 'pushedAt');
  const pushedAt = (await Storage.getItem(cursor)) ?? '';

  const rows = await sqlite.getAllAsync<Row>(
    `SELECT ${columns.join(', ')} FROM ${getTableName(table)}
     WHERE user_id = ? AND updated_at > ? ORDER BY updated_at`,
    [userId, pushedAt],
  );

  for (let start = 0; start < rows.length; start += PUSH_CHUNK) {
    const chunk = rows.slice(start, start + PUSH_CHUNK);
    const { error } = await supabase!.from(remote).upsert(chunk, { onConflict: key });
    if (error) {
      throw new Error(`Push to ${remote} failed: ${error.message}`);
    }

    await Storage.setItem(cursor, String(chunk[chunk.length - 1]!.updated_at));
  }

  return rows.length;
}

// Applies a remote row if it is newer than the local copy. Returns true when
// local data changed.
async function applyRemoteRow(
  userId: string,
  { table, key }: SyncTable,
  columns: string[],
  remoteRow: Row,
): Promise<boolean> {
  const localTable = getTableName(table);
  const row: Row = {
    ...remoteRow,
    updated_at: toIso(remoteRow.updated_at),
    ...('deleted_at' in remoteRow ? { deleted_at: toIso(remoteRow.deleted_at) } : {}),
  };

  const existing = await sqlite.getFirstAsync<{ id: number; updated_at: string | null }>(
    `SELECT id, updated_at FROM ${localTable} WHERE ${key} = ?`,
    [key === 'user_id' ? userId : row[key]!],
  );

  const values = columns.map((column) => row[column] ?? null);

  if (existing) {
    if (existing.updated_at && Date.parse(existing.updated_at) >= Date.parse(String(row.updated_at))) {
      return false;
    }

    await sqlite.runAsync(
      `UPDATE ${localTable} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
      [...values, existing.id],
    );
    return true;
  }

  if (row.deleted_at) {
    return false;
  }

  await sqlite.runAsync(
    `INSERT INTO ${localTable} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values,
  );
  return true;
}

async function pull(userId: string, syncTable: SyncTable): Promise<boolean> {
  const { remote, key } = syncTable;
  const columns = columnsOf(syncTable.table);
  const cursor = cursorKey(userId, remote, 'pulledAt');
  let pulledAt = (await Storage.getItem(cursor)) ?? '1970-01-01T00:00:00Z';
  let changed = false;

  for (;;) {
    // gte re-reads the boundary timestamp so a page ending mid-batch can't skip
    // the rest of that batch; re-applying a row is a no-op.
    const { data, error } = await supabase!
      .from(remote)
      .select('*')
      .eq('user_id', userId)
      .gte('server_updated_at', pulledAt)
      .order('server_updated_at')
      .order(key)
      .limit(PULL_PAGE);
    if (error) {
      throw new Error(`Pull from ${remote} failed: ${error.message}`);
    }

    const rows = data as Row[];
    for (const row of rows) {
      changed = (await applyRemoteRow(userId, syncTable, columns, row)) || changed;
    }

    if (rows.length > 0) {
      pulledAt = String(rows[rows.length - 1]!.server_updated_at);
      await Storage.setItem(cursor, pulledAt);
    }

    if (rows.length < PULL_PAGE) {
      return changed;
    }
  }
}

let syncVersion = 0;
let dataVersion = 0;
let pushVersion = 0;
const versionListeners = new Set<() => void>();

function notifyVersionListeners() {
  for (const listener of versionListeners) {
    listener();
  }
}

function bumpSyncVersion() {
  syncVersion += 1;
  dataVersion += 1;
  notifyVersionListeners();
}

onLocalWrite(() => {
  dataVersion += 1;
  notifyVersionListeners();
});

function subscribeVersions(listener: () => void) {
  versionListeners.add(listener);
  return () => {
    versionListeners.delete(listener);
  };
}

// Changes after a sync sends local edits to the server. Server-derived data,
// like the activity a trigger writes for a library change, is current from then.
export function usePushVersion(): number {
  return useSyncExternalStore(subscribeVersions, () => pushVersion);
}

// Screens add this to their load effect's deps to reload after a sync pulls changes.
export function useSyncVersion(): number {
  return useSyncExternalStore(subscribeVersions, () => syncVersion);
}

// Like useSyncVersion, but also changes on local writes. For lists that should be
// current the moment they're revealed (e.g. after editing on a pushed screen),
// load in a plain useEffect keyed on this rather than on focus.
export function useDataVersion(): number {
  return useSyncExternalStore(subscribeVersions, () => dataVersion);
}

async function runSync(userId: string): Promise<void> {
  let changed = false;
  let pushed = 0;
  for (const syncTable of SYNC_TABLES) {
    pushed += await push(userId, syncTable);
    changed = (await pull(userId, syncTable)) || changed;
  }

  if (pushed > 0) {
    pushVersion += 1;
    notifyVersionListeners();
  }

  if (changed) {
    bumpSyncVersion();
  }
}

let running: Promise<void> | null = null;
let pendingUserId: string | null = null;

// Push local changes, then pull remote ones. Failures (offline, etc.) are logged
// and retried on the next trigger; the app keeps working from local data.
// A request made mid-sync queues one more pass for the latest account.
export function syncNow(userId: string): Promise<void> {
  if (!supabase) {
    return Promise.resolve();
  }

  pendingUserId = userId;
  if (running) {
    return running;
  }

  running = (async () => {
    try {
      while (pendingUserId) {
        const nextUserId = pendingUserId;
        pendingUserId = null;
        await runSync(nextUserId);
      }
    } catch (error) {
      pendingUserId = null;
      console.warn('[Hoarder] Sync failed:', error);
    } finally {
      running = null;
    }
  })();

  return running;
}

// Syncs now, when the app returns to the foreground, and shortly after local
// writes. Returns a cleanup for sign-out.
export function startSync(userId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  void syncNow(userId);

  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void syncNow(userId);
    }
  });

  const stopWrites = onLocalWrite(() => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => void syncNow(userId), WRITE_DEBOUNCE_MS);
  });

  return () => {
    appState.remove();
    stopWrites();
    if (timer) {
      clearTimeout(timer);
    }
  };
}
