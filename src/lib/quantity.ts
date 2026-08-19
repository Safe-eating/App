import { Food, Nutrition, QuantityGuidance, Verdict } from '../types';

/**
 * "How much can I eat without it hurting me?"
 *
 * If the dataset states a limit we trust it. Otherwise we work backwards from
 * public daily reference intakes: for every risky nutrient, ask how much of
 * THIS food it would take to eat up its share of the daily budget, then take
 * the strictest answer.
 */

/** Daily reference intake for an average adult, and the share one food may take. */
const BUDGETS = [
  { key: 'sodiumMg', label: 'sodium', dailyCap: 2000, share: 0.3, unit: 'mg' },
  { key: 'sugarG', label: 'sugar', dailyCap: 25, share: 0.4, unit: 'g' },
  { key: 'satFatG', label: 'saturated fat', dailyCap: 20, share: 0.35, unit: 'g' },
  { key: 'transFatG', label: 'trans fat', dailyCap: 2, share: 0.25, unit: 'g' },
  { key: 'energyKcal', label: 'calories', dailyCap: 2000, share: 0.15, unit: 'kcal' },
] as const;

/** Nobody needs a "max 4 kg of spinach" answer, so derived limits stop here. */
const SENSIBLE_MAX = 500;

/** A food that scores badly gets a tighter limit than its nutrients alone imply. */
const VERDICT_TIGHTENING: Record<Verdict, number> = {
  safe: 1,
  moderate: 0.9,
  limit: 0.75,
  avoid: 0.5,
};

/**
 * Sugar in whole fruit or plain milk arrives bundled with fibre, water and
 * protein. The 25 g cap is about ADDED sugar, so these are not judged on it.
 */
export const hasOnlyNaturalSugar = (food: Food): boolean =>
  food.processing === 'whole' || food.processing === 'minimally-processed';

export function safeQuantity(food: Food, verdict: Verdict = 'moderate'): QuantityGuidance {
  if (food.safeLimit) {
    const l = food.safeLimit;
    return {
      amount: l.amount,
      unit: l.unit,
      limitedBy: 'dataset',
      reason: l.note,
      servings: round1(l.amount / food.serving.amount),
      fromDataset: true,
    };
  }

  const naturalSugar = hasOnlyNaturalSugar(food);
  let best: { grams: number; label: string; unit: string; cap: number; share: number } | null = null;

  for (const b of BUDGETS) {
    if (b.key === 'sugarG' && naturalSugar) continue;
    const per100 = food.nutrition[b.key as keyof Nutrition];
    if (!per100 || per100 <= 0) continue;
    const allowance = b.dailyCap * b.share;
    const grams = (allowance / per100) * 100;
    if (!best || grams < best.grams) {
      best = {
        grams,
        label: b.label,
        unit: b.unit,
        cap: Math.round(allowance),
        share: b.share,
      };
    }
  }

  // A diet cola has no nutrient worth budgeting, yet it is still full of
  // additives — so the ceiling gets tightened by the verdict just like a
  // nutrient-bound limit would be.
  const ceiling = SENSIBLE_MAX * VERDICT_TIGHTENING[verdict];

  if (!best) {
    return {
      amount: niceRound(ceiling),
      unit: food.serving.unit,
      limitedBy: 'nothing',
      reason: reasonForCeiling(verdict),
      servings: round1(niceRound(ceiling) / food.serving.amount),
      fromDataset: false,
    };
  }

  const tightened = best.grams * VERDICT_TIGHTENING[verdict];
  const hitCeiling = tightened > ceiling;
  const amount = niceRound(Math.min(tightened, ceiling));

  return {
    amount,
    unit: food.serving.unit,
    limitedBy: hitCeiling ? 'nothing' : best.label,
    reason: hitCeiling
      ? reasonForCeiling(verdict)
      : `Past this you have spent ${Math.round(best.share * 100)}% of a day's ${best.label} budget (${best.cap} ${best.unit}) on this one food` +
        (verdict === 'limit' || verdict === 'avoid'
          ? ', and the limit is pulled in further because of its overall safety score.'
          : '.'),
    servings: round1(amount / food.serving.amount),
    fromDataset: false,
  };
}

function reasonForCeiling(verdict: Verdict): string {
  return verdict === 'limit' || verdict === 'avoid'
    ? 'No single nutrient forces a limit here — the cap comes from the additive load and the overall safety score instead.'
    : 'Nothing in this food needs capping. This is simply a sensible upper bound for one day.';
}

// ---------------------------------------------------------------------------
// "If I eat this much, what do I actually take in?"
//
// Everything below works on TOTALS, so one food and a whole basket of food run
// through exactly the same engine.
// ---------------------------------------------------------------------------

/** One food at one amount. The unit of everything in this section. */
export interface Portion {
  food: Food;
  amount: number;
}

export interface IntakeTotals {
  /** Summed nutrition across every portion. */
  nutrition: Nutrition;
  /**
   * Sugar contributed only by processed and ultra-processed items. This, not
   * total sugar, is what the 25 g daily cap actually refers to — so an apple
   * and a cola in the same basket are counted correctly rather than lumped.
   */
  addedSugarG: number;
}

const ZERO: Nutrition = {
  energyKcal: 0, fatG: 0, satFatG: 0, transFatG: 0, carbsG: 0,
  sugarG: 0, fibreG: 0, proteinG: 0, sodiumMg: 0,
};

const NUTRITION_KEYS = Object.keys(ZERO) as (keyof Nutrition)[];

/** This food's nutrition scaled from per-100 to the amount actually eaten. */
export function scaleNutrition(food: Food, amount: number): Nutrition {
  const f = amount / 100;
  const out = { ...ZERO };
  for (const k of NUTRITION_KEYS) out[k] = food.nutrition[k] * f;
  return out;
}

/** Adds up any number of portions into a single intake total. */
export function totalsFor(portions: Portion[]): IntakeTotals {
  const nutrition = { ...ZERO };
  let addedSugarG = 0;

  for (const p of portions) {
    const n = scaleNutrition(p.food, p.amount);
    for (const k of NUTRITION_KEYS) nutrition[k] += n[k];
    if (!hasOnlyNaturalSugar(p.food)) addedSugarG += n.sugarG;
  }
  return { nutrition, addedSugarG };
}

/**
 * Adult daily reference intakes.
 *
 * `kind` matters: a `limit` is a ceiling you want to stay under (sugar, sodium),
 * while a `target` is something you are trying to reach (fibre, protein). The
 * UI colours them in opposite directions, so 90% of your fibre target is good
 * news and 90% of your sodium cap is not.
 */
const NUTRIENT_REFS = [
  { key: 'energyKcal', label: 'Energy', unit: 'kcal', ref: 2000, kind: 'limit', decimals: 0 },
  { key: 'proteinG', label: 'Protein', unit: 'g', ref: 50, kind: 'target', decimals: 1 },
  { key: 'carbsG', label: 'Carbohydrate', unit: 'g', ref: 260, kind: 'limit', decimals: 1 },
  { key: 'sugarG', label: 'of which sugars', unit: 'g', ref: 25, kind: 'limit', decimals: 1, indent: true },
  { key: 'fibreG', label: 'Fibre', unit: 'g', ref: 30, kind: 'target', decimals: 1 },
  { key: 'fatG', label: 'Fat', unit: 'g', ref: 70, kind: 'limit', decimals: 1 },
  { key: 'satFatG', label: 'of which saturated', unit: 'g', ref: 20, kind: 'limit', decimals: 1, indent: true },
  { key: 'transFatG', label: 'of which trans', unit: 'g', ref: 2, kind: 'limit', decimals: 2, indent: true },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg', ref: 2000, kind: 'limit', decimals: 0 },
] as const;

export interface NutrientRow {
  key: string;
  label: string;
  /** Absolute intake, e.g. "12.4 g". */
  display: string;
  /** Percentage of the adult daily reference, clamped for display at 999. */
  percent: number;
  /** `neutral` is shown greyed — reported, but not judged. */
  kind: 'limit' | 'target' | 'neutral';
  indent: boolean;
}

/** Exactly what these totals put into your body. */
export function breakdownFor(totals: IntakeTotals): NutrientRow[] {
  return NUTRIENT_REFS.map((r) => {
    const value = totals.nutrition[r.key as keyof Nutrition];

    // Sugars are always REPORTED in full, but only the added portion is scored.
    // When a basket mixes an apple with a cola the two differ, and the label has
    // to say so — otherwise the row reads "55.8 g … 140%" and the arithmetic
    // looks broken to anyone who checks it against the 25 g cap.
    const isSugar = r.key === 'sugarG';
    const scored = isSugar ? totals.addedSugarG : value;
    const allNatural = isSugar && totals.addedSugarG < 0.05 && value > 0.05;
    const mixed = isSugar && totals.addedSugarG >= 0.05 && value - totals.addedSugarG >= 0.05;

    let label: string = r.label;
    if (allNatural) label = 'of which sugars (all natural)';
    else if (mixed) label = `of which sugars (${totals.addedSugarG.toFixed(1)} g added)`;

    return {
      key: r.key,
      label,
      display: `${value.toFixed(r.decimals)} ${r.unit}`,
      percent: Math.min(999, Math.round((scored / r.ref) * 100)),
      kind: allNatural ? ('neutral' as const) : r.kind,
      indent: 'indent' in r ? true : false,
    };
  });
}

/** Convenience wrapper for the single-food case. */
export function intakeBreakdown(food: Food, amount: number): NutrientRow[] {
  return breakdownFor(totalsFor([{ food, amount }]));
}

export type IntakeLevel = 'fine' | 'watch' | 'over' | 'harmful';

export interface IntakeVerdict {
  level: IntakeLevel;
  title: string;
  detail: string;
  /** The nutrients that pushed it over, worst first. */
  flags: string[];
}

/** Which nutrients count as a ceiling when judging an intake. */
const JUDGED = [
  { key: 'sodiumMg', label: 'sodium', ref: 2000 },
  { key: 'sugarG', label: 'added sugar', ref: 25 },
  { key: 'satFatG', label: 'saturated fat', ref: 20 },
  { key: 'transFatG', label: 'trans fat', ref: 2 },
  { key: 'energyKcal', label: 'calories', ref: 2000 },
] as const;

const LEVEL_TITLES: Record<IntakeLevel, string> = {
  fine: 'Safe to eat',
  watch: 'Fine, but do not make a habit of it',
  over: 'Too much for one day',
  harmful: 'Harmful in one sitting',
};

/**
 * Is *this much* harmful?
 *
 * Judged on how much of a day's budget the intake eats up, not on any food's
 * general reputation — 20 g of crisps is fine, 300 g is not.
 *
 * @param subject how to refer to the intake in prose, e.g. "330 ml" or "This basket"
 * @param limitRatio intake ÷ the food's own safe daily limit, when there is one
 */
export function assessTotals(
  totals: IntakeTotals,
  subject: string,
  limitRatio?: number
): IntakeVerdict {
  const scored = JUDGED.map((j) => ({
    label: j.label,
    percent: Math.round(
      ((j.key === 'sugarG' ? totals.addedSugarG : totals.nutrition[j.key as keyof Nutrition]) /
        j.ref) *
        100
    ),
  }))
    .filter((x) => x.percent > 0)
    .sort((a, b) => b.percent - a.percent);

  const worst = scored[0];
  const worstPct = worst?.percent ?? 0;

  let level: IntakeLevel = 'fine';
  if (worstPct >= 100) level = 'harmful';
  else if (worstPct >= 50) level = 'over';
  else if (worstPct >= 25) level = 'watch';

  // The food's own daily ceiling is a second opinion on top of the nutrients.
  if (limitRatio !== undefined) {
    if (limitRatio > 1 && level === 'fine') level = 'watch';
    if (limitRatio > 1.5 && level === 'watch') level = 'over';
  }

  const flags = scored
    .filter((s) => s.percent >= 25)
    .slice(0, 4)
    .map((s) => `${s.percent}% of a day's ${s.label}`);

  let detail: string;
  if (!worst) {
    detail = `${subject} adds nothing you need to worry about.`;
  } else if (level === 'harmful') {
    detail = `${subject} uses up your entire daily ${worst.label} allowance — and you still have the rest of the day to eat.`;
  } else if (level === 'over') {
    detail = `${subject} spends ${worst.percent}% of a day's ${worst.label}. Cut it back or skip it elsewhere today.`;
  } else if (level === 'watch') {
    detail = `${subject} is an acceptable amount, but it already takes ${worst.percent}% of a day's ${worst.label}.`;
  } else {
    detail = `${subject} barely touches your daily budget — the biggest single hit is ${worst.percent}% of your ${worst.label}.`;
  }

  return { level, title: LEVEL_TITLES[level], detail, flags };
}

/** Convenience wrapper for the single-food case. */
export function assessIntake(food: Food, amount: number, dailyLimit: number): IntakeVerdict {
  return assessTotals(
    totalsFor([{ food, amount }]),
    `${amount} ${food.serving.unit}`,
    dailyLimit > 0 ? amount / dailyLimit : undefined
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Rounds to a number a human would actually say out loud. */
function niceRound(n: number) {
  if (n >= 200) return Math.round(n / 50) * 50;
  if (n >= 50) return Math.round(n / 10) * 10;
  if (n >= 10) return Math.round(n / 5) * 5;
  return Math.max(1, Math.round(n));
}
