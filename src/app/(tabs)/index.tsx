import { ScrollView, Text, View } from 'react-native';

const PLACEHOLDER_NOTIFICATIONS = [
  {
    id: '1',
    title: 'New episode available',
    body: 'Frieren: Beyond Journey’s End — Episode 28 is out.',
  },
  {
    id: '2',
    title: 'New chapter available',
    body: 'One Piece — Chapter 1128 is out.',
  },
  {
    id: '3',
    title: 'Release reminder',
    body: 'Dune: Part Three has a new trailer.',
  },
  {
    id: '4',
    title: 'Game update',
    body: 'Hades II left early access.',
  },
  {
    id: '5',
    title: 'Book update',
    body: 'The next Stormlight Archive novel has a release date.',
  },
];

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text>Updates</Text>
      {PLACEHOLDER_NOTIFICATIONS.map((notification) => (
        <View key={notification.id}>
          <Text>{notification.title}</Text>
          <Text>{notification.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
