import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';

export type SaveState = 'idle' | 'saving' | 'saved';

const SAVED_CONFIRMATION_MS = 2000;

// Tracks a save for SaveButton: 'saving' while `work` runs, then 'saved' for two
// seconds. Rethrows failures (after returning to 'idle') so the caller can show them.
export function useSaveState() {
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const run = useCallback(async (work: () => Promise<void>) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setState('saving');
    try {
      await work();
      setState('saved');
      timer.current = setTimeout(() => setState('idle'), SAVED_CONFIRMATION_MS);
    } catch (error) {
      setState('idle');
      throw error;
    }
  }, []);

  return { state, run };
}

// Full-width primary button: spinner while saving, green "Saved" checkmark after.
export function SaveButton({
  state,
  label,
  onPress,
  disabled = false,
}: {
  state: SaveState;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const text = state === 'saved' ? 'Saved' : label;
  const inactive = disabled || state === 'saving';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ busy: state === 'saving', disabled: inactive }}
      style={{
        height: 44,
        marginTop: 4,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: state === 'saved' ? colors.success : colors.accent,
        // Only dim for "nothing to save"; the green Saved state stays solid.
        opacity: state === 'saving' ? 0.7 : disabled && state === 'idle' ? 0.4 : 1,
      }}>
      {state === 'saving' ? (
        <ActivityIndicator size="small" color={colors.onAccent} />
      ) : (
        <>
          {state === 'saved' ? <Ionicons name="checkmark" size={20} color={colors.onAccent} /> : null}
          <Text style={{ color: colors.onAccent, fontWeight: '600' }}>{text}</Text>
        </>
      )}
    </Pressable>
  );
}
