import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../theme';

export function TopBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  /** Optional action on the right, e.g. the basket button. */
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space(2) }]}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {/* Always occupies the back button's width so the title stays centred,
          whether or not there is an action on the right. Deliberately has no
          border of its own — an empty slot must be invisible, and anything
          placed in it draws its own background. */}
      <View style={styles.slot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(3),
    paddingBottom: space(2),
    backgroundColor: colors.bg,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  slot: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 26, color: colors.text, lineHeight: 30, marginTop: -3 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: space(2),
  },
});
