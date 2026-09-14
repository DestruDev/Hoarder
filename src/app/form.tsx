import { Stack, useLocalSearchParams } from 'expo-router';

import { Screen, Text } from '@/components/themed';

export default function ItemFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  return (
    <Screen style={{ padding: 16, gap: 8 }}>
      <Stack.Screen options={{ title: isEditing ? 'Edit Item' : 'Add Item' }} />
      <Text>{isEditing ? `Edit item ${id}` : 'Add a new item'}</Text>
      <Text>Form fields will go here.</Text>
    </Screen>
  );
}
