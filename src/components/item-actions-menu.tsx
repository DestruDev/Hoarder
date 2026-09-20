import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { deleteItem, type Item } from '@/lib/db';

export function ItemActionsMenu({
  item,
  onRemoved,
}: {
  item: Item;
  onRemoved: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function openEdit() {
    setMenuOpen(false);
    router.push({ pathname: '/edit/[id]', params: { id: String(item.id) } });
  }

  async function handleRemove() {
    if (removing) {
      return;
    }

    setRemoving(true);
    setMenuOpen(false);

    try {
      await deleteItem(item.id);
      onRemoved();
    } catch {
      setRemoving(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={openMenu}
        hitSlop={8}
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <MaterialIcons name="more-horiz" size={24} color={colors.text} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={closeMenu}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: insets.top + 44,
              right: 12,
              minWidth: 168,
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
            <Pressable onPress={openEdit} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text>Edit</Text>
            </Pressable>
            <Pressable
              onPress={handleRemove}
              disabled={removing}
              style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text style={{ color: colors.danger }}>{removing ? 'Removing…' : 'Remove'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
