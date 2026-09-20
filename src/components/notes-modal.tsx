import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/themed';
import { colors } from '@/constants/theme';

export function NotesModal({
  visible,
  title,
  notes,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  notes: string;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(notes);
      setError(null);
    }
  }, [notes, visible]);

  async function handleSave() {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(draft.trim());
      onClose();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
          }}
        />

        <View
          style={{
            backgroundColor: colors.inputBackground,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderColor: colors.border,
            borderWidth: 1,
            borderBottomWidth: 0,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 10,
          }}>
          <Text style={{ fontSize: 18 }}>Notes</Text>
          <Text style={{ color: colors.textMuted }}>{title}</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add notes"
            multiline
            autoFocus
            style={{ minHeight: 140, textAlignVertical: 'top' }}
          />
          {error ? <Text>{error}</Text> : null}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: saving ? 0.5 : 1,
            }}>
            <Text>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
