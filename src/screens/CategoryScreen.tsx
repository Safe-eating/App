import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Category, Food } from '../types';
import { colors, space } from '../theme';
import { foodsInCategory, safetyOf } from '../lib/db';
import { FoodCard } from '../components/FoodCard';
import { TopBar } from '../components/TopBar';
import { CartButton } from '../components/CartButton';

type Sort = 'safest' | 'riskiest' | 'name';

export function CategoryScreen({
  category,
  onOpenFood,
  onOpenCart,
  onBack,
}: {
  category: Category;
  onOpenFood: (food: Food) => void;
  onOpenCart: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<Sort>('safest');

  const items = useMemo(() => {
    const list = foodsInCategory(category.id);
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    const dir = sort === 'safest' ? -1 : 1;
    return [...list].sort((a, b) => dir * (safetyOf(b).score - safetyOf(a).score));
  }, [category.id, sort]);

  const average = useMemo(
    () =>
      items.length
        ? Math.round(items.reduce((sum, f) => sum + safetyOf(f).score, 0) / items.length)
        : 0,
    [items]
  );

  return (
    <View style={styles.root}>
      <TopBar title={category.name} onBack={onBack} right={<CartButton onPress={onOpenCart} />} />
      <FlatList
        data={items}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => <FoodCard food={item} onPress={() => onOpenFood(item)} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space(8) }]}
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { backgroundColor: category.color + '1A' }]}>
              <Text style={styles.heroEmoji}>{category.emoji}</Text>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>{category.blurb}</Text>
                <Text style={styles.heroMeta}>
                  {items.length} items · average safety score {average}/100
                </Text>
              </View>
            </View>
            <View style={styles.sortRow}>
              <SortChip label="Safest first" active={sort === 'safest'} onPress={() => setSort('safest')} />
              <SortChip label="Riskiest first" active={sort === 'riskiest'} onPress={() => setSort('riskiest')} />
              <SortChip label="A–Z" active={sort === 'name'} onPress={() => setSort('name')} />
            </View>
          </View>
        }
      />
    </View>
  );
}

function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.sortChip, active && styles.sortChipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.sortText, active && styles.sortTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: space(4), paddingTop: space(2) },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: space(4),
    marginBottom: space(4),
  },
  heroEmoji: { fontSize: 34, marginRight: space(3.5) },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  heroMeta: { fontSize: 12.5, color: colors.textMuted, marginTop: 3 },
  sortRow: { flexDirection: 'row', gap: space(2), marginBottom: space(4) },
  sortChip: {
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
  },
  sortChipActive: { backgroundColor: colors.text },
  sortText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  sortTextActive: { color: '#FFFFFF' },
});
