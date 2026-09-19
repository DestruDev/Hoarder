import type { ItemStatus, ReleaseStatus } from '@/lib/db/types';

export const STATUS_LABELS: Record<ItemStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
};

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  upcoming: 'Upcoming',
  releasing: 'Releasing',
  released: 'Released',
};
