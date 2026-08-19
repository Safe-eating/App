import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Food } from '../types';
import { Portion } from './quantity';

/**
 * The basket.
 *
 * Held in memory for the session — there is no storage dependency, so closing
 * the app clears it. Everything the cart screen shows is derived from these
 * portions at render time; nothing about the totals is cached here.
 */

export interface CartEntry extends Portion {
  /** Same as food.id — kept explicit so list keys read clearly. */
  id: string;
}

interface CartApi {
  entries: CartEntry[];
  count: number;
  /** Adds a food, or tops up the amount if it is already in the basket. */
  add: (food: Food, amount: number) => void;
  setAmount: (id: string, amount: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CartEntry[]>([]);

  const add = useCallback((food: Food, amount: number) => {
    if (amount <= 0) return;
    setEntries((list) => {
      const existing = list.find((e) => e.id === food.id);
      if (!existing) return [...list, { id: food.id, food, amount }];
      // Adding the same food again tops up rather than duplicating the row.
      return list.map((e) => (e.id === food.id ? { ...e, amount: e.amount + amount } : e));
    });
  }, []);

  const setAmount = useCallback((id: string, amount: number) => {
    setEntries((list) =>
      amount <= 0
        ? list.filter((e) => e.id !== id)
        : list.map((e) => (e.id === id ? { ...e, amount } : e))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((list) => list.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo<CartApi>(
    () => ({
      entries,
      count: entries.length,
      add,
      setAmount,
      remove,
      clear,
      has: (id: string) => entries.some((e) => e.id === id),
    }),
    [entries, add, setAmount, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside a CartProvider');
  return ctx;
}
