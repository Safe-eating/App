import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Category, Food } from './src/types';
import { colors } from './src/theme';
import { CartProvider } from './src/lib/cart';
import { HomeScreen } from './src/screens/HomeScreen';
import { CategoryScreen } from './src/screens/CategoryScreen';
import { FoodScreen } from './src/screens/FoodScreen';
import { CartScreen } from './src/screens/CartScreen';

/**
 * Four screens and a strictly linear history, so a hand-rolled stack is
 * simpler and lighter here than pulling in a navigation library. The Android
 * hardware back button is wired to the same pop.
 */
type Route =
  | { name: 'home' }
  | { name: 'category'; category: Category }
  | { name: 'food'; food: Food }
  | { name: 'cart' };

export default function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const current = stack[stack.length - 1];

  const push = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const pop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const openFood = useCallback((food: Food) => push({ name: 'food', food }), [push]);
  const openCart = useCallback(() => push({ name: 'cart' }), [push]);

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
      <CartProvider>
        <View style={styles.root}>
          <StatusBar style="dark" />
          {current.name === 'home' && (
            <HomeScreen
              onOpenFood={openFood}
              onOpenCategory={(category) => push({ name: 'category', category })}
              onOpenCart={openCart}
            />
          )}
          {current.name === 'category' && (
            <CategoryScreen
              category={current.category}
              onOpenFood={openFood}
              onOpenCart={openCart}
              onBack={pop}
            />
          )}
          {/* Keyed by id so the portion calculator re-seeds its state per food
              rather than carrying the previous food's amount over. */}
          {current.name === 'food' && (
            <FoodScreen
              key={current.food.id}
              food={current.food}
              onOpenCart={openCart}
              onBack={pop}
            />
          )}
          {current.name === 'cart' && <CartScreen onOpenFood={openFood} onBack={pop} />}
        </View>
      </CartProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
