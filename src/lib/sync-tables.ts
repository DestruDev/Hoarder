import { getTableColumns, getTableName } from 'drizzle-orm';

import { appSettings, items, profile, savedFilters } from '@/lib/db/schema';

// Local tables mirrored to Supabase (supabase/migrations/20261105000000_sync.sql).
// Column names match on both sides except the local-only bookkeeping columns.
export type SyncTableSpec = {
  local: string;
  remote: string;
  // Row identity shared across devices. One-row-per-account tables use user_id.
  key: 'sync_id' | 'user_id';
  // Columns sent to and read from the server.
  columns: string[];
};

// `id` is a per-device autoincrement; `sync_seq` is this device's upload counter.
const LOCAL_ONLY_COLUMNS = new Set(['id', 'sync_seq']);

function spec(
  table: typeof items | typeof savedFilters | typeof profile | typeof appSettings,
  remote: string,
  key: SyncTableSpec['key'],
): SyncTableSpec {
  return {
    local: getTableName(table),
    remote,
    key,
    columns: Object.values(getTableColumns(table))
      .map((column) => column.name)
      .filter((name) => !LOCAL_ONLY_COLUMNS.has(name)),
  };
}

export const SYNC_TABLES: SyncTableSpec[] = [
  spec(items, 'items', 'sync_id'),
  spec(savedFilters, 'saved_filters', 'sync_id'),
  spec(profile, 'profiles', 'user_id'),
  spec(appSettings, 'app_settings', 'user_id'),
];
