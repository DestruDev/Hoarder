import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  clearLibrary,
  resetAndSeed,
  resetAndSeedCatalog,
  resetAndSeedFeed,
  type SeedProgress,
} from '@/lib/db';

type DebugCommand = {
  id: string;
  title: string;
  onPress: () => void;
};

type DebugJob = {
  running: boolean;
  commandId: string | null;
  label: string;
  current: number;
  total: number;
  message: string | null;
};

let debugJob: DebugJob = {
  running: false,
  commandId: null,
  label: '',
  current: 0,
  total: 1,
  message: null,
};

const debugJobListeners = new Set<(job: DebugJob) => void>();

function emitDebugJob() {
  for (const listener of debugJobListeners) {
    listener(debugJob);
  }
}

function setDebugJob(patch: Partial<DebugJob>) {
  debugJob = { ...debugJob, ...patch };
  emitDebugJob();
}

function updateProgress(progress: SeedProgress) {
  setDebugJob({
    label: progress.label,
    current: progress.current,
    total: Math.max(1, progress.total),
  });
}

export default function DebugScreen() {
  const [job, setJob] = useState(debugJob);

  useEffect(() => {
    debugJobListeners.add(setJob);
    setJob(debugJob);
    return () => {
      debugJobListeners.delete(setJob);
    };
  }, []);

  async function runCommand(commandId: string, work: () => Promise<string>) {
    if (debugJob.running) {
      return;
    }

    setDebugJob({
      running: true,
      commandId,
      label: 'Starting…',
      current: 0,
      total: 1,
      message: null,
    });

    try {
      const message = await work();
      setDebugJob({
        running: false,
        commandId: null,
        label: '',
        current: debugJob.total,
        total: debugJob.total,
        message,
      });
    } catch (error: unknown) {
      setDebugJob({
        running: false,
        commandId: null,
        label: '',
        message: error instanceof Error ? error.message : 'Command failed.',
      });
    }
  }

  const commands: DebugCommand[] = [
    {
      id: 'clear-library',
      title: 'Clear all library entries',
      onPress: () =>
        runCommand('clear-library', async () => {
          const removed = await clearLibrary();
          return removed === 0
            ? 'Library is already empty.'
            : `Removed ${removed} library ${removed === 1 ? 'entry' : 'entries'}.`;
        }),
    },
    {
      id: 'reset-library',
      title: 'Reset & seed sample library items',
      onPress: () =>
        runCommand('reset-library', async () => {
          const seeded = await resetAndSeed(updateProgress);
          return seeded.length === 0
            ? 'No catalog titles to add. Reset & seed the catalog first.'
            : `Reset complete. Seeded ${seeded.length} library items from the catalog.`;
        }),
    },
    {
      id: 'reset-catalog',
      title: 'Replace catalog snapshot from APIs',
      onPress: () =>
        runCommand('reset-catalog', async () => {
          const seeded = await resetAndSeedCatalog(updateProgress, 1);
          updateProgress({
            label: 'Seeding feed…',
            current: debugJob.current,
            total: debugJob.total,
          });
          const feed = await resetAndSeedFeed();
          updateProgress({
            label: 'Done',
            current: debugJob.total,
            total: debugJob.total,
          });
          return `Catalog snapshot saved with ${seeded.length} titles. Feed seeded ${feed.length} updates from the catalog.`;
        }),
    },
    {
      id: 'reset-feed',
      title: 'Replace & seed feed from catalog',
      onPress: () =>
        runCommand('reset-feed', async () => {
          const seeded = await resetAndSeedFeed(updateProgress);
          return seeded.length === 0
            ? 'No catalog titles to add. Replace the catalog snapshot first.'
            : `Feed reset complete. Seeded ${seeded.length} updates from the catalog.`;
        }),
    },
  ];

  const progressPercent = Math.min(100, Math.round((job.current / Math.max(job.total, 1)) * 100));

  return (
    <ScreenScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: 'Debug' }} />
      {job.running ? (
        <View
          style={{
            backgroundColor: colors.searchBarBackground,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 14,
            gap: 10,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={colors.text} />
            <Text style={{ flex: 1 }}>{job.label}</Text>
          </View>
          <View
            style={{
              height: 8,
              backgroundColor: colors.inputBackground,
              borderRadius: 4,
              overflow: 'hidden',
            }}>
            <View
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: colors.text,
              }}
            />
          </View>
          <Text style={{ color: colors.textMuted }}>{progressPercent}%</Text>
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        {commands.map((command) => (
          <Pressable
            key={command.id}
            onPress={command.onPress}
            disabled={job.running}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 14,
              opacity: job.running ? 0.5 : 1,
            }}>
            <Text>{command.title}</Text>
          </Pressable>
        ))}
      </View>
      {!job.running && job.message ? <Text>{job.message}</Text> : null}
    </ScreenScrollView>
  );
}
