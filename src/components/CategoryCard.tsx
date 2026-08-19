import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Category } from '../types';
import { cardShadow, colors, radius, space } from '../theme';

export function CategoryCard({
  category,
  count,
  onPress,
}: {
  category: Category;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${category.name}, ${count} items`}
    >
      <View style={[styles.emojiBox, { backgroundColor: category.color + '1F' }]}>
        <Text style={styles.emoji}>{category.emoji}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {category.name}
      </Text>
      <Text style={styles.blurb} numberOfLines={2}>
        {category.blurb}
      </Text>
      <Text style={[styles.count, { color: category.color }]}>{count} items</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  pressed: { opacity: 0.65 },
  emojiBox: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(2.5),
  },
  emoji: { fontSize: 22 },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  blurb: { fontSize: 11.5, color: colors.textFaint, marginTop: 2, lineHeight: 16, minHeight: 32 },
  count: { fontSize: 11.5, fontWeight: '700', marginTop: space(1) },
});
