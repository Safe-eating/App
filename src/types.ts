/**
 * Core data shapes for SafeBite.
 *
 * NOTE: everything the app knows about food comes from `src/data/*.json`.
 * When a new dataset arrives, only those JSON files change — no screen,
 * no component and no scoring rule needs to be touched, as long as the
 * new data is converted into the shapes below.
 */

/** How risky an additive is, worst last. */
export type RiskLevel = 'safe' | 'low' | 'moderate' | 'high';

/** NOVA-style processing classification. Drives a big part of the score. */
export type ProcessingLevel =
  | 'whole'
  | 'minimally-processed'
  | 'processed'
  | 'ultra-processed';

/** Final human-facing answer to "can I eat this?". */
export type Verdict = 'safe' | 'moderate' | 'limit' | 'avoid';

/** Nutrition is always stored PER 100 g (or per 100 ml for drinks). */
export interface Nutrition {
  energyKcal: number;
  fatG: number;
  satFatG: number;
  transFatG: number;
  carbsG: number;
  sugarG: number;
  fibreG: number;
  proteinG: number;
  sodiumMg: number;
}

/** One entry in the harmful-ingredient database. */
export interface Additive {
  id: string;
  name: string;
  /** INS / E-number, e.g. "E621". Empty for non-numbered ingredients. */
  code: string;
  /** Alternate names so search and dataset matching still work. */
  aliases: string[];
  /** Functional class, e.g. "Preservative". */
  class: string;
  risk: RiskLevel;
  /** Plain-language "what is this". */
  what: string;
  /** Plain-language "why it matters". */
  why: string;
  /** Reported health effects, shown as chips. */
  effects: string[];
  /** Acceptable Daily Intake or practical limit, as text. */
  adi: string;
  /** Countries / regions where it is banned or restricted. */
  restrictedIn: string[];
}

export interface Serving {
  amount: number;
  unit: 'g' | 'ml';
  label: string;
}

/**
 * One countable unit of a food — a biscuit, a slice, a can, a spoonful.
 *
 * Distinct from `serving`, which is often several pieces ("3 biscuits (30 g)").
 * Foods that cannot be counted, like spinach or a block of paneer, have none.
 */
export interface Piece {
  /** Weight or volume of ONE piece, in the food's serving unit. */
  amount: number;
  name: string;
  plural: string;
}

/** An explicit safe-limit override supplied by the dataset. */
export interface SafeLimit {
  amount: number;
  unit: 'g' | 'ml';
  period: 'day' | 'week';
  note: string;
}

export interface Food {
  id: string;
  name: string;
  brand: string;
  categoryId: string;
  emoji: string;
  processing: ProcessingLevel;
  /** Extra search terms: regional names, misspellings, synonyms. */
  keywords: string[];
  serving: Serving;
  /** One countable unit, when the food has one. */
  piece?: Piece;
  nutrition: Nutrition;
  /** Additive ids referencing the additive database. */
  additives: string[];
  allergens: string[];
  benefits: string[];
  warnings: string[];
  /** Optional dataset-supplied limit. When absent it is derived from nutrition. */
  safeLimit?: SafeLimit;
  note: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  color: string;
}

/** One line of "why the score is what it is". */
export interface ScoreFactor {
  label: string;
  detail: string;
  /** Negative = penalty, positive = bonus. */
  points: number;
}

export interface SafetyResult {
  score: number;
  verdict: Verdict;
  factors: ScoreFactor[];
}

export interface QuantityGuidance {
  /** Max amount per day in the food's own unit. */
  amount: number;
  unit: 'g' | 'ml';
  /** Which nutrient (or rule) set the ceiling. */
  limitedBy: string;
  reason: string;
  /** Roughly how many standard servings that is. */
  servings: number;
  /** True when the number came from the dataset rather than being derived. */
  fromDataset: boolean;
}
