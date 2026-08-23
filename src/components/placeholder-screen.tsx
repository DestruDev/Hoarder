import { Text, View } from 'react-native';

export function PlaceholderScreen({ name }: { name: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <Text>{name} screen</Text>
    </View>
  );
}
