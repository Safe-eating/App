import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Verdict } from '../types';
import { colors, radius, space, verdictStyle } from '../theme';
import { IntakeLevel, IntakeVerdict, NutrientRow } from '../lib/quantity';

/**
 * The two pieces of "what did I just eat" UI, shared by the food screen's
 * portion calculator and the cart's basket total so both stay identical.
 */

/** Each intake level borrows the palette of the food verdict it corresponds to. */
export const LEVEL_VERDICT: Record<IntakeLevel, Verdict> = {
  fine: 'safe',
  watch: 'moderate',
  over: 'limit',
  harmful: 'avoid',
};

export function IntakeVerdictBox({ intake }: { intake: IntakeVerdict }) {
  const v = verdictStyle[LEVEL_VERDICT[intake.level]];
  return (
    <View style={[styles.box, { backgroundColor: v.soft, borderColor: v.color + '55' }]}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: v.color }]} />
        <Text style={[styles.title, { color: v.color }]}>{intake.title}</Text>
      </View>
      <Text style={styles.detail}>{intake.detail}</Text>
      {intake.flags.length > 0 && (
        <View style={styles.flagRow}>
          {intake.flags.map((f) => (
            <View key={f} style={[styles.flag, { borderColor: v.color + '66' }]}>
              <Text style={[styles.flagText, { color: v.color }]}>{f}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function NutrientTable({ rows }: { rows: NutrientRow[] }) {
  return (
    <View style={styles.table}>
      {rows.map((row, i) => (
        <View key={row.key} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowLabel, row.indent && styles.rowLabelIndent]}>{row.label}</Text>
            <View style={styles.rowValues}>
              <Text style={[styles.rowAmount, row.indent && styles.rowAmountIndent]}>
                {row.display}
              </Text>
              <Text style={[styles.rowPercent, { color: percentColor(row.percent, row.kind) }]}>
                {row.percent}%
              </Text>
            </View>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, row.percent)}%`,
                  backgroundColor: percentColor(row.percent, row.kind),
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Green when a target is met, escalating red as a ceiling is approached. */
export function percentColor(percent: number, kind: 'limit' | 'target' | 'neutral'): string {
  // Natural sugars are reported but not judged, so they stay grey rather than
  // contradicting a verdict that has already discounted them.
  if (kind === 'neutral') return colors.textFaint;
  if (kind === 'target') return percent >= 25 ? colors.primary : colors.textFaint;
  if (percent >= 100) return '#D02B2B';
  if (percent >= 50) return '#E4670B';
  if (percent >= 25) return '#D9930B';
  return colors.primary;
}

export const intakeFootnote =
  'Percentages are against an average adult day: 2000 kcal, 50 g protein, 260 g carbs, 25 g added sugar, 30 g fibre, 70 g fat, 20 g saturated fat, 2 g trans fat and 2000 mg sodium. Protein and fibre are targets to reach, so a high percentage there is a good thing. Only added sugar counts toward the sugar cap — the sugar in whole fruit and plain milk does not.';

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: 1, padding: space(4) },
  head: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: space(2.5) },
  title: { fontSize: 16, fontWeight: '800', flex: 1 },
  detail: { fontSize: 13.5, color: colors.text, lineHeight: 20, marginTop: space(2) },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  flag: {
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  flagText: { fontSize: 11, fontWeight: '700' },

  table: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space(4),
    paddingTop: space(3),
  },
  row: {
    paddingBottom: space(3),
    marginBottom: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(1.5) },
  rowLabel: { fontSize: 13.5, color: colors.text, fontWeight: '700', flex: 1 },
  rowLabelIndent: { paddingLeft: space(3), fontWeight: '500', color: colors.textMuted },
  rowValues: { flexDirection: 'row', alignItems: 'baseline' },
  rowAmount: { fontSize: 13.5, color: colors.text, fontWeight: '700' },
  rowAmountIndent: { fontWeight: '600', color: colors.textMuted },
  rowPercent: { fontSize: 12, fontWeight: '800', minWidth: 46, textAlign: 'right' },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
