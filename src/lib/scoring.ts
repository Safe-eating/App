import { Additive, Food, SafetyResult, ScoreFactor, Verdict } from '../types';

/**
 * Safety scoring.
 *
 * The score is DERIVED, never stored, so a brand new dataset gets sensible
 * verdicts the moment it is dropped in. Every adjustment is returned as a
 * ScoreFactor so the detail screen can show the user exactly why a food
 * scored what it did — no black box.
 *
 * Thresholds follow the UK front-of-pack "traffic light" cut-offs per 100 g
 * plus WHO guidance on trans fat and sodium.
 */

const START = 100;

/** Points removed per additive, by risk level. */
const ADDITIVE_PENALTY = { safe: 0, low: 3, moderate: 9, high: 18 } as const;

/** Additives alone can never sink a food by more than this. */
const ADDITIVE_PENALTY_CAP = 45;

const PROCESSING_PENALTY = {
  whole: 0,
  'minimally-processed': 3,
  processed: 11,
  'ultra-processed': 22,
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Picks the first band whose threshold the value clears. Bands run high → low. */
function band(
  value: number,
  bands: { over: number; points: number; word: string }[]
): { points: number; word: string } | null {
  for (const b of bands) {
    if (value > b.over) return { points: b.points, word: b.word };
  }
  return null;
}

export function scoreFood(
  food: Food,
  additiveMap: Record<string, Additive>
): SafetyResult {
  const factors: ScoreFactor[] = [];
  const n = food.nutrition;

  // ---- processing level -------------------------------------------------
  const procPenalty = PROCESSING_PENALTY[food.processing] ?? 0;
  if (procPenalty > 0) {
    factors.push({
      label: 'Processing level',
      detail:
        food.processing === 'ultra-processed'
          ? 'Ultra-processed — industrially formulated, far from its natural state'
          : 'Processed — altered from its natural state',
      points: -procPenalty,
    });
  } else if (food.processing === 'whole') {
    factors.push({
      label: 'Whole food',
      detail: 'Eaten close to its natural state',
      points: +5,
    });
  }

  // ---- additives --------------------------------------------------------
  let additivePenalty = 0;
  const risky: string[] = [];
  for (const id of food.additives) {
    const a = additiveMap[id];
    if (!a) continue;
    const p = ADDITIVE_PENALTY[a.risk];
    additivePenalty += p;
    if (p > 0) risky.push(a.code ? `${a.name} (${a.code})` : a.name);
  }
  additivePenalty = Math.min(additivePenalty, ADDITIVE_PENALTY_CAP);

  if (additivePenalty > 0) {
    factors.push({
      label: `${risky.length} additive${risky.length > 1 ? 's' : ''} of concern`,
      detail: risky.slice(0, 3).join(', ') + (risky.length > 3 ? ` +${risky.length - 3} more` : ''),
      points: -additivePenalty,
    });
  } else if (food.additives.length === 0) {
    factors.push({
      label: 'No additives',
      detail: 'Nothing artificial added',
      points: +5,
    });
  }

  // ---- the bad nutrients ------------------------------------------------
  const trans = band(n.transFatG, [
    { over: 1, points: 24, word: 'Very high' },
    { over: 0.2, points: 16, word: 'Contains' },
    { over: 0, points: 6, word: 'Traces of' },
  ]);
  if (trans) {
    factors.push({
      label: `${trans.word} trans fat`,
      detail: `${n.transFatG} g per 100 ${food.serving.unit} — WHO advises eliminating it entirely`,
      points: -trans.points,
    });
  }

  const sodium = band(n.sodiumMg, [
    { over: 600, points: 16, word: 'Very high' },
    { over: 300, points: 9, word: 'High' },
    { over: 120, points: 4, word: 'Moderate' },
  ]);
  if (sodium) {
    factors.push({
      label: `${sodium.word} sodium`,
      detail: `${n.sodiumMg} mg per 100 ${food.serving.unit} — daily cap is 2000 mg`,
      points: -sodium.points,
    });
  }

  const sugar = band(n.sugarG, [
    { over: 22.5, points: 15, word: 'Very high' },
    { over: 10, points: 8, word: 'High' },
    { over: 5, points: 3, word: 'Moderate' },
  ]);
  // Whole fruit sugar comes bundled with fibre and water, so it is not
  // penalised the way added sugar in a biscuit is.
  const naturalSugar = food.processing === 'whole' || food.processing === 'minimally-processed';
  if (sugar && !naturalSugar) {
    factors.push({
      label: `${sugar.word} sugar`,
      detail: `${n.sugarG} g per 100 ${food.serving.unit} — daily free-sugar cap is 25 g`,
      points: -sugar.points,
    });
  } else if (sugar && naturalSugar) {
    factors.push({
      label: 'Natural sugars',
      detail: `${n.sugarG} g per 100 ${food.serving.unit}, but bound up with fibre and water`,
      points: -2,
    });
  }

  const satFat = band(n.satFatG, [
    { over: 10, points: 14, word: 'Very high' },
    { over: 5, points: 9, word: 'High' },
    { over: 1.5, points: 4, word: 'Moderate' },
  ]);
  if (satFat) {
    factors.push({
      label: `${satFat.word} saturated fat`,
      detail: `${n.satFatG} g per 100 ${food.serving.unit} — daily cap is about 20 g`,
      points: -satFat.points,
    });
  }

  // ---- the good stuff ---------------------------------------------------
  if (n.fibreG > 6) {
    factors.push({ label: 'Excellent fibre', detail: `${n.fibreG} g per 100 ${food.serving.unit}`, points: +9 });
  } else if (n.fibreG > 3) {
    factors.push({ label: 'Good fibre', detail: `${n.fibreG} g per 100 ${food.serving.unit}`, points: +5 });
  }

  if (n.proteinG > 15) {
    factors.push({ label: 'High protein', detail: `${n.proteinG} g per 100 ${food.serving.unit}`, points: +6 });
  } else if (n.proteinG > 8) {
    factors.push({ label: 'Good protein', detail: `${n.proteinG} g per 100 ${food.serving.unit}`, points: +3 });
  }

  const total = factors.reduce((sum, f) => sum + f.points, START);
  const score = Math.round(clamp(total, 0, 100));

  // Biggest hits first — that is what the user actually wants to read.
  factors.sort((a, b) => a.points - b.points);

  return { score, verdict: verdictFor(score), factors };
}

export function verdictFor(score: number): Verdict {
  if (score >= 80) return 'safe';
  if (score >= 60) return 'moderate';
  if (score >= 38) return 'limit';
  return 'avoid';
}
