# SafeBite

Scan the barcode on a food pack and get a straight answer about what is in it.

1. **Is it safe to eat?** — a 0–100 safety score and a plain-language verdict.
2. **What is harmful in it?** — every additive: what it is, why it matters, reported effects, and where it is banned.
3. **How much won't hurt me?** — a derived daily limit, plus a calculator showing exactly what any amount puts into your body.

**3,523 products** are findable by barcode.

---

## Running it

```bash
npm install
npm start
```

Scan the QR code with **Expo Go** on your phone. The camera scanner needs a real
device — it will not work in a browser.

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Open on a connected Android device or emulator |
| `npm run import` | **Convert `data/*.json`** (Open Food Facts) into the app's schema |
| `npm run validate` | **Check the dataset** — integrity, scores, barcode lookups |
| `npm run typecheck` | TypeScript check with no emit |

### ⚠️ Do not upgrade the Expo SDK past 54 without checking Expo Go first

Pinned to **Expo SDK 54** on purpose. Expo Go supports exactly one SDK version,
and Expo Go for SDK 57 [is not on the app stores yet](https://expo.dev/changelog/sdk-57).
A project on a newer SDK fails on a store-installed Expo Go with *"Project is
incompatible with this version of Expo Go"*, and no amount of updating Expo Go
fixes it.

---

## The two screens

**`ScanScreen`** — the home screen. Uses `expo-camera`, reading EAN-13/8,
UPC-A/E, Code 128/39, ITF-14 and QR, with a torch toggle. A scanned code is
normalised before lookup: the same product is printed as UPC-A
(`028400034227`) and stored as EAN-13 (`0028400034227`), so digits are stripped
of leading zeros on both sides before matching. There is also a manual entry
box, because a denied camera permission would otherwise leave the app with
nothing it can do.

The camera runs only while this screen is showing — opening a report unmounts
it — and nothing is recorded or uploaded.

**`FoodScreen`** — the report: score with a breakdown of every point added and
removed, each harmful ingredient expandable, the safe daily limit, an intake
calculator for any amount, full nutrition, benefits, warnings and allergens.

---

## How the safety score works

Nothing is hardcoded. Every food **starts at 100** and
[`src/lib/scoring.ts`](src/lib/scoring.ts) adds and subtracts from there,
returning each adjustment as a labelled factor so the app can show exactly why a
product scored what it did.

| Factor | Effect |
| --- | --- |
| Ultra-processed | −22 |
| Processed | −11 |
| Whole food | +5 |
| Each additive | −18 high risk, −9 moderate, −3 low (capped at −45 total) |
| No additives at all | +5 |
| Trans fat | up to −24 |
| Sodium | up to −16 |
| Added sugar | up to −15 |
| Saturated fat | up to −14 |
| Fibre | up to +9 |
| Protein | up to +6 |

Thresholds follow the UK front-of-pack traffic-light cut-offs per 100 g, plus WHO
guidance on trans fat and sodium. Sugar in whole and minimally processed food is
treated as natural rather than added, so plain milk is not penalised like a
biscuit.

**Verdict bands:** 80–100 Safe · 60–79 Mostly safe · 38–59 Limit · 0–37 Avoid

## How the daily limit works

[`src/lib/quantity.ts`](src/lib/quantity.ts) works backwards from adult daily
reference intakes. For every risky nutrient it asks *how much of this food would
use up its allotted share of the daily budget*, then takes the strictest answer.

| Nutrient | Daily cap | Share one food may take |
| --- | --- | --- |
| Sodium | 2000 mg | 30% |
| Added sugar | 25 g | 40% |
| Saturated fat | 20 g | 35% |
| Trans fat | 2 g | 25% |
| Calories | 2000 kcal | 15% |

The result is tightened by the safety verdict (avoid ×0.5, limit ×0.75), so a
food that is bad for reasons beyond one nutrient still gets a strict limit.

---

## Adding more products

Drop Open Food Facts barcode dumps into `data/` (one JSON per product), then:

```bash
npm run import && npm run validate
```

`scripts/import-openfoodfacts.ts` does the mapping. Read its output each time —
it reports what was skipped and why. The parts worth knowing:

- **Sodium is converted.** Open Food Facts stores `sodium` and `salt` in *grams*
  per 100 g; the app uses milligrams, so it multiplies by 1000 (falling back to
  `salt × 400` when sodium is absent).
- **Physically impossible records are skipped.** The data is crowd-sourced and
  genuinely contains "1000 g saturated fat per 100 g". Anything over 100 g per
  100 g, or over 900 kcal per 100 g, cannot be trusted at all.
- **Inconsistent records are repaired conservatively.** Where sugars exceed
  carbohydrate, or saturated + trans exceed total fat, the *parent* is raised to
  its logical minimum. A declared figure is never lowered — that would be
  inventing data.
- **Products with no nutrition data are skipped.** Missing values read as zero,
  and a food of all zeroes collects no penalties — it would score a confident
  100/100 "Safe to eat".
- **Categories come from the taxonomy tags, most-specific first.** Umbrella tags
  like `en:plant-based-foods-and-beverages` are ignored, otherwise a bag of flour
  gets filed under drinks. Unmatched products land in **Other Packaged** and are
  listed in the output.
- **Additives are read out of the ingredient text**, by INS/E number
  (`Citric Acid (INS 330)` → E330) and by name. Generic words are deliberately
  not matched, so "vegetable oil" is never silently reported as palm oil.
- **Allergens come from the ingredient list**, not the product name, falling back
  to the name only when no ingredient list is published. The two disagree more
  than you would think.
- **Trans fat is not in the OFF export**, so it is recorded as 0 and each product
  says so in its note. Scores run slightly generous for fried and bakery items.

To test mapping changes without touching the real dataset:

```bash
npx tsx scripts/import-openfoodfacts.ts ./some-test-dir ./out.json
```

---

## Project layout

```
App.tsx                      Root, two-screen stack, Android back handling
src/
  types.ts                   Every data shape in the app
  theme.ts                   Colours, spacing, verdict and risk palettes
  data/
    imported.json            THE DATASET — generated by npm run import
    additives.json           The harmful-ingredient database
    categories.json          Category names and colours
    foods.json               Unused. A curated set kept for reference only —
                             those foods have no barcode, so a scan-only app
                             cannot reach them.
  lib/
    scoring.ts               Safety score + verdict
    quantity.ts              Daily limit, intake breakdown, harmful-or-not
    db.ts                    Loading, normalising, barcode index
  components/                AdditiveRow, IntakePanel, QuantityCalculator, …
  screens/
    ScanScreen.tsx           Camera, barcode lookup, manual entry
    FoodScreen.tsx           Full report for one product
scripts/
  import-openfoodfacts.ts    data/*.json → src/data/imported.json
  validate-data.ts           Dataset checker (npm run validate)
```

SafeBite gives general nutrition guidance from public reference intakes. It is
not medical advice.
