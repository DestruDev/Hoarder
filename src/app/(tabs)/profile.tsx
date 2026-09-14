import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { ScreenScrollView, Text, TextInput } from '@/components/themed';
import { getProfile, saveProfile, type Profile } from '@/lib/db';

const PLACEHOLDER_NAME = 'Username';

const emptyProfile: Profile = {
  name: null,
  description: null,
  avatarUrl: null,
};

export default function ProfileScreen() {
  const navigation = useNavigation();
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

      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSave() {
    try {
      const saved = await saveProfile({ name, description, avatarUrl });
      setProfile(saved);
      setName(saved.name ?? '');
      setDescription(saved.description ?? '');
      setAvatarUrl(saved.avatarUrl ?? '');
      setError(null);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save profile');
    }
  }

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {error ? <Text>{error}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <ProfileAvatar uri={profile.avatarUrl} size={72} />
        {profile.description ? <Text style={{ flex: 1 }}>{profile.description}</Text> : null}
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
        <Pressable onPress={handleSave}>
          <Text>Save profile</Text>
        </Pressable>
      </View>
    </ScreenScrollView>
  );
}
