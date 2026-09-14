import type { ItemStatus } from '@/lib/db';

export const STATUS_LABELS: Record<ItemStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
};
