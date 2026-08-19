import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Additive, Food, Piece } from '../types';
import { colors, radius, space, riskStyle, verdictStyle } from '../theme';
import { additivesOf, safetyOf } from '../lib/db';
import { assessTotals, breakdownFor, safeQuantity, totalsFor } from '../lib/quantity';
import { useCart } from '../lib/cart';
import { TopBar } from '../components/TopBar';
import { intakeFootnote, IntakeVerdictBox, NutrientTable } from '../components/IntakePanel';
import { AdditiveRow } from '../components/AdditiveRow';
import { EmptyState, Section } from '../components/ui';

/**
 * The basket: everything you plan to eat, totalled up.
 *
 * The point is the combined view — individually safe items can still add up to
 * a day's worth of sodium, and only summing them shows that.
 */
export function CartScreen({
  onOpenFood,
  onBack,
}: {
  onOpenFood: (food: Food) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const cart = useCart();

  const totals = useMemo(() => totalsFor(cart.entries), [cart.entries]);
  const rows = useMemo(() => breakdownFor(totals), [totals]);
  const verdict = useMemo(
    () => assessTotals(totals, 'This basket'),
    [totals]
  );

  // Every additive of concern across the whole basket, worst first, with the
  // foods responsible — the thing you cannot see from any single item.
  const additiveSources = useMemo(() => {
    const map = new Map<string, { additive: Additive; foods: string[] }>();
    for (const e of cart.entries) {
      for (const a of additivesOf(e.food)) {
        if (a.risk === 'safe') continue;
        const hit = map.get(a.id);
        if (hit) hit.foods.push(e.food.name);
        else map.set(a.id, { additive: a, foods: [e.food.name] });
      }
    }
    return [...map.values()].sort(
      (x, y) => rank(y.additive.risk) - rank(x.additive.risk) || y.foods.length - x.foods.length
    );
  }, [cart.entries]);

  if (cart.count === 0) {
    return (
      <View style={styles.root}>
        <TopBar title="My Basket" onBack={onBack} />
        <EmptyState
          emoji="🧺"
          title="Your basket is empty"
          body="Open any food, set how much you plan to eat, and tap Add to basket. Everything you add gets totalled up here."
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar title={`My Basket (${cart.count})`} onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space(12) }]}
        showsVerticalScrollIndicator={false}
      >
        <IntakeVerdictBox intake={verdict} />

        <Section
          title="Everything in the basket"
          subtitle="Tap a row to open the food, or use − and + to change how much."
        >
          {cart.entries.map((entry) => {
            const safety = safetyOf(entry.food);
            const sv = verdictStyle[safety.verdict];
            const limit = safeQuantity(entry.food, safety.verdict).amount;
            const overLimit = entry.amount > limit;
            // Step by whole pieces where the food has them — nudging a biscuit
            // count by 25 g would land you on two and a half biscuits.
            const step =
              entry.food.piece?.amount ??
              (entry.food.serving.amount >= 100 ? 25 : entry.food.serving.amount >= 30 ? 10 : 5);

            return (
              <View key={entry.id} style={styles.itemCard}>
                <Pressable
                  style={styles.itemMain}
                  onPress={() => onOpenFood(entry.food)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${entry.food.name}`}
                >
                  <View style={[styles.itemEmoji, { backgroundColor: sv.soft }]}>
                    <Text style={styles.itemEmojiText}>{entry.food.emoji}</Text>
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {entry.food.name}
                    </Text>
                    <Text style={styles.itemAmountLine}>
                      {entry.amount} {entry.food.serving.unit}
                      {entry.food.piece
                        ? ` · ${pieceLabel(entry.amount, entry.food.piece)}`
                        : ''}
                    </Text>
                    <Text style={[styles.itemMeta, overLimit && styles.itemMetaWarn]}>
                      {overLimit
                        ? `Over the ${limit} ${entry.food.serving.unit} daily limit`
                        : `Within the ${limit} ${entry.food.serving.unit} daily limit`}
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.itemControls}>
                  <SmallButton
                    label="−"
                    onPress={() => cart.setAmount(entry.id, Math.max(0, entry.amount - step))}
                  />
                  <Text style={styles.itemAmount}>{entry.amount}</Text>
                  <SmallButton
                    label="+"
                    onPress={() => cart.setAmount(entry.id, entry.amount + step)}
                  />
                  <Pressable
                    onPress={() => cart.remove(entry.id)}
                    hitSlop={8}
                    style={styles.removeButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.food.name}`}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <Pressable
            onPress={cart.clear}
            style={({ pressed }) => [styles.clearButton, pressed && styles.clearPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.clearText}>Empty the basket</Text>
          </Pressable>
        </Section>

        <Section
          title="Combined intake"
          subtitle="Everything in the basket added together, against one adult day."
        >
          <NutrientTable rows={rows} />
          <Text style={styles.footnote}>{intakeFootnote}</Text>
        </Section>

        <Section
          title="Harmful ingredients in this basket"
          subtitle={
            additiveSources.length
              ? `${additiveSources.length} ingredient${additiveSources.length > 1 ? 's' : ''} of concern across everything you have added.`
              : 'Nothing of concern in anything you have added.'
          }
        >
          {additiveSources.length > 0 ? (
            additiveSources.map(({ additive, foods }) => (
              <View key={additive.id}>
                <View style={styles.sourceRow}>
                  <View
                    style={[styles.sourceDot, { backgroundColor: riskStyle[additive.risk].color }]}
                  />
                  <Text style={styles.sourceText}>
                    From {foods.length === 1 ? foods[0] : `${foods.length} items: ${foods.join(', ')}`}
                  </Text>
                </View>
                <AdditiveRow additive={additive} />
              </View>
            ))
          ) : (
            <View style={styles.cleanCard}>
              <Text style={styles.cleanText}>
                No additives, preservatives, colours or synthetic flavourings in anything here.
              </Text>
            </View>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

/** "≈ 3 biscuits" for a weight, so the basket stays readable in real units. */
function pieceLabel(amount: number, piece: Piece): string {
  const count = Math.round((amount / piece.amount) * 10) / 10;
  return `≈ ${count} ${count === 1 ? piece.name : piece.plural}`;
}

const rank = (r: string) => ({ safe: 0, low: 1, moderate: 2, high: 3 }[r] ?? 0);

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.smallButton, pressed && styles.smallButtonPressed]}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase amount' : 'Decrease amount'}
    >
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: space(4), paddingTop: space(2) },

  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(3),
    marginBottom: space(3),
  },
  itemMain: { flexDirection: 'row', alignItems: 'center' },
  itemEmoji: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3),
  },
  itemEmojiText: { fontSize: 22 },
  itemText: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemAmountLine: { fontSize: 12.5, color: colors.text, marginTop: 2, fontWeight: '700' },
  itemMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  itemMetaWarn: { color: '#D02B2B', fontWeight: '600' },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: space(3),
    gap: space(3),
  },
  itemAmount: { fontSize: 15, fontWeight: '800', color: colors.text, minWidth: 44, textAlign: 'center' },
  smallButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonPressed: { backgroundColor: colors.border },
  smallButtonText: { fontSize: 19, fontWeight: '700', color: colors.text, lineHeight: 22 },
  removeButton: { paddingHorizontal: space(2) },
  removeText: { fontSize: 15, color: colors.textFaint, fontWeight: '700' },

  clearButton: { alignItems: 'center', paddingVertical: space(3) },
  clearPressed: { opacity: 0.6 },
  clearText: { fontSize: 13, color: '#D02B2B', fontWeight: '700' },

  sourceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
  sourceDot: { width: 6, height: 6, borderRadius: 3, marginRight: space(2) },
  sourceText: { fontSize: 11.5, color: colors.textMuted, flex: 1, fontWeight: '600' },

  cleanCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
  },
  cleanText: { fontSize: 14, color: colors.text, lineHeight: 21 },

  footnote: { fontSize: 11, color: colors.textFaint, lineHeight: 16, marginTop: space(3) },
});
