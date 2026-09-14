import { Link, Stack } from 'expo-router';

import { Screen, Text } from '@/components/themed';

export default function NotFoundScreen() {
  return (
    <Screen style={{ justifyContent: 'center', padding: 16, gap: 8 }}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text>This screen does not exist.</Text>
      <Link href="/">
        <Text>Go home</Text>
      </Link>
    </Screen>
  );
}
