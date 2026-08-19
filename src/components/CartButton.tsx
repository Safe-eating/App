import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { useCart } from '../lib/cart';

/** Basket icon with a live count badge. Shown in every screen header. */
export function CartButton({ onPress }: { onPress: () => void }) {
  const { count } = useCart();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open basket, ${count} item${count === 1 ? '' : 's'}`}
    >
      <Text style={styles.icon}>🧺</Text>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  icon: { fontSize: 17 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(1),
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
});
