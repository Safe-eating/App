/**
 * Converts the Open Food Facts dumps in `data/` into SafeBite's food schema.
 *
 *   npm run import
 *
 * Reads every `data/*.json` (one product per file, keyed by barcode), maps it
 * onto the shape in src/types.ts and writes `src/data/imported.json`. The
 * curated starter set in foods.json is left alone — db.ts concatenates the two,
 * so real scanned products sit alongside the hand-written examples.
 *
 * Re-running is safe: ids come from the barcode, so the file is rebuilt from
 * scratch each time and stays in sync with whatever is in data/.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Additive, Food, ProcessingLevel } from '../src/types';

// Both paths are overridable so the importer can be pointed at a scratch
// directory for testing without touching the real dataset:
//   tsx scripts/import-openfoodfacts.ts [inputDir] [outputFile]
const DATA_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'data');
const OUT_FILE = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(__dirname, '..', 'src', 'data', 'imported.json');

const additives: Additive[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'additives.json'), 'utf8')
);

/** The raw Open Food Facts export shape, as produced by the fetch script. */
interface OffProduct {
  barcode: string;
  name: string;
  brand: string;
  quantity?: string;
  categories?: string[];
  ingredients?: string;
  per_100g?: Record<string, number | null>;
  nutriscore_grade?: string | null;
  nova_group?: number | null;
  source?: string;
}

// ---------------------------------------------------------------------------
// category mapping
// ---------------------------------------------------------------------------

/**
 * Open Food Facts tags are a deep taxonomy; we only need the top-level bucket.
 * First rule that matches any tag (or the product name) wins, so the order
 * matters — "batter" has to beat "cereals", and "paneer" has to beat "milk".
 */
const CATEGORY_RULES: { id: string; match: string[] }[] = [
  { id: 'instant', match: ['batter', 'noodle', 'pasta-dish', 'ready-meal', 'prepared-dish', 'frozen-food', 'soup', 'instant'] },
  { id: 'condiments', match: ['sauce', 'condiment', 'spread', 'jam', 'pickle', 'ketchup', 'mayonnaise', 'chutney', 'honey', 'vinegar'] },
  { id: 'sweets', match: ['sweet', 'chocolate', 'candy', 'confectionery', 'dessert', 'ice-cream', 'cake'] },
  { id: 'dairy', match: ['dairy', 'dairies', 'milk', 'cheese', 'paneer', 'yogurt', 'yoghurt', 'curd', 'butter', 'cream', 'ghee'] },
  { id: 'beverages', match: ['beverage', 'drink', 'juice', 'water', 'soda', 'tea', 'coffee', 'squash', 'lemonade'] },
  { id: 'snacks', match: ['snack', 'crisp', 'chip', 'nut', 'namkeen', 'popcorn', 'wafer', 'salty'] },
  { id: 'protein', match: ['meat', 'poultry', 'chicken', 'egg', 'fish', 'seafood', 'legume', 'pulse', 'lentil', 'dal', 'tofu', 'soy'] },
  { id: 'fruits', match: ['fruit', 'berry'] },
  { id: 'vegetables', match: ['vegetable', 'potato', 'salad', 'green'] },
  { id: 'bakery', match: ['cereal', 'bread', 'biscuit', 'flour', 'wheat', 'atta', 'rice', 'grain', 'breakfast', 'oat', 'bakery'] },
];

const FALLBACK_CATEGORY = 'packaged';

/**
 * Umbrella tags that sit at the top of the Open Food Facts taxonomy. They are
 * far too broad to classify on — "plant-based-foods-and-beverages" contains the
 * word "beverages", which would file a bag of flour under drinks.
 */
const UMBRELLA_TAGS = new Set([
  'en:plant-based-foods-and-beverages',
  'en:plant-based-foods',
  'en:cereals-and-potatoes',
  'en:foods',
  'en:groceries',
]);

/**
 * Matches a keyword against one taxonomy tag at word level, so "nut" does not
 * match "coconut" and "water" does not match "watermelon". Singular and plural
 * are treated as the same word, because the taxonomy mixes both.
 */
function tagMatches(tag: string, kw: string): boolean {
  const bare = tag.replace(/^[a-z]{2}:/, '');
  if (kw.includes('-')) return bare.includes(kw);
  return bare.split('-').some((w) => w === kw || w === kw + 's' || w === kw + 'es' || w + 's' === kw);
}

/**
 * Open Food Facts lists tags from most general to most specific, so we walk
 * them backwards — "en:paneer" should decide the category, not "en:dairies",
 * and certainly not "en:plant-based-foods".
 */
function mapCategory(p: OffProduct): { id: string; matched: boolean } {
  const tags = (p.categories ?? [])
    .map((t) => t.toLowerCase())
    .filter((t) => !UMBRELLA_TAGS.has(t));

  for (const tag of [...tags].reverse()) {
    for (const rule of CATEGORY_RULES) {
      if (rule.match.some((m) => tagMatches(tag, m))) return { id: rule.id, matched: true };
    }
  }

  // No usable tags — fall back to the product name, same word-level matching.
  const nameTag = (p.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  for (const rule of CATEGORY_RULES) {
    if (rule.match.some((m) => tagMatches(nameTag, m))) return { id: rule.id, matched: true };
  }

  return { id: FALLBACK_CATEGORY, matched: false };
}

const EMOJI_BY_NAME: { match: string[]; emoji: string }[] = [
  { match: ['paneer', 'cheese'], emoji: '🧀' },
  { match: ['milk', 'doodh'], emoji: '🥛' },
  { match: ['curd', 'dahi', 'yogurt', 'yoghurt'], emoji: '🍦' },
  { match: ['butter', 'ghee'], emoji: '🧈' },
  { match: ['atta', 'flour', 'wheat'], emoji: '🌾' },
  { match: ['batter', 'idli', 'dosa'], emoji: '🥞' },
  { match: ['bread', 'pav', 'bun'], emoji: '🍞' },
  { match: ['juice'], emoji: '🧃' },
  { match: ['egg'], emoji: '🥚' },
  { match: ['chicken', 'mutton'], emoji: '🍗' },
  { match: ['oil'], emoji: '🫗' },
];

const EMOJI_BY_CATEGORY: Record<string, string> = {
  fruits: '🍎', vegetables: '🥦', snacks: '🍟', beverages: '🥤', dairy: '🥛',
  bakery: '🍞', protein: '🍗', sweets: '🍫', instant: '🍜', condiments: '🧂',
  packaged: '📦',
};

function pickEmoji(name: string, categoryId: string): string {
  const n = name.toLowerCase();
  for (const e of EMOJI_BY_NAME) if (e.match.some((m) => n.includes(m))) return e.emoji;
  return EMOJI_BY_CATEGORY[categoryId] ?? '🍽️';
}

// ---------------------------------------------------------------------------
// additives
// ---------------------------------------------------------------------------

/**
 * Aliases too generic to auto-match from free text. They stay in additives.json
 * because they make SEARCH forgiving, but matching "vegetable oil" to palm oil
 * or the word "sugar" to corn syrup would put claims on a label that the label
 * does not actually make.
 */
const TOO_GENERIC = new Set([
  'vegetable oil', 'sulphite', 'nitrite', 'sorbate', 'benzoate',
  'lecithin', 'carotene', 'vitamin c', 'bromate', 'glutamate', 'modified starch',
  'shortening', 'corn syrup', 'bha', 'bht', 'tbhq', 'msg', 'hfcs', 'tio2',
  'ace-k', 'equal', 'splenda', 'carmine', 'inosinate', 'metabisulfite',
]);

/**
 * Phrases that mean an ingredient is ABSENT. Without this, "caffeine free"
 * would be read as a caffeine declaration.
 */
const NEGATED = [
  { additive: 'caffeine', patterns: [/caffeine[\s-]*free/i, /decaffeinated/i] },
  { additive: 'palmoil', patterns: [/palm[\s-]*oil[\s-]*free/i] },
];

/** Matches "INS 330", "E330", "E-330", "(INS330)". */
const CODE_RE = /\b(?:e|ins)[\s-]?(\d{3}[a-z]?)\b/gi;

function findAdditives(ingredients: string): string[] {
  if (!ingredients) return [];
  const text = ' ' + ingredients.toLowerCase().replace(/[(),.;:]/g, ' ') + ' ';
  const found = new Set<string>();

  // 1. explicit INS / E numbers — the reliable signal
  for (const m of ingredients.matchAll(CODE_RE)) {
    const num = m[1].toLowerCase();
    const hit = additives.find((a) => a.code.toLowerCase().replace(/^e/, '') === num);
    if (hit) found.add(hit.id);
  }

  // 2. named ingredients, whole-word only, skipping the generic aliases
  for (const a of additives) {
    if (found.has(a.id)) continue;
    const names = [a.name.toLowerCase(), ...a.aliases.map((x) => x.toLowerCase())];
    for (const name of names) {
      if (name.length < 5 || TOO_GENERIC.has(name)) continue;
      if (text.includes(' ' + name + ' ')) {
        found.add(a.id);
        break;
      }
    }
  }

  // Drop anything the label explicitly says is NOT in there.
  for (const n of NEGATED) {
    if (found.has(n.additive) && n.patterns.some((re) => re.test(ingredients))) {
      found.delete(n.additive);
    }
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// allergens
// ---------------------------------------------------------------------------

const ALLERGEN_RULES: { allergen: string; match: string[] }[] = [
  { allergen: 'milk', match: ['milk', 'paneer', 'cheese', 'butter', 'ghee', 'cream', 'curd', 'whey', 'casein', 'khoya'] },
  { allergen: 'wheat', match: ['wheat', 'atta', 'maida', 'suji', 'rava', 'semolina'] },
  { allergen: 'gluten', match: ['wheat', 'atta', 'maida', 'barley', 'rye', 'suji', 'rava', 'semolina'] },
  { allergen: 'soy', match: ['soy', 'soya', 'tofu'] },
  { allergen: 'peanuts', match: ['peanut', 'groundnut', 'moongphali'] },
  { allergen: 'nuts', match: ['almond', 'cashew', 'walnut', 'pistachio', 'hazelnut'] },
  { allergen: 'egg', match: ['egg'] },
  { allergen: 'fish', match: ['fish', 'anchovy'] },
  { allergen: 'sesame', match: ['sesame', 'til'] },
  { allergen: 'mustard', match: ['mustard', 'sarson'] },
  { allergen: 'sulphites', match: ['sulphite', 'sulfite', 'metabisulphite', 'metabisulfite'] },
];

/**
 * Ingredient names that look like an allergen but are not.
 *
 * "Rava" on its own means wheat semolina, but "idli rava" and "rice rava" are
 * coarse RICE — flagging that batter as wheat/gluten would be a false allergen
 * warning, and those are not harmless. The phrase is removed before matching.
 */
const FALSE_FRIENDS: RegExp[] = [
  /\b(?:idli|idly|rice)[\s-]+rava\b/gi,
  /\brice[\s-]+flour\b/gi,
  /\bcorn[\s-]+flour\b/gi,
  /\bcoconut[\s-]+milk\b/gi, // not a dairy allergen
  /\bcocoa[\s-]+butter\b/gi, // not a dairy allergen
  /\bshea[\s-]+butter\b/gi,
  /\bpeanut[\s-]+free\b/gi,
];

/**
 * Allergens are read from the INGREDIENT LIST when the product publishes one,
 * and only fall back to the product name when it does not.
 *
 * The two disagree more often than you would think. "Rava Idli Batter" is named
 * after a dish normally made with wheat semolina, but its actual ingredient is
 * "Idli Rava", which is rice. Trusting the name would put a wheat warning on a
 * wheat-free product; trusting the ingredients gets it right.
 */
function findAllergens(ingredients: string, name: string): { list: string[]; source: 'ingredients' | 'name' | 'none' } {
  const authoritative = ingredients.trim();
  const source: 'ingredients' | 'name' | 'none' = authoritative ? 'ingredients' : name.trim() ? 'name' : 'none';
  if (source === 'none') return { list: [], source };

  let t = (source === 'ingredients' ? authoritative : name).toLowerCase();
  for (const re of FALSE_FRIENDS) t = t.replace(re, ' ');

  return {
    list: ALLERGEN_RULES.filter((r) => r.match.some((m) => t.includes(m))).map((r) => r.allergen),
    source,
  };
}

// ---------------------------------------------------------------------------
// mapping
// ---------------------------------------------------------------------------

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && isFinite(n) ? n : 0;
};

/**
 * Whether a record carries enough nutrition to be scored at all.
 *
 * This matters more than it looks. Missing fields read as 0, and a food with
 * nothing but zeroes collects no penalties — so an empty record would score a
 * confident 100/100 "Safe to eat". Refusing to import it is the only honest
 * option: a product with no numbers cannot answer any question this app asks.
 */
function hasUsableNutrition(per: Record<string, number | null> | undefined): boolean {
  if (!per) return false;
  if (num(per.energy_kcal) > 0) return true;
  const macros = ['fat', 'carbohydrates', 'protein', 'sugars', 'saturated_fat'];
  return macros.filter((k) => per[k] != null).length >= 2;
}

/**
 * NOVA 1 is "unprocessed or minimally processed" — for a packaged product that
 * is minimally-processed, not `whole`, which is reserved for raw produce.
 */
function mapProcessing(p: OffProduct, additiveIds: string[]): ProcessingLevel {
  switch (p.nova_group) {
    case 1: return 'minimally-processed';
    case 2:
    case 3: return 'processed';
    case 4: return 'ultra-processed';
  }
  // No NOVA group — infer from the ingredient list.
  const parts = (p.ingredients ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (additiveIds.length >= 3) return 'ultra-processed';
  if (parts.length === 0 || parts.length <= 2) return 'minimally-processed';
  if (parts.length <= 5) return 'processed';
  return 'ultra-processed';
}

/** Drinks are measured in ml. Pack size is the clearest tell. */
function unitFor(p: OffProduct, categoryId: string): 'g' | 'ml' {
  const q = (p.quantity ?? '').toLowerCase();
  if (/\d\s*(ml|l|litre|liter)\b/.test(q)) return 'ml';
  if (/\d\s*(g|kg|gm|gram)\b/.test(q)) return 'g';
  return categoryId === 'beverages' || categoryId === 'dairy' ? 'ml' : 'g';
}

const SERVING_BY_CATEGORY: Record<string, number> = {
  beverages: 200, dairy: 200, snacks: 30, sweets: 30, bakery: 50, condiments: 15,
};

function buildBenefits(n: Food['nutrition'], unit: string): string[] {
  const out: string[] = [];
  if (n.fibreG > 6) out.push(`High in fibre — ${n.fibreG} g per 100 ${unit}`);
  else if (n.fibreG > 3) out.push(`A good source of fibre — ${n.fibreG} g per 100 ${unit}`);
  if (n.proteinG > 15) out.push(`High in protein — ${n.proteinG} g per 100 ${unit}`);
  else if (n.proteinG > 8) out.push(`A good source of protein — ${n.proteinG} g per 100 ${unit}`);
  if (n.sugarG < 2 && n.energyKcal > 0) out.push(`Very low in sugar — ${n.sugarG} g per 100 ${unit}`);
  if (n.sodiumMg > 0 && n.sodiumMg < 50) out.push(`Very low in sodium — ${n.sodiumMg} mg per 100 ${unit}`);
  return out;
}

function buildWarnings(n: Food['nutrition'], unit: string, grade: string | null): string[] {
  const out: string[] = [];
  if (n.satFatG > 5) out.push(`High in saturated fat — ${n.satFatG} g per 100 ${unit}, against a 20 g daily cap`);
  if (n.sodiumMg > 300) out.push(`High in sodium — ${n.sodiumMg} mg per 100 ${unit}, against a 2000 mg daily cap`);
  if (n.sugarG > 10) out.push(`High in sugar — ${n.sugarG} g per 100 ${unit}, against a 25 g daily cap`);
  if (n.energyKcal > 450) out.push(`Calorie dense — ${n.energyKcal} kcal per 100 ${unit}`);
  if (grade === 'd' || grade === 'e') {
    out.push(`Nutri-Score ${grade.toUpperCase()} — the second-worst or worst band on the pack rating`);
  }
  return out;
}

function toFood(p: OffProduct, disambiguate: boolean): Food {
  const { id: categoryId, matched } = mapCategory(p);
  const unit = unitFor(p, categoryId);
  const per = p.per_100g ?? {};

  const additiveIds = findAdditives(p.ingredients ?? '');

  // Open Food Facts stores sodium and salt in GRAMS per 100 g.
  const sodiumMg =
    per.sodium != null ? num(per.sodium) * 1000 : num(per.salt) * 400;

  const nutrition: Food['nutrition'] = {
    energyKcal: num(per.energy_kcal),
    fatG: num(per.fat),
    satFatG: num(per.saturated_fat),
    // Not present in this export. Left at 0 and called out in the note.
    transFatG: num((per as any).trans_fat),
    carbsG: num(per.carbohydrates),
    sugarG: num(per.sugars),
    fibreG: num(per.fiber),
    proteinG: num(per.protein),
    sodiumMg: Math.round(sodiumMg * 100) / 100,
  };

  const servingAmount = SERVING_BY_CATEGORY[categoryId] ?? 100;
  const name = disambiguate
    ? `${p.name} (${nutrition.energyKcal} kcal/100 ${unit})`
    : p.name;

  const allergens = findAllergens(p.ingredients ?? '', p.name ?? '');

  const notes: string[] = [
    `Imported from Open Food Facts, barcode ${p.barcode}. Nutrition is as declared on the pack.`,
  ];
  if (!p.ingredients) {
    notes.push(
      'No ingredient list was published for this product, so no additive check could run and any allergens shown were guessed from the product name only.'
    );
  }
  if (nutrition.transFatG === 0) {
    notes.push('Trans fat is not declared in this record and is counted as zero.');
  }
  if (allergens.source !== 'none') {
    notes.push('Allergens here are detected automatically — always check the actual pack before relying on them.');
  }

  return {
    id: p.barcode,
    name,
    brand: p.brand || 'Unbranded',
    categoryId,
    emoji: pickEmoji(p.name, categoryId),
    processing: mapProcessing(p, additiveIds),
    keywords: Array.from(
      new Set(
        `${p.name} ${p.brand}`
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 2)
          .concat(p.barcode)
      )
    ),
    serving: {
      amount: servingAmount,
      unit,
      label: `${servingAmount} ${unit}`,
    },
    nutrition,
    additives: additiveIds,
    allergens: allergens.list,
    benefits: buildBenefits(nutrition, unit),
    warnings: buildWarnings(nutrition, unit, p.nutriscore_grade ?? null),
    note: notes.join(' '),
    safeLimit: undefined,
  };
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

if (!fs.existsSync(DATA_DIR)) {
  console.error(`No data/ directory found at ${DATA_DIR}. Nothing to import.`);
  process.exit(1);
}

const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
console.log(`\nReading ${files.length} file(s) from ${DATA_DIR}\n`);

const raw: OffProduct[] = [];
for (const file of files) {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    if (!p.barcode || !p.name) {
      console.log(`  ⚠ ${file}: no barcode or name, skipped`);
      continue;
    }
    raw.push(p);
  } catch (e) {
    console.log(`  ⚠ ${file}: not valid JSON, skipped`);
  }
}

// Two products can legitimately share a name (full-fat vs toned milk), so the
// energy value is appended to keep them apart in lists.
const nameCounts = new Map<string, number>();
for (const p of raw) nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);

const seen = new Set<string>();
const foods: Food[] = [];
const unmapped: string[] = [];
const noNutrition: string[] = [];

for (const p of raw) {
  if (seen.has(p.barcode)) {
    console.log(`  ⚠ duplicate barcode ${p.barcode} (${p.name}), keeping the first`);
    continue;
  }
  seen.add(p.barcode);

  if (!hasUsableNutrition(p.per_100g)) {
    noNutrition.push(`${p.barcode}  ${p.name}`);
    continue;
  }
  if (!mapCategory(p).matched) unmapped.push(`${p.name} → ${(p.categories ?? []).join(', ') || 'no categories'}`);
  foods.push(toFood(p, (nameCounts.get(p.name) ?? 0) > 1));
}

foods.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(OUT_FILE, JSON.stringify(foods, null, 2) + '\n');

for (const f of foods) {
  console.log(
    `  ✓ ${f.id}  ${f.categoryId.padEnd(11)} ${f.processing.padEnd(20)} ${f.additives.length} additive(s)  ${f.name}`
  );
}

if (noNutrition.length) {
  console.log(
    `\n⚠ ${noNutrition.length} product(s) SKIPPED — no nutrition data published, so they cannot be scored.\n  (Importing them would show a misleading 100/100 "Safe", since missing values read as zero.)`
  );
  noNutrition.forEach((n) => console.log(`    ${n}`));
}

if (unmapped.length) {
  console.log(
    `\n⚠ ${unmapped.length} product(s) fell back to the "${FALLBACK_CATEGORY}" category. Add a rule to CATEGORY_RULES if you want them elsewhere:`
  );
  unmapped.forEach((u) => console.log(`    ${u}`));
}

console.log(`\nWrote ${foods.length} food(s) to ${OUT_FILE}`);
console.log('Run `npm run validate` to see the scores they end up with.\n');
