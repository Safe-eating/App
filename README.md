# SafeBite

A React Native (Expo) app that answers three questions about any everyday food:

1. **Is it safe to eat?** — a 0–100 safety score and a plain-language verdict.
2. **What is harmful in it?** — every additive broken down: what it is, why it matters, reported effects, and where it is banned.
3. **How much won't hurt me?** — a derived daily limit plus a portion calculator.

Foods are organised into 10 browsable categories and are fully searchable.

---

## Running it

```bash
npm install
npm start
```

Then scan the QR code with the **Expo Go** app on your phone, or press `a` for an Android emulator.

No phone? Run it in a browser instead:

```bash
npm run web
```

### ⚠️ Do not upgrade the Expo SDK past 54 without checking Expo Go first

This project is deliberately pinned to **Expo SDK 54**.

Modern Expo Go supports exactly **one** SDK version, and as of August 2026 the
Play Store / App Store build of Expo Go is still on SDK 54 — Expo Go for SDK 57
[has not been approved for the stores yet](https://expo.dev/changelog/sdk-57).
A project on SDK 55+ therefore fails on a store-installed Expo Go with:

> Project is incompatible with this version of Expo Go

and no amount of updating Expo Go fixes it. If you do want a newer SDK, you have
to stop using Expo Go and make a [development build](https://docs.expo.dev/develop/development-builds/introduction/)
instead — `npx expo run:android` locally, or EAS Build in the cloud.

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Open on a connected Android device or emulator |
| `npm run import` | **Convert `data/*.json`** (Open Food Facts) into the app's schema |
| `npm run validate` | **Check the dataset** — integrity, scores, search spot-checks |
| `npm run typecheck` | TypeScript check with no emit |

---

## How the safety score works

Nothing is hardcoded. Every food **starts at 100** and the engine in
[`src/lib/scoring.ts`](src/lib/scoring.ts) adds and subtracts from there, returning
each adjustment as a labelled factor so the app can show the user exactly why a
food scored what it did.

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
guidance on trans fat and sodium. Sugar in whole and minimally processed food
(fruit, milk) is treated as natural rather than added, so an apple is not
penalised the way a biscuit is.

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

The result is then tightened by the safety verdict (avoid ×0.5, limit ×0.75), so
a food that is bad for reasons beyond one nutrient still gets a strict limit.
A food can override all of this with an explicit `safeLimit` in the dataset.

---

## Your Open Food Facts dataset

Barcode-keyed product dumps go in `data/` (one JSON file per product, exactly the
shape already there). Then:

```bash
npm run import     # data/*.json  →  src/data/imported.json
npm run validate   # check the result and see the scores
```

`scripts/import-openfoodfacts.ts` does the mapping. The parts worth knowing:

- **Sodium is converted.** Open Food Facts stores `sodium` and `salt` in *grams*
  per 100 g; the app uses milligrams, so it multiplies by 1000 (falling back to
  `salt × 400` when sodium is absent).
- **Categories come from the taxonomy tags, read most-specific first.** OFF lists
  tags general → specific, so `en:paneer` decides the category rather than
  `en:dairies`. Umbrella tags like `en:plant-based-foods-and-beverages` are
  ignored outright — otherwise a bag of flour gets filed under drinks. Anything
  unmatched lands in **Other Packaged** and is listed in the import output so you
  can add a rule to `CATEGORY_RULES`.
- **Additives are read out of the ingredient text**, both by INS/E number
  (`Citric Acid (INS 330)` → E330) and by name. Generic words are deliberately
  *not* matched, so "vegetable oil" is never silently reported as palm oil.
- **Processing level comes from `nova_group`**, and is inferred from the
  ingredient list when NOVA is null.
- **Products with no nutrition data are skipped**, and listed in the output.
  This is deliberate: missing values read as 0, a food of all zeroes collects no
  penalties, and it would score a confident **100/100 "Safe to eat"**. A record
  with no numbers cannot answer any question this app asks.
- **Allergens come from the ingredient list**, not the product name, and only
  fall back to the name when no ingredient list is published. The two disagree:
  "Rava Idli Batter" is named after a wheat-semolina dish but is actually made
  with *idli rava*, which is rice. Every auto-detected allergen carries a
  "check the pack" caveat in its note.
- **Trans fat is not in the OFF export**, so it is recorded as 0 and each
  imported food says so in its note. This makes scores slightly generous for
  fried and bakery products.
- Benefits and warnings are generated from the nutrition figures.

To test mapping changes without touching the real dataset, point the importer
somewhere else:

```bash
npx tsx scripts/import-openfoodfacts.ts ./some-test-dir ./out.json
```

Imported foods are merged with the curated set at load time, and a barcode in
`imported.json` overrides a curated entry with the same id. Re-running the import
is safe — it rebuilds the file from whatever is in `data/`.

## Swapping the whole dataset

All food knowledge lives in these JSON files, and nothing else in the app needs
touching:

```
src/data/
  foods.json       ← curated food items (hand-written)
  imported.json    ← generated by `npm run import` — do not edit by hand
  additives.json   ← the harmful-ingredient database
  categories.json  ← the categories foods are grouped into
```

The full field-by-field schema is in [`src/data/SCHEMA.md`](src/data/SCHEMA.md).

After replacing them, run:

```bash
npm run validate
```

which checks that every id is unique, every `categoryId` and additive reference
resolves, and every food has nutrition and a serving size — then prints the score
and daily limit every food ends up with so you can sanity-check the results.

`src/lib/db.ts` normalises the incoming data (missing optional arrays, `null`
instead of an absent key), so a hand-authored file does not need to be perfect.

---

## Project layout

```
App.tsx                      Root, navigation stack, Android back handling
src/
  types.ts                   Every data shape in the app
  theme.ts                   Colours, spacing, verdict and risk palettes
  data/                      THE DATASET — swap these three files
  lib/
    scoring.ts               Safety score + verdict
    quantity.ts              Daily limit + portion impact
    db.ts                    Loading, normalising, indexing, search
  components/                SearchBar, FoodCard, AdditiveRow, ScoreDial, …
  screens/
    HomeScreen.tsx           Search + category grid + best/worst lists
    CategoryScreen.tsx       Foods in one category, sortable
    FoodScreen.tsx           Full breakdown for one food
scripts/
  validate-data.ts           Dataset checker (npm run validate)
```

---

## A note on the data

The bundled dataset is a hand-built starter set of **59 foods and 34 additives**
covering fruit, vegetables, chips and namkeen, drinks, dairy, bakery, protein
foods, sweets, instant and frozen food, and sauces. Nutrition figures are typical
values for the category rather than any single brand's label.

SafeBite gives general nutrition guidance from public reference intakes. It is
not medical advice.
