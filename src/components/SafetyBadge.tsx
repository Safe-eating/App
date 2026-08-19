import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Verdict } from '../types';
import { colors, radius, space, verdictStyle } from '../theme';

/**
 * The score dial. Drawn with a plain bordered circle rather than SVG so the
 * app keeps zero extra native dependencies — the colour carries the meaning,
 * the number carries the detail.
 */
export function ScoreDial({
  score,
  verdict,
  size = 84,
}: {
  score: number;
  verdict: Verdict;
  size?: number;
}) {
  const v = verdictStyle[verdict];
  return (
    <View
      style={[
        styles.dial,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: v.color,
          backgroundColor: v.soft,
          borderWidth: size > 60 ? 5 : 3,
        },
      ]}
    >
      <Text style={[styles.dialScore, { color: v.color, fontSize: size * 0.36 }]}>{score}</Text>
      <Text style={[styles.dialOutOf, { color: v.color, fontSize: size * 0.13 }]}>/ 100</Text>
    </View>
  );
}

export function VerdictPill({ verdict, full = false }: { verdict: Verdict; full?: boolean }) {
  const v = verdictStyle[verdict];
  return (
    <View style={[styles.pill, { backgroundColor: v.soft }]}>
      <View style={[styles.pillDot, { backgroundColor: v.color }]} />
      <Text style={[styles.pillText, { color: v.color }]}>{full ? v.label : v.short}</Text>
    </View>
  );
}

/**
 * A four-band bar showing where the score sits across avoid / limit /
 * moderate / safe, with a marker at the food's position.
 */
export function ScoreBar({ score }: { score: number }) {
  const bands: { verdict: Verdict; flex: number }[] = [
    { verdict: 'avoid', flex: 38 },
    { verdict: 'limit', flex: 22 },
    { verdict: 'moderate', flex: 20 },
    { verdict: 'safe', flex: 20 },
  ];
  return (
    <View>
      <View style={styles.barTrack}>
        {bands.map((b) => (
          <View
            key={b.verdict}
            style={{
              flex: b.flex,
              backgroundColor: verdictStyle[b.verdict].color,
              opacity: 0.28,
            }}
          />
        ))}
        <View style={[styles.barMarker, { left: `${Math.min(99, Math.max(0, score))}%` }]} />
      </View>
      <View style={styles.barLabels}>
        {bands.map((b) => (
          <Text key={b.verdict} style={[styles.barLabel, { flex: b.flex }]} numberOfLines={1}>
            {verdictStyle[b.verdict].short}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dial: { alignItems: 'center', justifyContent: 'center' },
  dialScore: { fontWeight: '800', lineHeight: undefined },
  dialOutOf: { fontWeight: '700', opacity: 0.75, marginTop: -2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, marginRight: space(2) },
  pillText: { fontSize: 12.5, fontWeight: '700' },
  barTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  barMarker: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.text,
    marginLeft: -2,
  },
  barLabels: { flexDirection: 'row', marginTop: space(1.5) },
  barLabel: { fontSize: 10, color: colors.textFaint, textAlign: 'center', fontWeight: '600' },
});
