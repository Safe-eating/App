# Dataset schema

Three files. Replace them with your own data and the whole app follows — no
screen, component or scoring rule needs editing.

Run `npm run validate` after any change.

---

## `categories.json`

An array. Foods point at these by `id`.

```jsonc
{
  "id": "snacks",              // unique, lowercase, no spaces
  "name": "Chips & Snacks",    // shown on the card
  "emoji": "🍟",
  "blurb": "Crisps, namkeen and nuts",
  "color": "#E08A1E"           // hex, used for the category tint
}
```

---

## `additives.json`

An array — the harmful-ingredient database. Foods reference these by `id`.
These are searchable on their own, so an additive that no food currently uses is
still worth including.

```jsonc
{
  "id": "e621",                          // unique
  "name": "Monosodium Glutamate",
  "code": "E621",                        // INS/E number, "" if it has none
  "aliases": ["msg", "ajinomoto"],       // lowercase; makes search forgiving
  "class": "Flavour enhancer",           // functional class
  "risk": "moderate",                    // safe | low | moderate | high
  "what": "One or two sentences: what this substance actually is.",
  "why":  "One or two sentences: why it matters for health.",
  "effects": ["Headache", "Flushing"],   // shown as chips
  "adi": "No numerical limit set, but keep below about 1 g in a meal",
  "restrictedIn": ["EU (warning label required)"]   // [] if nowhere
}
```

**`risk` drives the score:** `high` −18, `moderate` −9, `low` −3, `safe` 0
(all additives together are capped at −45).

Include genuinely safe ones too (citric acid, vitamin C, guar gum). A food
listing only safe additives reads far more credibly than one listing none.

---

## `foods.json`

An array — the food items.

```jsonc
{
  "id": "potato-chips",                  // unique, kebab-case
  "name": "Potato Chips (Salted)",
  "brand": "Packaged crisps",            // brand or "Fresh produce"
  "categoryId": "snacks",                // must exist in categories.json
  "emoji": "🍟",

  // whole | minimally-processed | processed | ultra-processed
  // Big score impact: 0 / −3 / −11 / −22, and `whole` earns +5.
  "processing": "ultra-processed",

  // Extra search terms: regional names, brand names, common misspellings.
  "keywords": ["chips", "crisps", "wafers", "lays"],

  "serving": {
    "amount": 30,
    "unit": "g",                         // "g" or "ml" — use ml for drinks
    "label": "1 small pack (30 g)"       // shown to the user
  },

  // Optional. ONE countable unit, letting the user enter "3 biscuits" instead
  // of "30 g". Note this is NOT the serving: a serving is often several pieces.
  // Omit or set null for anything you cannot count — spinach, a block of
  // paneer, loose peanuts. Those foods just show the weight input.
  "piece": { "amount": 10, "name": "biscuit", "plural": "biscuits" },

  // ALWAYS per 100 g (or per 100 ml for drinks). All nine keys required.
  "nutrition": {
    "energyKcal": 536,
    "fatG": 34.6,
    "satFatG": 3.1,
    "transFatG": 0.2,
    "carbsG": 53,
    "sugarG": 0.3,
    "fibreG": 4.4,
    "proteinG": 7,
    "sodiumMg": 525                      // sodium in mg, NOT salt in g
  },

  "additives": ["e621", "e319"],         // ids from additives.json
  "allergens": ["milk", "peanuts"],      // lowercase; [] if none
  "benefits": ["..."],                   // green bullets
  "warnings": ["..."],                   // red bullets
  "note": "One paragraph of the most useful thing to know.",

  // Optional. Omit or set null to let the app derive the limit from nutrition.
  // Use it when a real-world rule beats the calculation (e.g. one energy drink).
  "safeLimit": null
}
```

### Getting it right

- **Sodium, not salt.** If your source gives salt in grams: `sodium_mg = salt_g × 400`.
- **Per 100 g, always.** If your source is per serving, convert:
  `per100 = per_serving ÷ serving_grams × 100`.
- **Drinks use `ml`** for both `serving.unit` and the nutrition basis.
- **`transFatG` should be industrial trans fat.** Ruminant trans fat in butter
  and dairy does not behave the same way — leave it at 0 and mention it in `note`.
- **Missing fields become 0**, which will quietly inflate the score. The
  validator flags absent nutrition, so run it.

---

## Converting a CSV or Excel dataset

Write a one-off script that maps your columns onto the shapes above and writes
`foods.json`. Sketch:

```js
const fs = require('fs');
const rows = require('./my-dataset.json');   // or parse your CSV

const foods = rows.map((r) => ({
  id: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  name: r.name,
  brand: r.brand || 'Generic',
  categoryId: mapCategory(r.category),       // your mapping to our 10 ids
  emoji: '🍽️',
  processing: r.nova >= 4 ? 'ultra-processed' : 'processed',
  keywords: [],
  serving: { amount: 100, unit: 'g', label: '100 g' },
  nutrition: {
    energyKcal: +r.energy_kcal || 0,
    fatG: +r.fat || 0,
    satFatG: +r.saturated_fat || 0,
    transFatG: +r.trans_fat || 0,
    carbsG: +r.carbohydrates || 0,
    sugarG: +r.sugars || 0,
    fibreG: +r.fiber || 0,
    proteinG: +r.proteins || 0,
    sodiumMg: Math.round((+r.salt || 0) * 400),
  },
  additives: parseAdditives(r.additives_tags),  // e.g. "en:e621" → "e621"
  allergens: [], benefits: [], warnings: [], note: '', safeLimit: null,
}));

fs.writeFileSync('src/data/foods.json', JSON.stringify(foods, null, 2));
```

Then `npm run validate` and read the printed scores — if something ranks
obviously wrong, the input data is usually the reason.
