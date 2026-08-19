import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Food } from './src/types';
import { colors } from './src/theme';
import { ScanScreen } from './src/screens/ScanScreen';
import { FoodScreen } from './src/screens/FoodScreen';

/**
 * Two screens: scan a barcode, then read the report for whatever it found.
 * The history is one level deep, so a hand-rolled stack is simpler than a
 * navigation library. The Android hardware back button is wired to the pop.
 */
type Route = { name: 'scan' } | { name: 'food'; food: Food };

export default function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'scan' }]);
  const current = stack[stack.length - 1];

  const openFood = useCallback((food: Food) => setStack((s) => [...s, { name: 'food', food }]), []);
  const pop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  useEffect(() => {
    // There is no hardware back button on web, and react-native-web's stub
    // logs an error if you subscribe to it anyway.
    if (Platform.OS === 'web') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        pop();
        return true; // handled — do not exit the app
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pop]);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {/* The scanner is unmounted while a report is open, so the camera is
            never left running behind a screen the user is reading. */}
        {current.name === 'scan' && <ScanScreen onOpenFood={openFood} />}
        {/* Keyed by id so the portion calculator re-seeds per product. */}
        {current.name === 'food' && (
          <FoodScreen key={current.food.id} food={current.food} onBack={pop} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
