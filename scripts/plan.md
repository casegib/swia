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

17. **Create roll dialog** — new file `scripts/dice/roll-dialog.js`:
    - Pool builder: select attack dice (from actor/weapon) + defense dice (from target)
    - On roll: use Foundry `Roll` API with custom dice (map d8 faces to IA results: damage/surge/accuracy/blank)
    - Result display: total damage, total surge, total accuracy, total block — net damage
    - Surge spending panel: list eligible surge abilities (actor + weapon); clicking one deducts surge and applies effect
    - Keyword automation: Pierce reduces block, Blast creates adjacent damage rolls, Cleave overflow

18. **Wire roll dialog to actor sheet**:
    - Clickable dice blocks on actor sheet trigger roll (attribute test or attack)
    - Files: actor-sheet.hbs (`data-action="rollDice"` on dice block containers), swia-actor-sheet.js (`_onRollDice` action)

19. **Wire roll dialog to portals**:
    - Player Portal and Companion Portal: clicking dice blocks triggers the same roll dialog
    - Files: scripts/player-portal.js, scripts/companion-portal.js

---

## Verification Steps (per phase)

- **Phase 1**: Open browser console after Foundry reload; inspect `game.actors.getName("X").system` for new fields
- **Phase 2**: Open each actor type sheet; confirm new fields render in both view and edit mode; test wounded toggle health reset
- **Phase 3**: Open weapon item; verify accuracy/keyword fields appear; test adding a surge ability with effectType dropdown
- **Phase 4**: Open Campaign Tracker as GM; add a mission row; save; reopen to verify persistence
- **Phase 5**: Roll an attack from the actor sheet; verify dice results dialog opens with correct pool; spend a surge ability and verify it deducts correctly

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
- `scripts/dice/roll-dialog.js` — NEW file (Phase 5)