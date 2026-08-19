/**
 * Dataset check. Run with `npm run validate`.
 *
 * Use this every time the dataset in src/data/ is replaced or extended. It
 * catches the mistakes that are easy to make by hand — a food pointing at an
 * additive id that does not exist, a duplicate id, a missing nutrition field —
 * and then prints the score every food ends up with so you can eyeball whether
 * the verdicts look sane.
 */
import { foods, additives, categories, additiveMap, safetyOf, riskyAdditiveCount, searchFoods } from '../src/lib/db';
import { safeQuantity } from '../src/lib/quantity';

let problems = 0;
const fail = (msg: string) => {
  console.log('  ✗ ' + msg);
  problems++;
};

console.log(`\nLoaded ${foods.length} foods, ${additives.length} additives, ${categories.length} categories.\n`);

console.log('Integrity');
const categoryIds = new Set(categories.map((c) => c.id));
const additiveIds = new Set(additives.map((a) => a.id));
const seenFood = new Set<string>();

for (const f of foods) {
  if (seenFood.has(f.id)) fail(`duplicate food id "${f.id}"`);
  seenFood.add(f.id);
  if (!categoryIds.has(f.categoryId)) fail(`"${f.id}" is in unknown category "${f.categoryId}"`);
  for (const a of f.additives) {
    if (!additiveIds.has(a)) fail(`"${f.id}" references unknown additive "${a}"`);
  }
  if (!f.serving?.amount) fail(`"${f.id}" has no serving size`);

  // Sub-nutrients cannot exceed their parent. Catching this matters because the
  // intake table shows both, and "sugars 5.1 g / carbs 4.8 g" reads as a bug.
  const n = f.nutrition;
  if (n.sugarG > n.carbsG + 0.001) {
    fail(`"${f.id}" has more sugar (${n.sugarG} g) than total carbohydrate (${n.carbsG} g)`);
  }
  if (n.satFatG + n.transFatG > n.fatG + 0.001) {
    fail(
      `"${f.id}" has more saturated + trans fat (${n.satFatG} + ${n.transFatG} g) than total fat (${n.fatG} g)`
    );
  }
  if (Object.values(n).some((v) => v < 0)) fail(`"${f.id}" has a negative nutrition value`);

  if (f.piece && !(f.piece.amount > 0)) fail(`"${f.id}" has a piece with no weight`);
  if (f.piece && (!f.piece.name || !f.piece.plural)) fail(`"${f.id}" has a piece with no name`);
}

const seenAdditive = new Set<string>();
for (const a of additives) {
  if (seenAdditive.has(a.id)) fail(`duplicate additive id "${a.id}"`);
  seenAdditive.add(a.id);
}
if (problems === 0) console.log('  ✓ all ids, categories and additive references resolve');

// ---- scores -------------------------------------------------------------
console.log('\nScores (worst first)');
const rows = foods.map((f) => {
  const s = safetyOf(f);
  const q = safeQuantity(f, s.verdict);
  return {
    name: f.name,
    score: s.score,
    verdict: s.verdict,
    limit: `${q.amount} ${q.unit}`,
    by: q.limitedBy,
    risky: riskyAdditiveCount(f),
  };
});

rows.sort((a, b) => a.score - b.score);
for (const r of rows) {
  console.log(
    `  ${String(r.score).padStart(3)}  ${r.verdict.padEnd(8)} ${(r.limit + '/day').padEnd(12)} ${('limited by ' + r.by).padEnd(24)} ${r.risky} additive(s)  ${r.name}`
  );
}

const spread: Record<string, number> = {};
rows.forEach((r) => (spread[r.verdict] = (spread[r.verdict] ?? 0) + 1));
console.log('\nVerdict spread:', spread);

const orphanAdditives = additives.filter((a) => !foods.some((f) => f.additives.includes(a.id)));
if (orphanAdditives.length) {
  console.log(
    `\nNote: ${orphanAdditives.length} additive(s) are not used by any food (still searchable): ` +
      orphanAdditives.map((a) => a.code || a.id).join(', ')
  );
}

// ---- search spot checks -------------------------------------------------
console.log('\nSearch spot checks');
for (const q of ['chips', 'cold drink', 'maggi', 'aam', 'msg', 'dal']) {
  const hits = searchFoods(q);
  console.log(`  "${q}" → ${hits.length ? hits.slice(0, 4).map((f) => f.name).join(', ') : 'NO RESULTS'}`);
  if (!hits.length) fail(`search for "${q}" returns nothing`);
}

console.log(problems === 0 ? '\n✓ Dataset looks good.\n' : `\n✗ ${problems} problem(s) found.\n`);
process.exit(problems === 0 ? 0 : 1);
