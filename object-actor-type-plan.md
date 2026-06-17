# Plan: Add an "object" Actor Type to SWIA

**Goal:** Add a new general-purpose `object` Actor type for Imperial Assault map objects — destructible things (crates, doors, terminals with health/defense) *and* purely interactive mission tokens (no combat stats). Most fields optional so one type serves both.

**Sheet decision:** New dedicated `SWIAObjectSheet` + `object-sheet.hbs`, following the existing `SWIACharacterSheet` precedent. The main `SWIAActorSheet` (~1,300 lines) is built entirely around combat (dice, wounded/defeated/activation, surge abilities, Shift forms, inventory) and would need heavy `type === "object"` branching to reuse. A small standalone sheet is cleaner and lower-risk.

**Scope:** Code only. No compendium/pack content. Existing worlds are unaffected (additive change — no migration needed).

---

## Data schema (the new `object` type)

A flat, mostly-optional schema so it covers both destructible and interactive objects:

- `biography` — html (description / GM notes), from `SWIAActorBase`.
- `attributes.health` — `resource(0, 0)` — a `{value, max}` pool. Default 0/0 so non-destructible objects simply leave it empty.
- `attributes.defense` — `defenseDice()` — black/white dice for destructible objects; zeroes by default.
- `objectType` — `str("")` — free-text tag (e.g. "Terminal", "Door", "Crate") for the GM's own labeling.
- `traits` — `str("")` — mirrors the existing `UnitData.traits` convention.
- `interactable` — `bool(false)` — flags an interactive mission token.
- `interactionText` — `html()` — what happens on interaction / the test required (e.g. "Tech to disable").
- `objectState` — `str("default")` — free-text current state ("locked"/"open", "armed"/"disabled", "intact"/"destroyed"). Left as a plain string (no `choices`) to match this codebase's deliberately permissive field style.

Deliberately **omitted**: speed, attack dice, surge, activation/wounded state, deploy/reinforce cost, abilities lists — objects don't activate or attack. `primaryTokenAttribute` in `system.json` is `attributes.health`, which this schema still satisfies, so token bars work for destructible objects with zero config.

---

## Files to change

### 1. `system.json` — declare the document type
Add `"object": {}` to `documentTypes.Actor` alongside hero/villain/ally/character. This is the only place Foundry learns the type exists.

### 2. `scripts/data/actors.js` — define & export the schema
Add an `ObjectData extends SWIAActorBase` class. Override `defineAttributes()` to return only `{ health: resource(0,0), defense: defenseDice() }` (drop the base `speed`), and add the object-specific top-level fields above in `defineSchema()`. Export `ObjectData`.

### 3. `scripts/swia.js` — register the model and the sheet
- Add `ObjectData` to the `import { ... } from "./data/actors.js"` line.
- Add `object: ObjectData` to the `Object.assign(CONFIG.Actor.dataModels, { ... })` block.
- `import { SWIAObjectSheet } from "./sheets/swia-object-sheet.js";`
- Register the sheet (mirroring the Character registration):
  ```js
  ActorsCollection.registerSheet("swia", SWIAObjectSheet, {
    types: ["object"],
    makeDefault: true
  });
  ```
- Add the new template to the `loadTemplatesFn([...])` preload list:
  `"systems/swia/templates/actors/object-sheet.hbs"`.

### 4. `scripts/sheets/swia-object-sheet.js` — new file
New `SWIAObjectSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)`, modeled on `swia-character-sheet.js` (the smallest existing sheet). Needs:
- `DEFAULT_OPTIONS` with `classes: ["swia", "sheet", "actor"]`, a modest `position` (e.g. 480x520 — objects are simple), `form.submitOnChange: true`.
- A GM-only edit-mode toggle action if we want to match the read/edit pattern of the other sheets (optional for v1 — can ship view+inline-edit only).
- `PARTS.form.template = "systems/swia/templates/actors/object-sheet.hbs"`.
- `_prepareContext()` exposing `system`, an editable flag, and dice-count arrays for the defense block (reuse the small `_diceArray` helper pattern).
- `editImage` / `changeName` actions if we want parity with the other sheets' header.

### 5. `templates/actors/object-sheet.hbs` — new file
Lightweight sheet: portrait + name header, an "Object Type"/traits/state row, a health resource (value/max) input, a defense-dice block, an `interactable` checkbox that reveals the `interactionText` editor, and the biography editor. Reuse the existing CSS classes from `actor-sheet.hbs`/`character-sheet.hbs` so styling comes for free; add object-specific rules to `styles/swia.css` only if needed.

### 6. `lang/en.json` — labels
- Add `"TYPES.Actor.object": "Object"` so the Create-Actor dialog shows a clean name. (Note: only `character` currently has a `TYPES.Actor.*` entry — hero/villain/ally fall back to raw keys. Adding this one is low-effort and correct; optionally backfill the others while here.)
- Add any `SWIA.Object.*` keys used by the new template (field labels, placeholders).

---

## Out of scope / non-goals
- No data migration (purely additive; no existing actors are `object`).
- No changes to combat window, portals, campaign tracker, or dice logic — objects don't participate in those. Confirm none of them iterate actor types in a way that breaks on an unknown type (quick grep during implementation; `preCreateToken` already early-returns for non-`character` types, so it's safe).
- No compendium/pack objects shipped.

## Verification checklist
1. `node --check` on `scripts/swia.js`, `scripts/data/actors.js`, and `scripts/sheets/swia-object-sheet.js` (per MEMORY.md: trust disk over the editor view in this folder).
2. Validate `system.json` and `lang/en.json` parse as JSON.
3. In Foundry v13: create a new Actor → "Object" type appears in the dropdown; the sheet opens; health/defense/interaction fields save and persist across reload; token health bar reflects `attributes.health` for a destructible object.
4. Confirm existing hero/villain/ally/character actors still open unchanged.

## Rough effort
~2 small new files + 4 edits. Low risk, fully additive. The bulk of the work is the sheet template/JS; everything else is a few lines each.
