import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ProfileAvatar } from '@/components/profile-avatar';
import { FollowCounts } from '@/components/social';
import { ScreenScrollView, Text, TextInput } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { getProfile, saveProfile, type Profile } from '@/lib/db';
import {
  getPublicProfile,
  normalizeUsername,
  saveUsername,
  USERNAME_RULES,
  type PublicProfile,
} from '@/lib/social';
import { useSyncVersion } from '@/lib/sync';

const PLACEHOLDER_NAME = 'Username';

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
  const [social, setSocial] = useState<PublicProfile | null>(null);
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: profile.name ?? PLACEHOLDER_NAME,
      headerLeft: undefined,
    });
  }, [navigation, profile.name]);

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
              setUsername(row.username ?? '');
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
      const saved = await saveProfile({ name, description, avatarUrl });
      setProfile(saved);
      setName(saved.name ?? '');
      setDescription(saved.description ?? '');
      setAvatarUrl(saved.avatarUrl ?? '');
      setError(null);

      const nextUsername = normalizeUsername(username);
      if (nextUsername && nextUsername !== social?.username) {
        const claimed = await saveUsername(nextUsername);
        setUsername(claimed);
        setSocial((current) => (current ? { ...current, username: claimed } : current));
      }
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save profile');
    }
  }

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {error ? <Text>{error}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <ProfileAvatar uri={profile.avatarUrl} size={72} />
        <View style={{ flex: 1, gap: 6 }}>
          {social?.username ? (
            <Text style={{ color: colors.textMuted }}>@{social.username}</Text>
          ) : null}
          {profile.description ? <Text>{profile.description}</Text> : null}
          {social ? (
            <FollowCounts
              userId={social.userId}
              name={profile.name ?? (social.username ? `@${social.username}` : 'You')}
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
          value={username}
          onChangeText={setUsername}
          placeholder="Username (so people can find and follow you)"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{USERNAME_RULES}</Text>
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
        <Pressable onPress={handleSave}>
          <Text>Save profile</Text>
        </Pressable>
      </View>
    </ScreenScrollView>
  );
}
