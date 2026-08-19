import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Food } from '../types';
import { colors, processingLabel, radius, space, verdictStyle } from '../theme';
import { additivesOf, categoryById, safetyOf } from '../lib/db';
import { TopBar } from '../components/TopBar';
import { CartButton } from '../components/CartButton';
import { ScoreBar, ScoreDial, VerdictPill } from '../components/SafetyBadge';
import { AdditiveRow } from '../components/AdditiveRow';
import { QuantityCalculator } from '../components/QuantityCalculator';
import { Bullet, Card, Chip, Section } from '../components/ui';

export function FoodScreen({
  food,
  onOpenCart,
  onBack,
}: {
  food: Food;
  onOpenCart: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const safety = safetyOf(food);
  const v = verdictStyle[safety.verdict];
  const additives = additivesOf(food);
  const risky = additives.filter((a) => a.risk !== 'safe');
  const category = categoryById(food.categoryId);
  const n = food.nutrition;
  const per = `per 100 ${food.serving.unit}`;

  return (
    <View style={styles.root}>
      <TopBar
        title={category?.name ?? 'Food'}
        onBack={onBack}
        right={<CartButton onPress={onOpenCart} />}
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space(12) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- hero ---- */}
        <View style={styles.hero}>
          <View style={[styles.emojiBox, { backgroundColor: v.soft }]}>
            <Text style={styles.emoji}>{food.emoji}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.name}>{food.name}</Text>
            <Text style={styles.brand}>{food.brand}</Text>
            <View style={styles.heroChips}>
              <Chip label={processingLabel[food.processing] ?? food.processing} />
            </View>
          </View>
        </View>

        <Card style={{ ...styles.verdictCard, borderColor: v.color + '55' }}>
          <View style={styles.verdictTop}>
            <ScoreDial score={safety.score} verdict={safety.verdict} size={86} />
            <View style={styles.verdictText}>
              <VerdictPill verdict={safety.verdict} full />
              <Text style={styles.verdictAdvice}>{v.advice}</Text>
            </View>
          </View>
          <View style={styles.barWrap}>
            <ScoreBar score={safety.score} />
          </View>
        </Card>

        {/* ---- why ---- */}
        <Section
          title="Why this score"
          subtitle="Every food starts at 100. Here is exactly what was added and taken away."
        >
          <Card>
            {safety.factors.map((f, i) => (
              <View
                key={f.label + i}
                style={[styles.factorRow, i === safety.factors.length - 1 && styles.factorLast]}
              >
                <View style={styles.factorText}>
                  <Text style={styles.factorLabel}>{f.label}</Text>
                  <Text style={styles.factorDetail}>{f.detail}</Text>
                </View>
                <Text
                  style={[
                    styles.factorPoints,
                    { color: f.points < 0 ? '#D02B2B' : colors.primary },
                  ]}
                >
                  {f.points > 0 ? '+' : ''}
                  {f.points}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Final score</Text>
              <Text style={[styles.totalValue, { color: v.color }]}>{safety.score} / 100</Text>
            </View>
          </Card>
        </Section>

        {/* ---- ingredients ---- */}
        <Section
          title="Harmful ingredients"
          subtitle={
            risky.length > 0
              ? `${risky.length} ingredient${risky.length > 1 ? 's' : ''} of concern. Tap any one to read what it does in the body.`
              : 'Nothing of concern was found in this food.'
          }
        >
          {additives.length > 0 ? (
            additives.map((a) => <AdditiveRow key={a.id} additive={a} />)
          ) : (
            <Card>
              <Text style={styles.cleanText}>
                No additives, preservatives, colours or synthetic flavourings. This is food in its
                natural state.
              </Text>
            </Card>
          )}
        </Section>

        {/* ---- quantity ---- */}
        <Section
          title="How much is safe"
          subtitle="Type any amount to see exactly what you would take in — sugar, fat, carbs, sodium and the rest — and whether that much is harmful."
        >
          <QuantityCalculator food={food} verdict={safety.verdict} onViewCart={onOpenCart} />
        </Section>

        {/* ---- nutrition ---- */}
        <Section title="Nutrition" subtitle={`All values ${per}.`}>
          <Card>
            <NutritionRow label="Energy" value={`${n.energyKcal} kcal`} />
            <NutritionRow label="Protein" value={`${n.proteinG} g`} />
            <NutritionRow label="Carbohydrate" value={`${n.carbsG} g`} />
            <NutritionRow label="   of which sugars" value={`${n.sugarG} g`} indent />
            <NutritionRow label="Fibre" value={`${n.fibreG} g`} />
            <NutritionRow label="Fat" value={`${n.fatG} g`} />
            <NutritionRow label="   of which saturated" value={`${n.satFatG} g`} indent />
            <NutritionRow label="   of which trans" value={`${n.transFatG} g`} indent />
            <NutritionRow label="Sodium" value={`${n.sodiumMg} mg`} last />
            <View style={styles.servingNote}>
              <Text style={styles.servingNoteText}>
                One serving is {food.serving.label}.
              </Text>
            </View>
          </Card>
        </Section>

        {/* ---- good and bad ---- */}
        {food.benefits.length > 0 && (
          <Section title="What it does for you">
            <Card>
              {food.benefits.map((b) => (
                <Bullet key={b} text={b} tone="good" />
              ))}
            </Card>
          </Section>
        )}

        {food.warnings.length > 0 && (
          <Section title="What to watch out for">
            <Card>
              {food.warnings.map((w) => (
                <Bullet key={w} text={w} tone="bad" />
              ))}
            </Card>
          </Section>
        )}

        {food.allergens.length > 0 && (
          <Section title="Allergens">
            <View style={styles.chipRow}>
              {food.allergens.map((a) => (
                <Chip key={a} label={a.toUpperCase()} color="#D02B2B" soft="#FCE6E6" />
              ))}
            </View>
          </Section>
        )}

        {!!food.note && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>WORTH KNOWING</Text>
            <Text style={styles.noteText}>{food.note}</Text>
          </View>
        )}

        <Text style={styles.disclaimer}>
          SafeBite gives general nutrition guidance based on public reference intakes. It is not
          medical advice. If you are pregnant, managing a condition such as diabetes or kidney
          disease, or dealing with a diagnosed allergy, follow your doctor's guidance instead.
        </Text>
      </ScrollView>
    </View>
  );
}

function NutritionRow({
  label,
  value,
  indent,
  last,
}: {
  label: string;
  value: string;
  indent?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.nutRow, last && styles.factorLast]}>
      <Text style={[styles.nutLabel, indent && styles.nutLabelIndent]}>{label.trim()}</Text>
      <Text style={[styles.nutValue, indent && styles.nutValueIndent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: space(4), paddingTop: space(2) },

  hero: { flexDirection: 'row', alignItems: 'center', marginBottom: space(4) },
  emojiBox: {
    width: 66,
    height: 66,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3.5),
  },
  emoji: { fontSize: 34 },
  heroText: { flex: 1 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  brand: { fontSize: 13, color: colors.textFaint, marginTop: 2 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(2) },

  verdictCard: { padding: space(4) },
  verdictTop: { flexDirection: 'row', alignItems: 'center' },
  verdictText: { flex: 1, marginLeft: space(4) },
  verdictAdvice: { fontSize: 13.5, color: colors.text, lineHeight: 20, marginTop: space(2) },
  barWrap: { marginTop: space(4) },

  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space(2.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  factorLast: { borderBottomWidth: 0 },
  factorText: { flex: 1, marginRight: space(3) },
  factorLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  factorDetail: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  factorPoints: { fontSize: 15, fontWeight: '800', minWidth: 40, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(3),
    paddingTop: space(3),
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 16, fontWeight: '800' },

  cleanText: { fontSize: 14, color: colors.text, lineHeight: 21 },

  nutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nutLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  nutLabelIndent: { paddingLeft: space(4), fontWeight: '400', color: colors.textMuted },
  nutValue: { fontSize: 14, color: colors.text, fontWeight: '700' },
  nutValueIndent: { fontWeight: '500', color: colors.textMuted },
  servingNote: { marginTop: space(3) },
  servingNoteText: { fontSize: 12, color: colors.textFaint, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },

  noteBox: {
    marginTop: space(7),
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: space(4),
  },
  noteLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: colors.primaryDark,
    marginBottom: space(2),
  },
  noteText: { fontSize: 14, color: colors.text, lineHeight: 21 },

  disclaimer: {
    marginTop: space(7),
    fontSize: 11.5,
    color: colors.textFaint,
    lineHeight: 17,
    textAlign: 'center',
  },
});
