import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Category, Food } from '../types';
import { colors, space } from '../theme';
import { categories, foods, foodsInCategory, safetyOf, searchAdditives, searchFoods } from '../lib/db';
import { SearchBar } from '../components/SearchBar';
import { FoodCard } from '../components/FoodCard';
import { CategoryCard } from '../components/CategoryCard';
import { AdditiveRow } from '../components/AdditiveRow';
import { EmptyState } from '../components/ui';
import { CartButton } from '../components/CartButton';

export function HomeScreen({
  onOpenFood,
  onOpenCategory,
  onOpenCart,
}: {
  onOpenFood: (food: Food) => void;
  onOpenCategory: (category: Category) => void;
  onOpenCart: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const results = useMemo(() => (searching ? searchFoods(query) : []), [query, searching]);
  const additiveHits = useMemo(
    () => (searching ? searchAdditives(query) : []),
    [query, searching]
  );

  // The safest and the worst few, so the home screen teaches something even
  // before the user searches for anything.
  const { best, worst } = useMemo(() => {
    const ranked = [...foods].sort((a, b) => safetyOf(b).score - safetyOf(a).score);
    return { best: ranked.slice(0, 5), worst: ranked.slice(-5).reverse() };
  }, []);

  const [showing, setShowing] = useState<'best' | 'worst'>('worst');
  const highlight = showing === 'best' ? best : worst;

  // An odd number of categories leaves the last row half empty, so it gets an
  // invisible partner to render against.
  const gridData = useMemo<(Category | null)[]>(
    () => (categories.length % 2 === 1 ? [...categories, null] : [...categories]),
    []
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>SafeBite</Text>
          <CartButton onPress={onOpenCart} />
        </View>
        <Text style={styles.tagline}>
          Check any food before you eat it — what is in it, and how much is too much.
        </Text>
        <SearchBar value={query} onChange={setQuery} />
      </View>

      {searching ? (
        <FlatList
          // The browse list below renders two columns and this one renders a
          // single column. Without distinct keys React reuses the same FlatList
          // instance across the switch, and changing numColumns on a live list
          // is a hard error. The keys force a genuine unmount/remount.
          key="search-results"
          data={results}
          keyExtractor={(f) => f.id}
          renderItem={({ item }) => <FoodCard food={item} onPress={() => onOpenFood(item)} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space(8) }]}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {results.length} food{results.length === 1 ? '' : 's'} matching “{query.trim()}”
            </Text>
          }
          ListFooterComponent={
            additiveHits.length > 0 ? (
              <View style={styles.additiveBlock}>
                <Text style={styles.additiveTitle}>
                  Matching ingredients ({additiveHits.length})
                </Text>
                <Text style={styles.additiveSub}>
                  Tap any of these to read what it does in the body.
                </Text>
                {additiveHits.map((a) => (
                  <AdditiveRow key={a.id} additive={a} />
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            additiveHits.length === 0 ? (
              <EmptyState
                emoji="🔎"
                title="Nothing found"
                body={`No food or ingredient matches “${query.trim()}”. Try a simpler word like "chips", "milk" or "E621".`}
              />
            ) : null
          }
        />
      ) : (
        <FlatList
          key="category-grid"
          data={gridData}
          keyExtractor={(c, i) => c?.id ?? `spacer-${i}`}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) =>
            item ? (
              <CategoryCard
                category={item}
                count={foodsInCategory(item.id).length}
                onPress={() => onOpenCategory(item)}
              />
            ) : (
              // Keeps a lone card on the final row at half width instead of
              // letting flex:1 stretch it across the whole screen.
              <View style={styles.gridSpacer} />
            )
          }
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space(8) }]}
          ListHeaderComponent={<Text style={styles.blockTitle}>Browse by category</Text>}
          ListFooterComponent={
            <View style={styles.highlightBlock}>
              <View style={styles.toggleRow}>
                <Toggle
                  label="Worst offenders"
                  active={showing === 'worst'}
                  onPress={() => setShowing('worst')}
                />
                <Toggle
                  label="Safest picks"
                  active={showing === 'best'}
                  onPress={() => setShowing('best')}
                />
              </View>
              {highlight.map((f) => (
                <FoodCard key={f.id} food={f} onPress={() => onOpenFood(f)} />
              ))}
            </View>
          }
        />
      )}
    </View>
  );
}

function Toggle({
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
      style={[styles.toggle, active && styles.toggleActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space(4), paddingTop: space(3), paddingBottom: space(4) },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: {
    fontSize: 13.5,
    color: colors.textMuted,
    marginTop: space(1),
    marginBottom: space(4),
    lineHeight: 19,
  },
  list: { paddingHorizontal: space(4) },
  row: { gap: space(3), marginBottom: space(3) },
  gridSpacer: { flex: 1 },
  blockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: space(3),
  },
  resultCount: { fontSize: 13, color: colors.textMuted, marginBottom: space(3), fontWeight: '600' },
  highlightBlock: { marginTop: space(6) },
  toggleRow: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  toggle: {
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
  },
  toggleActive: { backgroundColor: colors.text },
  toggleText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: '#FFFFFF' },
  additiveBlock: { marginTop: space(6) },
  additiveTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  additiveSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, marginBottom: space(3) },
});
