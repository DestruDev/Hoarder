import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
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
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    if (!menuOpen) {
      opacity.setValue(0);
      scale.setValue(0.94);
      translateY.setValue(-6);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [menuOpen, opacity, scale, translateY]);

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

      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        onRequestClose={closeMenu}>
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={closeMenu}
            onPressIn={closeMenu}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
          <Animated.View
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
              opacity,
              transform: [{ scale }, { translateY }],
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
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
