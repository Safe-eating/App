import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Food } from '../types';
import { cardShadow, colors, radius, space, verdictStyle } from '../theme';
import { riskyAdditiveCount, safetyOf } from '../lib/db';
import { ScoreDial } from './SafetyBadge';

/** One food in a list. Shows the verdict at a glance without needing a tap. */
export function FoodCard({ food, onPress }: { food: Food; onPress: () => void }) {
  const safety = safetyOf(food);
  const v = verdictStyle[safety.verdict];
  const risky = riskyAdditiveCount(food);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, safety score ${safety.score} out of 100, ${v.label}`}
    >
      <View style={[styles.emojiBox, { backgroundColor: v.soft }]}>
        <Text style={styles.emoji}>{food.emoji}</Text>
      </View>

      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.brand} numberOfLines={1}>
          {food.brand}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.verdictText, { color: v.color }]}>{v.label}</Text>
          {risky > 0 && (
            <Text style={styles.additiveText}>
              {'  ·  '}
              {risky} additive{risky > 1 ? 's' : ''} of concern
            </Text>
          )}
        </View>
      </View>

      <ScoreDial score={safety.score} verdict={safety.verdict} size={48} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space(3),
    marginBottom: space(3),
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  pressed: { opacity: 0.65 },
  emojiBox: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3),
  },
  emoji: { fontSize: 26 },
  middle: { flex: 1, marginRight: space(2) },
  name: { fontSize: 15.5, fontWeight: '700', color: colors.text },
  brand: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(1.5) },
  verdictText: { fontSize: 12, fontWeight: '700' },
  additiveText: { fontSize: 11.5, color: colors.textMuted },
});
