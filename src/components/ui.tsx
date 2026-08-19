import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { cardShadow, colors, radius, space } from '../theme';

/** Small rounded label. Used for allergens, effects and processing level. */
export function Chip({
  label,
  color = colors.textMuted,
  soft = colors.surfaceAlt,
}: {
  label: string;
  color?: string;
  soft?: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: soft }]}>
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A titled block with optional subtitle, used down the detail screen. */
export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

/** A bulleted line. `tone` colours the dot for good news versus bad. */
export function Bullet({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const dotColor =
    tone === 'good' ? colors.primary : tone === 'bad' ? '#D02B2B' : colors.textFaint;
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: dotColor }]} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space(2.5),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
    marginRight: space(2),
    marginBottom: space(2),
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space(4),
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  section: { marginTop: space(7) },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: space(1),
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: space(3),
    lineHeight: 19,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space(2.5) },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: space(3),
  },
  bulletText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 21 },
  empty: { alignItems: 'center', paddingVertical: space(14), paddingHorizontal: space(8) },
  emptyEmoji: { fontSize: 44, marginBottom: space(3) },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: space(2) },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
