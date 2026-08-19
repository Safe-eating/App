import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Additive } from '../types';
import { colors, radius, riskStyle, space } from '../theme';
import { Chip } from './ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * One harmful-ingredient entry. Collapsed it shows the name, code and risk
 * level; tapping expands the full explanation, effects and daily limit.
 */
export function AdditiveRow({ additive, startOpen = false }: { additive: Additive; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const r = riskStyle[additive.risk];

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={[styles.card, { borderLeftColor: r.color }]}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${additive.name}, ${r.label}`}
      >
        <View style={styles.headerText}>
          <Text style={styles.name}>{additive.name}</Text>
          <Text style={styles.sub}>
            {additive.code ? `${additive.code}  ·  ` : ''}
            {additive.class}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.riskPill, { backgroundColor: r.soft }]}>
            <Text style={[styles.riskText, { color: r.color }]}>{r.label}</Text>
          </View>
          <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
        </View>
      </Pressable>

      {open && (
        <View style={styles.body}>
          <Text style={styles.label}>What it is</Text>
          <Text style={styles.para}>{additive.what}</Text>

          <Text style={styles.label}>Why it matters</Text>
          <Text style={styles.para}>{additive.why}</Text>

          {additive.effects.length > 0 && (
            <>
              <Text style={styles.label}>Reported effects</Text>
              <View style={styles.chips}>
                {additive.effects.map((e) => (
                  <Chip key={e} label={e} color={r.color} soft={r.soft} />
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Safe daily intake</Text>
          <Text style={styles.para}>{additive.adi}</Text>

          {additive.restrictedIn.length > 0 && (
            <>
              <Text style={styles.label}>Banned or restricted in</Text>
              <View style={styles.chips}>
                {additive.restrictedIn.map((c) => (
                  <Chip key={c} label={c} color="#D02B2B" soft="#FCE6E6" />
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    marginBottom: space(2.5),
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space(3.5),
  },
  headerText: { flex: 1, marginRight: space(2) },
  headerRight: { alignItems: 'flex-end' },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  sub: { fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  riskPill: {
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    borderRadius: radius.pill,
  },
  riskText: { fontSize: 11, fontWeight: '700' },
  chevron: { fontSize: 13, color: colors.textFaint, marginTop: 2 },
  body: {
    paddingHorizontal: space(3.5),
    paddingBottom: space(3.5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space(3),
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: space(3),
    marginBottom: space(1.5),
  },
  para: { fontSize: 13.5, color: colors.text, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
