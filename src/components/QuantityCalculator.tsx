import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Food, QuantityGuidance, Verdict } from '../types';
import { colors, radius, space, verdictStyle } from '../theme';
import { assessIntake, intakeBreakdown, safeQuantity } from '../lib/quantity';
import { useCart } from '../lib/cart';
import { intakeFootnote, IntakeVerdictBox, NutrientTable } from './IntakePanel';

/**
 * Answers two questions about one food:
 *   1. How much of it is safe in a day?   (the limit card)
 *   2. If I eat THIS much, what do I take in, and is that amount harmful?
 *
 * The amount typed here is also what gets added to the basket, so the two
 * features share one number rather than asking twice.
 */
export function QuantityCalculator({
  food,
  verdict,
  onViewCart,
}: {
  food: Food;
  verdict: Verdict;
  onViewCart: () => void;
}) {
  const guidance = useMemo(() => safeQuantity(food, verdict), [food, verdict]);
  const cart = useCart();
  const piece = food.piece;

  /**
   * Two ways to say the same thing. `text` always holds whatever is in the box,
   * and `amount` is the weight in the food's own unit — so everything
   * downstream (scoring, the table, the basket) only ever deals in weight.
   */
  // Countable foods open in piece mode, because that is how people actually
  // think — "one apple", "two gulab jamun" — not "180 g".
  const [mode, setMode] = useState<'weight' | 'piece'>(piece ? 'piece' : 'weight');
  const [text, setText] = useState(
    String(piece ? Math.max(1, Math.round(food.serving.amount / piece.amount)) : food.serving.amount)
  );
  const [justAdded, setJustAdded] = useState(false);

  const typed = clampAmount(text);
  const amount = mode === 'piece' && piece ? Math.round(typed * piece.amount) : typed;

  /** Writes a weight into the box, converting to pieces first if needed. */
  const setWeight = (grams: number) => {
    const next =
      mode === 'piece' && piece ? Math.max(1, Math.round(grams / piece.amount)) : Math.round(grams);
    setText(String(next));
    setJustAdded(false);
  };

  const switchMode = (next: 'weight' | 'piece') => {
    if (next === mode || !piece) return;
    // Carry the current amount across rather than resetting the field.
    setText(
      next === 'piece'
        ? String(Math.max(1, Math.round(amount / piece.amount)))
        : String(Math.max(1, amount))
    );
    setMode(next);
    setJustAdded(false);
  };

  const rows = useMemo(() => intakeBreakdown(food, amount), [food, amount]);
  const intake = useMemo(
    () => assessIntake(food, amount, guidance.amount),
    [food, amount, guidance.amount]
  );

  const unit = food.serving.unit;
  const weightStep = food.serving.amount >= 100 ? 25 : food.serving.amount >= 30 ? 10 : 5;
  // In piece mode the buttons should move by whole pieces, not by 25 g.
  const step = mode === 'piece' && piece ? piece.amount : weightStep;
  const v = verdictStyle[verdict];

  const presets = useMemo(() => {
    const list = [
      ...(piece ? [{ label: `1 ${piece.name}`, value: piece.amount }] : []),
      ...(piece ? [{ label: `2 ${piece.plural}`, value: piece.amount * 2 }] : []),
      { label: '1 serving', value: food.serving.amount },
      { label: `100 ${unit}`, value: 100 },
      { label: 'Daily limit', value: guidance.amount },
    ];
    // Drop duplicates so "1 piece" and "1 serving" do not both show when they
    // are the same weight — which they are for an apple or a slice of bread.
    const seen = new Set<number>();
    return list.filter((p) => {
      const rounded = Math.round(p.value);
      if (rounded <= 0 || seen.has(rounded)) return false;
      seen.add(rounded);
      return true;
    });
  }, [food.serving.amount, guidance.amount, unit, piece]);

  const handleAdd = () => {
    if (amount <= 0) return;
    cart.add(food, amount);
    setJustAdded(true);
  };

  return (
    <View>
      {/* ---- the daily ceiling ---- */}
      <View style={[styles.limitCard, { backgroundColor: v.soft, borderColor: v.color + '55' }]}>
        <Text style={styles.limitLabel}>SAFE DAILY LIMIT</Text>
        <View style={styles.limitRow}>
          <Text style={[styles.limitAmount, { color: v.color }]}>
            {guidance.amount}
            <Text style={styles.limitUnit}> {guidance.unit}</Text>
          </Text>
          <Text style={styles.limitPerDay}>per day</Text>
        </View>
        <Text style={styles.limitServings}>{limitInWords(guidance, food)}</Text>
        <Text style={styles.limitReason}>{guidance.reason}</Text>
        {guidance.fromDataset && (
          <Text style={styles.limitSource}>Limit specified directly in the dataset.</Text>
        )}
      </View>

      {/* ---- the portion input ---- */}
      <Text style={styles.calcTitle}>How much are you eating?</Text>

      {/* Countable foods can be entered either way. Spinach and paneer cannot
          sensibly be counted, so they never see this toggle. */}
      {piece && (
        <View style={styles.modeRow}>
          <ModeTab
            label={`By ${unit === 'ml' ? 'volume' : 'weight'}`}
            active={mode === 'weight'}
            onPress={() => switchMode('weight')}
          />
          <ModeTab
            label={`By ${piece.name}`}
            active={mode === 'piece'}
            onPress={() => switchMode('piece')}
          />
        </View>
      )}

      <View style={styles.inputRow}>
        <StepButton
          label="−"
          onPress={() => setWeight(Math.max(1, amount - step))}
          disabled={amount <= 1}
        />
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(t) => {
              setText(t);
              setJustAdded(false);
            }}
            keyboardType="numeric"
            selectTextOnFocus
            maxLength={5}
            accessibilityLabel={
              mode === 'piece' && piece ? `Number of ${piece.plural}` : `Amount in ${unit}`
            }
          />
          <Text style={styles.inputUnit}>
            {mode === 'piece' && piece ? (typed === 1 ? piece.name : piece.plural) : unit}
          </Text>
        </View>
        <StepButton label="+" onPress={() => setWeight(amount + step)} />
      </View>

      {/* Always show the other side of the conversion, so a piece count never
          hides how much food that actually is. */}
      {piece && (
        <Text style={styles.conversion}>
          {mode === 'piece'
            ? `= ${amount} ${unit}`
            : `≈ ${round1(amount / piece.amount)} ${
                round1(amount / piece.amount) === 1 ? piece.name : piece.plural
              } (1 ${piece.name} ≈ ${piece.amount} ${unit})`}
        </Text>
      )}

      <View style={styles.presets}>
        {presets.map((p) => (
          <Pressable
            key={p.label}
            onPress={() => setWeight(p.value)}
            style={({ pressed }) => [
              styles.preset,
              Math.round(p.value) === amount && styles.presetActive,
              pressed && styles.presetPressed,
            ]}
            accessibilityRole="button"
          >
            <Text
              style={[styles.presetText, Math.round(p.value) === amount && styles.presetTextActive]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ---- is that amount harmful? ---- */}
      <View style={styles.verdictWrap}>
        <IntakeVerdictBox intake={intake} />
      </View>

      {/* ---- basket ---- */}
      <Pressable
        onPress={handleAdd}
        disabled={amount <= 0}
        style={({ pressed }) => [
          styles.addButton,
          pressed && styles.addButtonPressed,
          amount <= 0 && styles.addButtonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Add ${amount} ${unit} of ${food.name} to basket`}
      >
        <Text style={styles.addButtonText}>
          {cart.has(food.id) ? `Add another ${amount} ${unit}` : `Add ${amount} ${unit} to basket`}
        </Text>
      </Pressable>

      {justAdded && (
        <Pressable onPress={onViewCart} style={styles.addedRow} accessibilityRole="button">
          <Text style={styles.addedText}>
            Added. Basket has {cart.count} item{cart.count === 1 ? '' : 's'} —{' '}
            <Text style={styles.addedLink}>view basket</Text>
          </Text>
        </Pressable>
      )}

      {/* ---- what you actually take in ---- */}
      <Text style={styles.tableTitle}>
        What {amount} {unit} puts into your body
      </Text>
      <NutrientTable rows={rows} />
      <Text style={styles.footnote}>{intakeFootnote}</Text>
    </View>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Says the daily limit in units a person can act on.
 *
 * A derived limit is often a fraction of one piece — a gulab jamun's works out
 * at about a fifth of one. "0.2 × 1 piece (45 g)" is arithmetically correct and
 * completely useless as advice, so that case gets said in words instead.
 */
function limitInWords(guidance: QuantityGuidance, food: Food): string {
  const piece = food.piece;
  if (!piece) return `That is about ${guidance.servings} × ${food.serving.label}`;

  const count = guidance.amount / piece.amount;
  if (count < 0.85) {
    return `That is less than one ${piece.name} a day — treat it as an occasional treat rather than a daily one.`;
  }
  const rounded = round1(count);
  return `That is about ${rounded} ${rounded === 1 ? piece.name : piece.plural} a day.`;
}

function ModeTab({
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
      style={[styles.modeTab, active && styles.modeTabActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Empty or junk input reads as 0 rather than NaN. */
function clampAmount(text: string): number {
  const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.min(n, 99999);
}

function StepButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.stepButton,
        pressed && !disabled && styles.stepButtonPressed,
        disabled && styles.stepButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase amount' : 'Decrease amount'}
    >
      <Text style={styles.stepButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  limitCard: { borderRadius: radius.md, borderWidth: 1, padding: space(4) },
  limitLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.9, color: colors.textMuted },
  limitRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space(1.5) },
  limitAmount: { fontSize: 38, fontWeight: '800' },
  limitUnit: { fontSize: 19, fontWeight: '700' },
  limitPerDay: { fontSize: 13, color: colors.textMuted, marginLeft: space(2), fontWeight: '600' },
  limitServings: { fontSize: 13, color: colors.text, marginTop: space(1), fontWeight: '600' },
  limitReason: { fontSize: 13, color: colors.textMuted, marginTop: space(2), lineHeight: 19 },
  limitSource: { fontSize: 11.5, color: colors.textFaint, marginTop: space(2), fontStyle: 'italic' },

  calcTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: space(6),
    marginBottom: space(3),
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: space(3),
  },
  modeTab: {
    flex: 1,
    paddingVertical: space(2),
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  modeTabActive: { backgroundColor: colors.surface },
  modeTabText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  modeTabTextActive: { color: colors.text },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  conversion: {
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space(2),
    fontWeight: '600',
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    height: 58,
  },
  input: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    minWidth: 70,
    paddingVertical: 0,
  },
  inputUnit: { fontSize: 16, fontWeight: '700', color: colors.textMuted, marginLeft: space(1.5) },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonPressed: { backgroundColor: colors.border },
  stepButtonDisabled: { opacity: 0.4 },
  stepButtonText: { fontSize: 24, fontWeight: '700', color: colors.text, lineHeight: 28 },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  preset: {
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  presetActive: { backgroundColor: colors.text },
  presetPressed: { opacity: 0.7 },
  presetText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  presetTextActive: { color: '#FFFFFF' },

  verdictWrap: { marginTop: space(4) },

  addButton: {
    marginTop: space(4),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  addButtonPressed: { backgroundColor: colors.primaryDark },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  addedRow: { paddingVertical: space(3), alignItems: 'center' },
  addedText: { fontSize: 13, color: colors.textMuted },
  addedLink: { color: colors.primaryDark, fontWeight: '800' },

  tableTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: space(6),
    marginBottom: space(3),
  },
  footnote: { fontSize: 11, color: colors.textFaint, lineHeight: 16, marginTop: space(3) },
});
