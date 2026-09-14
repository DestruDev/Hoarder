import { Screen, Text } from '@/components/themed';

export function PlaceholderScreen({ name }: { name: string }) {
  return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <Text>{name} screen</Text>
    </Screen>
  );
}
