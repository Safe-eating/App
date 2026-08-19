import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space } from '../theme';

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search any food, brand or ingredient',
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        autoFocus={autoFocus}
        accessibilityLabel="Search foods"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Text style={styles.clear}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space(4),
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 15, marginRight: space(2.5) },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    // Android adds its own vertical padding that misaligns the text.
    paddingVertical: 0,
  },
  clear: { fontSize: 15, color: colors.textFaint, paddingLeft: space(2) },
});
