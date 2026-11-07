import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ProfileAvatar } from '@/components/profile-avatar';
import { SaveButton, useSaveState } from '@/components/save-button';
import { FollowCounts } from '@/components/social';
import { useSyncRefreshControl } from '@/components/sync-refresh-control';
import { ScreenScrollView, Text, TextInput } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { getProfile, saveProfile, type Profile } from '@/lib/db';
import { getPublicProfile, type PublicProfile } from '@/lib/social';
import { useSyncVersion } from '@/lib/sync';

const emptyProfile: Profile = {
  name: null,
  description: null,
  avatarUrl: null,
};

export default function ProfileScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  // Online-only: username and follow counts live in Supabase, not SQLite.
  // The username itself is edited in Settings → Username.
  const [social, setSocial] = useState<PublicProfile | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useSaveState();

  const handle = social?.username ? `@${social.username}` : null;

  // Pull to refresh: sync (which reloads the local profile if it changed), then
  // refetch the server-only parts: handle and follower counts.
  const refreshSocial = useCallback(async () => {
    if (userId) {
      setSocial(await getPublicProfile(userId).catch(() => null));
    }
  }, [userId]);
  const refreshControl = useSyncRefreshControl(refreshSocial);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: profile.name ?? handle ?? 'Profile',
      headerLeft: undefined,
    });
  }, [navigation, profile.name, handle]);

  const syncVersion = useSyncVersion();
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getProfile()
        .then((row) => {
          if (cancelled) {
            return;
          }

          setProfile(row);
          setName(row.name ?? '');
          setDescription(row.description ?? '');
          setAvatarUrl(row.avatarUrl ?? '');
          setError(null);
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load profile');
          }
        });

      if (userId) {
        getPublicProfile(userId)
          .then((row) => {
            if (!cancelled) {
              setSocial(row);
            }
          })
          .catch(() => undefined);
      }

      return () => {
        cancelled = true;
      };
    }, [syncVersion, userId]),
  );

  async function handleSave() {
    try {
      await save.run(async () => {
        const saved = await saveProfile({ name, description, avatarUrl });
        setProfile(saved);
        setName(saved.name ?? '');
        setDescription(saved.description ?? '');
        setAvatarUrl(saved.avatarUrl ?? '');
        setError(null);
      });
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save profile');
    }
  }

  return (
    <ScreenScrollView
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      // flexGrow fills the screen so pull-to-refresh works from anywhere.
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <ProfileAvatar uri={profile.avatarUrl} size={72} />
        <View style={{ flex: 1, gap: 6 }}>
          {handle ? <Text style={{ color: colors.textMuted }}>{handle}</Text> : null}
          {profile.description ? <Text>{profile.description}</Text> : null}
          {social ? (
            <FollowCounts
              userId={social.userId}
              name={profile.name ?? handle ?? 'You'}
              followerCount={social.followerCount}
              followingCount={social.followingCount}
            />
          ) : null}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Profile name"
          autoCapitalize="words"
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Profile description (optional)"
          multiline
        />
        <TextInput
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder="Profile picture URL (optional)"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <SaveButton state={save.state} label="Save profile" onPress={handleSave} />
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      </View>
    </ScreenScrollView>
  );
}
