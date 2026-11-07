import { useCallback, useRef, useState } from 'react';

import { deleteActivity, getFeed, hasMoreFeed, setLiked, type FeedActivity } from '@/lib/social';

// Feed order is (createdAt, id) descending, matching get_feed's keyset.
function isOlder(activity: FeedActivity, than: FeedActivity): boolean {
  const left = Date.parse(activity.createdAt);
  const right = Date.parse(than.createdAt);
  return left < right || (left === right && activity.id < than.id);
}

type FeedQuery = {
  author?: string;
  followingOnly?: boolean;
};

// A paginated activity feed with optimistic likes. Call `refresh` from a focus
// effect or pull-to-refresh, and `loadMore` from onEndReached.
export function useActivityFeed({ author, followingOnly = false }: FeedQuery) {
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped per refresh so a slow response for an old query can't overwrite a newer one.
  const generation = useRef(0);
  // Which query the current list belongs to, so a refresh of the same query can
  // keep the older pages already scrolled through.
  const queryKey = `${author ?? ''}|${followingOnly}`;
  const loadedKey = useRef<string | null>(null);

  const refresh = useCallback(
    async (beforeLoad?: () => Promise<unknown>) => {
      const current = ++generation.current;
      setRefreshing(true);
      try {
        await beforeLoad?.().catch(() => undefined);
        const page = await getFeed({ author, followingOnly });
        if (current !== generation.current) {
          return;
        }

        const sameQuery = loadedKey.current === queryKey;
        loadedKey.current = queryKey;
        const last = page[page.length - 1];
        if (sameQuery && last && hasMoreFeed(page)) {
          // Newest page replaces the top of the list (picking up new, changed and
          // removed activity there); older pages already loaded stay below it.
          setActivities((existing) => [
            ...page,
            ...existing.filter((activity) => isOlder(activity, last)),
          ]);
        } else {
          setActivities(page);
          setHasMore(hasMoreFeed(page));
        }
        setError(null);
      } catch (loadError: unknown) {
        if (current === generation.current) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load feed');
        }
      } finally {
        if (current === generation.current) {
          setLoaded(true);
          setRefreshing(false);
        }
      }
    },
    [author, followingOnly, queryKey],
  );

  const loadMore = useCallback(async () => {
    const last = activities[activities.length - 1];
    if (!hasMore || loadingMore || refreshing || !last) {
      return;
    }

    const current = generation.current;
    setLoadingMore(true);
    try {
      const page = await getFeed({ author, followingOnly, after: last });
      if (current !== generation.current) {
        return;
      }
      setActivities((existing) => {
        const seen = new Set(existing.map((activity) => activity.id));
        return [...existing, ...page.filter((activity) => !seen.has(activity.id))];
      });
      setHasMore(hasMoreFeed(page));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [activities, author, followingOnly, hasMore, loadingMore, refreshing]);

  const toggleLike = useCallback(async (activity: FeedActivity) => {
    const liked = !activity.liked;
    const apply = (nextLiked: boolean) =>
      setActivities((existing) =>
        existing.map((entry) =>
          entry.id === activity.id && entry.liked !== nextLiked
            ? {
                ...entry,
                liked: nextLiked,
                likeCount: Math.max(0, entry.likeCount + (nextLiked ? 1 : -1)),
              }
            : entry,
        ),
      );

    apply(liked);
    try {
      await setLiked(activity.id, liked);
    } catch {
      apply(!liked);
    }
  }, []);

  // Throws on failure so the caller can show it; the entry is put back first.
  const removeActivity = useCallback(async (activity: FeedActivity) => {
    const index = activities.findIndex((entry) => entry.id === activity.id);
    setActivities((existing) => existing.filter((entry) => entry.id !== activity.id));

    try {
      await deleteActivity(activity.id);
    } catch (deleteError) {
      setActivities((existing) => {
        if (existing.some((entry) => entry.id === activity.id)) {
          return existing;
        }
        const next = [...existing];
        next.splice(index < 0 ? 0 : Math.min(index, next.length), 0, activity);
        return next;
      });
      throw deleteError;
    }
  }, [activities]);

  return {
    activities,
    loaded,
    refreshing,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    toggleLike,
    removeActivity,
  };
}
