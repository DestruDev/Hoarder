import { useEffect, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { SaveButton, useSaveState } from '@/components/save-button';
import { ScreenScrollView, Text, TextInput } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import {
  getPublicProfile,
  normalizeUsername,
  saveUsername,
  setAccountPrivate,
  USERNAME_RULES,
} from '@/lib/social';

// Settings → Account: username and privacy.
// Accounts start with a random handle (user_xxxxxxxx) and pick their own here.
export default function AccountScreen() {
  const colors = useColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveState();
  const [isPrivate, setIsPrivate] = useState(true);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;
    getPublicProfile(userId)
      .then((profile) => {
        if (!cancelled) {
          setCurrent(profile.username);
          setDraft(profile.username ?? '');
          setIsPrivate(profile.isPrivate);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load username');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const normalized = normalizeUsername(draft);
  const unchanged = normalized === (current ?? '');

  async function handleSave() {
    try {
      await save.run(async () => {
        const claimed = await saveUsername(draft);
        setCurrent(claimed);
        setDraft(claimed);
        setError(null);
      });
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save username');
    }
  }

  // Saves as soon as it's flipped; flips back if the save fails.
  async function handlePrivacyChange(next: boolean) {
    setIsPrivate(next);
    setPrivacyBusy(true);
    setPrivacyError(null);
    try {
      await setAccountPrivate(next);
    } catch (privacyFailure: unknown) {
      setIsPrivate(!next);
      setPrivacyError(privacyFailure instanceof Error ? privacyFailure.message : 'Failed to update privacy');
    } finally {
      setPrivacyBusy(false);
    }
  }

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <ScreenScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600' }}>
        Username
      </Text>
      <Text style={{ color: colors.textMuted }}>
        Your username is how people find and follow you{current ? `. It's currently @${current}.` : '.'}
      </Text>
      <View style={{ justifyContent: 'center', marginTop: 8 }}>
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setError(null);
          }}
          placeholder="username"
          accessibilityLabel="Username"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (!unchanged) {
              void handleSave();
            }
          }}
          style={{ paddingLeft: 26, fontSize: 16, borderRadius: 10 }}
        />
        {/* After the input so it draws on top of the input's background. */}
        <Text
          pointerEvents="none"
          style={{ position: 'absolute', left: 10, color: colors.textMuted, fontSize: 16 }}
          accessibilityElementsHidden
          importantForAccessibility="no">
          @
        </Text>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{USERNAME_RULES}</Text>
      <SaveButton state={save.state} label="Save username" onPress={handleSave} disabled={unchanged} />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', marginTop: 24 }}>
        Privacy
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}>
        <Text style={{ flex: 1 }}>Private account</Text>
        <Switch
          value={isPrivate}
          onValueChange={handlePrivacyChange}
          disabled={privacyBusy}
          accessibilityLabel="Private account"
          trackColor={{ false: colors.border, true: colors.accent }}
          ios_backgroundColor={colors.border}
        />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {isPrivate
          ? 'Only people who follow you can see your activity.'
          : 'Anyone signed in can see your activity on your profile, without following you.'}
      </Text>
      {privacyError ? <Text style={{ color: colors.danger }}>{privacyError}</Text> : null}
    </ScreenScrollView>
  );
}
