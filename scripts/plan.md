# SWIA Implementation Plan
## Date: 2026-04-18
## Status: Awaiting implementation

---

## Phase 1 — Schema Fixes (template.json + lang/en.json)
*All steps independent; can run in parallel.*

1. **Imperial actor — add missing stat block fields** to `imperial` in template.json:
   - `traits: ""` (Hunter, Trooper, Droid, etc.)
   - `isElite: false`
   - `reinforceCost: 1`
   - `specialAbilities: []` — array of `{ name: "", description: "" }`
   - `reward: ""` (what heroes earn on defeat)
   - `surgeAbilities: []`

2. **Ally actor — add surge abilities** to `ally.attributes` in template.json:
   - `surgeAbilities: []`

3. **Hero actor — add built-in hero ability** to `hero` in template.json:
   - `heroAbility: { name: "", description: "" }`

4. **Weapon item — add accuracy + keywords** to `weapon` in template.json:
   - `accuracy: 0`
   - `keywords: { pierce: 0, blast: 0, cleave: false, reach: false }`
   - Restructure `surgeAbilities` entries: `{ cost: 1, effectType: "damage", effectValue: 0, effectText: "" }`
   - `effectType` options: `"damage" | "accuracy" | "pierce" | "condition" | "special"`

5. **Class card item — add XP cost + class** to `classcard` in template.json:
   - `xpCost: 0`
   - `heroClass: ""`
   - `abilityText: ""`

6. **Agenda card item — add missing fields** to `agendacard` in template.json:
   - `influenceCost: 0`
   - `agendaType: ""` (Ongoing, Forced, etc.)
   - `missionEffect: ""`

7. **Campaign resources setting — add mission tracking** to `DEFAULT_CAMPAIGN_RESOURCES` in swia.js:
   - `missions: []` — array of `{ id: "", name: "", type: "story|side", outcome: "pending|rebels|imperials", allyUnlocked: "" }`

8. **Add missing lang keys** to lang/en.json for all new fields above.

---

## Phase 2 — Actor Sheet UI (actor-sheet.hbs + swia-actor-sheet.js)
*Steps depend on Phase 1 schema being in place.* ✅ **COMPLETE**

9. **Imperial sheet — render new fields**:
   - Stats section: `isElite` toggle, `traits`, `reinforceCost`, `reward`
   - Special abilities list (add/remove rows, same pattern as weapons inventory)
   - Surge abilities list below attack dice (same pattern as weapon surge abilities)
   - Files: actor-sheet.hbs, swia-actor-sheet.js (`_prepareContext`, `addSpecialAbility`/`removeSpecialAbility` actions)

10. **Ally sheet — render surge abilities**:
    - Reuse imperial surge abilities pattern below attack dice
    - Files: actor-sheet.hbs

11. **Hero sheet — render hero ability**:
    - Read-only text block in stats section (view mode) / editable textarea (edit mode)
    - Files: actor-sheet.hbs

12. **Wounded toggle — auto-reset health**:
    - In `_onToggleWounded` in swia-actor-sheet.js: when flipping to wounded, set `system.woundedAttributes.health.value = system.woundedAttributes.health.max`; when flipping back to healthy, reset `system.attributes.health.value = system.attributes.health.max`

---

## Phase 3 — Item Sheet UI (weapon-sheet.hbs, classcard-sheet.hbs)
*Steps depend on Phase 1 schema.*

13. **Weapon sheet — add accuracy + keywords**:
    - Add `accuracy` number input in edit mode, displayed in view mode next to range
    - Add keyword toggles/inputs: Pierce (number), Blast (number), Cleave (checkbox), Reach (checkbox)
    - Files: templates/items/weapon-sheet.hbs

14. **Weapon sheet — structured surge ability effectType**:
    - Replace freeform `effect` textarea with `effectType` dropdown + `effectValue` number + `effectText` for "special"
    - Files: templates/items/weapon-sheet.hbs, scripts/sheets/swia-item-sheet.js (`_onAddSurgeAbility` default values)

15. **Class card sheet — add text fields**:
    - Currently only shows card image; add: `xpCost`, `heroClass`, `abilityText` textarea in edit mode
    - Files: templates/items/classcard-sheet.hbs, scripts/sheets/swia-item-sheet.js

---

## Phase 4 — Campaign Tracker (campaign-tracker.hbs + campaign-tracker.js)
*Independent of Phases 2–3.*

16. **Add missions section to campaign tracker**:
    - New collapsible section in tracker-form showing mission list
    - Each row: mission name, type badge (story/side), outcome selector (pending/rebels/imperials), ally unlocked field
    - GM can add/remove missions
    - Files: templates/campaign/campaign-tracker.hbs, scripts/campaign-tracker.js

---

## Phase 5 — Dice Roll Dialog (new feature)
*Highest value; depends on Phase 1 schema for surge ability reading.*

*Prior art: the **swia-dice module** (`Data/modules/swia-dice`) already implements custom d6 terms for all six IA dice, DSN presets with face art, and chat face rendering. Phase 5 absorbs it into the system rather than building from scratch, then retires the module.*

17. **Absorb dice terms from swia-dice module** — new file `scripts/dice/dice-terms.js`:
    - Port the six `Die` subclasses from `swia-dice/modules/die.js`, registered in `CONFIG.Dice.terms`
    - **Keep the module's denominations** to preserve existing macros/chat history: `r` red, `n` blue, `g` green, `y` yellow (attack); `b` black, `w` white (defense). All d6.
    - Add a structured `SYMBOLS` table per die: `{face: {damage, surge, accuracy}}` for attack, `{face: {block, evade, dodge}}` for defense — the module only has display labels/filenames; the roll dialog needs machine-readable symbols to total results
    - Copy face art from `swia-dice/images/` into the system (`icons/dice/`); keep `getResultLabel` face images and the chat-render styling fix from `swia-dice/modules/swia.js`
    - Pools remain real Roll formulas (e.g. `2dr + 1dy` vs `1db`)

18. **Dice So Nice integration** — in `scripts/dice/dice-terms.js` (or a small `dsn.js`):
    - Port `addSystem` + `addDicePreset` registration from the module's `diceSoNiceReady` hook, pointed at the system's copied face art
    - **Fix the hard dependency**: the module does a top-level `import` from `dice-so-nice/api.js`, so the whole script (terms included) dies if DSN is disabled. Instead, do all DSN work inside the `diceSoNiceReady` hook (use `dice3d` API / `game.modules.get("dice-so-nice")` — no static import)
    - Detect the swia-dice module at startup; if active, warn GM to disable it (duplicate denomination registration)

19. **Create roll dialog** — new file `scripts/dice/roll-dialog.js`:
    - Pool builder: select attack dice (from actor/weapon) + defense dice (from target)
    - On roll: evaluate via Foundry `Roll` API using the custom dice terms from step 17
    - Result display via the `SYMBOLS` table: total damage, total surge, total accuracy, total block — net damage *(the gap the module never filled; its totaling code is commented-out leftovers from another system)*
    - Surge spending panel: list eligible surge abilities (actor + weapon); clicking one deducts surge and applies effect
    - Keyword automation: Pierce reduces block, Blast creates adjacent damage rolls, Cleave overflow

20. **Wire roll dialog to actor sheet**:
    - Clickable dice blocks on actor sheet trigger roll (attribute test or attack)
    - Files: actor-sheet.hbs (`data-action="rollDice"` on dice block containers), swia-actor-sheet.js (`_onRollDice` action)

21. **Wire roll dialog to portals**:
    - Player Portal and Companion Portal: clicking dice blocks triggers the same roll dialog
    - Files: scripts/player-portal.js, scripts/companion-portal.js

---

## Verification Steps (per phase)

- **Phase 1**: Open browser console after Foundry reload; inspect `game.actors.getName("X").system` for new fields
- **Phase 2**: Open each actor type sheet; confirm new fields render in both view and edit mode; test wounded toggle health reset
- **Phase 3**: Open weapon item; verify accuracy/keyword fields appear; test adding a surge ability with effectType dropdown
- **Phase 4**: Open Campaign Tracker as GM; add a mission row; save; reopen to verify persistence
- **Phase 5**: Disable the swia-dice module first. Roll an attack from the actor sheet; verify dice results dialog opens with correct pool; spend a surge ability and verify it deducts correctly; with DSN enabled, confirm 3D dice show IA faces; with DSN disabled, confirm rolls still resolve (terms must not depend on DSN); confirm old chat messages and macros using `r/n/g/y/b/w` formulas still render

---

## Deliberately Out of Scope (this plan)
- Combat encounter/initiative system (separate Foundry Combat integration)
- Token HUD controls
- Automated condition enforcement (bleeding damage per round, etc.) — Phase 5 follow-on
- Power token spending in roll dialog — Phase 5 follow-on
- Campaign log / session notes field

---

## Key Files
- `template.json` — all schema changes (Phases 1, 3)
- `lang/en.json` — all new string keys
- `templates/actors/actor-sheet.hbs` — imperial/ally/hero new UI (Phase 2)
- `scripts/sheets/swia-actor-sheet.js` — new action handlers, wounded health reset (Phase 2)
- `templates/items/weapon-sheet.hbs` — accuracy/keywords/structured surges (Phase 3)
- `templates/items/classcard-sheet.hbs` — text fields (Phase 3)
- `scripts/sheets/swia-item-sheet.js` — updated save/collect logic (Phase 3)
- `templates/campaign/campaign-tracker.hbs` — missions section (Phase 4)
- `scripts/campaign-tracker.js` — missions persistence (Phase 4)
- `scripts/dice/dice-terms.js` — NEW file: IA die terms + SYMBOLS table + DSN presets, ported from swia-dice module (Phase 5)
- `scripts/dice/roll-dialog.js` — NEW file (Phase 5)
- `icons/dice/` — face art copied from `Data/modules/swia-dice/images/` (Phase 5)
- `Data/modules/swia-dice` — RETIRED once Phase 5 ships (system absorbs terms, chat rendering, and DSN presets)