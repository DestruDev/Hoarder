import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { sqlite } from '@/lib/db';
import { onLocalWrite } from '@/lib/db/changes';
import { createSyncEngine, type Row, type SyncServer } from '@/lib/sync-engine';
import { SYNC_TABLES } from '@/lib/sync-tables';
import { supabase } from '@/lib/supabase';

// App wiring for the sync engine (src/lib/sync-engine.ts, design in docs/sync.md):
// Supabase as the server, the app's SQLite database and key-value store, and
// when to run (on sign-in, on returning to the foreground, shortly after edits).

const WRITE_DEBOUNCE_MS = 2000;

const supabaseServer: SyncServer = {
  async upsert(table, rows, key) {
    const { error } = await supabase!.from(table).upsert(rows, { onConflict: key });
    if (error) {
      throw new Error(error.message);
    }
  },
  async pullPage(table, { userId, since, key, limit }) {
    const { data, error } = await supabase!
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .gte('server_updated_at', since)
      .order('server_updated_at')
      .order(key)
      .limit(limit);
    if (error) {
      throw new Error(`Pull from ${table} failed: ${error.message}`);
    }
    return data as Row[];
  },
};

const engine = createSyncEngine({
  local: sqlite,
  kv: Storage,
  server: supabaseServer,
  tables: SYNC_TABLES,
});

let syncVersion = 0;
let dataVersion = 0;
let pushVersion = 0;
const versionListeners = new Set<() => void>();

function notifyVersionListeners() {
  for (const listener of versionListeners) {
    listener();
  }
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
  const { pushed, changed } = await engine.runSync(userId);

  if (pushed > 0) {
    pushVersion += 1;
  }
  if (changed) {
    syncVersion += 1;
    dataVersion += 1;
  }
  if (pushed > 0 || changed) {
    notifyVersionListeners();
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
