import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 16, gap: 8 }}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text>This screen does not exist.</Text>
      <Link href="/">
        <Text>Go home</Text>
      </Link>
    </View>
  );
}
