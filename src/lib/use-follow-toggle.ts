import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { setFollowing, type UserSummary } from '@/lib/social';

// Optimistic follow/unfollow for a list of users. Flips the row immediately,
// reverts it if the request fails, and tracks which rows have a request in flight.
export function useFollowToggle(
  setUsers: Dispatch<SetStateAction<UserSummary[]>>,
  onError: (message: string | null) => void,
) {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const toggleFollow = useCallback(
    async (user: UserSummary) => {
      const following = !user.isFollowing;
      const setUserFollowing = (value: boolean) =>
        setUsers((rows) =>
          rows.map((row) => (row.userId === user.userId ? { ...row, isFollowing: value } : row)),
        );
      const setBusy = (busy: boolean) =>
        setBusyIds((ids) => {
          const next = new Set(ids);
          if (busy) {
            next.add(user.userId);
          } else {
            next.delete(user.userId);
          }
          return next;
        });

      setBusy(true);
      setUserFollowing(following);
      try {
        await setFollowing(user.userId, following);
        onError(null);
      } catch (followError: unknown) {
        setUserFollowing(!following);
        onError(followError instanceof Error ? followError.message : 'Failed to update follow');
      } finally {
        setBusy(false);
      }
    },
    [onError, setUsers],
  );

  return { busyIds, toggleFollow };
}
