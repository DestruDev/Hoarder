import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { useColors } from '@/components/theme-colors';
import { syncNow } from '@/lib/sync';

// Pull-to-refresh for a tab's scroll view: syncs with the server, then runs
// `afterSync` for anything the screen loads straight from the server. Local data
// that the sync changed reloads by itself (screens watch the sync/data versions).
export function useSyncRefreshControl(afterSync?: () => Promise<unknown> | void) {
  const colors = useColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (userId) {
        await syncNow(userId);
      }
      await afterSync?.();
    } finally {
      setRefreshing(false);
    }
  }, [afterSync, userId]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.text}
      colors={[colors.accent]}
      progressBackgroundColor={colors.surface}
    />
  );
}
