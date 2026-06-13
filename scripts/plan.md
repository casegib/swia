# SWIA Implementation Plan
## Date: 2026-04-18 (revised 2026-06-11)
## Status: ✅ ALL PHASES COMPLETE (2026-06-11). The swia-dice module can now be retired — disable it in Module Management.

> **Note (2026-06-11):** template.json has been deleted — the system now uses Foundry v13 TypeDataModels. All Phase 1 schema lives in `scripts/data/actors.js`, `scripts/data/items.js`, `scripts/data/common.js`. The actor type is **`villain`** (not `imperial` as originally written); types are hero / villain / ally / character.

---

## Phase 1 — Schema Fixes ✅ **COMPLETE** (shipped as DataModels, not template.json)
*All fields below exist in the data models; locations noted per item.*

1. **Villain actor — stat block fields** — in `UnitData` (`scripts/data/actors.js`), shared with ally:
   - `traits: ""` (Hunter, Trooper, Droid, etc.)
   - `isElite: false`
   - `reinforceCost: 1`
   - `specialAbilities: []` — array of `{ name: "", description: "" }`
   - `reward: ""` (what heroes earn on defeat)
   - `surgeAbilities: []`

2. **Ally actor — surge abilities** — in `UnitData.defineAttributes()` (`scripts/data/actors.js`):
   - `surgeAbilities: []`

3. **Hero actor — built-in hero ability** — shipped as `heroAbilities` / `woundedHeroAbilities` lists in `HeroData` (`scripts/data/actors.js`), richer than originally planned:
   - ~~`heroAbility: { name: "", description: "" }`~~ → ability lists with `sourceUuid` linking to heroability items

4. **Weapon item — accuracy + keywords** — in `WeaponData` (`scripts/data/items.js`), builders in `common.js`:
   - `accuracy: 0`
   - `keywords: { pierce: 0, blast: 0, cleave: false, reach: false }`
   - Restructure `surgeAbilities` entries: `{ cost: 1, effectType: "damage", effectValue: 0, effectText: "" }`
   - `effectType` options: `"damage" | "accuracy" | "pierce" | "condition" | "special"`

5. **Class card item — XP cost + class** — in `ClasscardData` (`scripts/data/items.js`):
   - `xpCost: 0`
   - `heroClass: ""`
   - `abilityText: ""`

6. **Agenda card item — missing fields** — in `AgendacardData` (`scripts/data/items.js`):
   - `influenceCost: 0`
   - `agendaType: ""` (Ongoing, Forced, etc.)
   - `missionEffect: ""`

7. **Campaign resources setting — mission tracking** — in `DEFAULT_CAMPAIGN_RESOURCES` (`swia.js`); UI is Phase 4:
   - `missions: []` — array of `{ id: "", name: "", type: "story|side", outcome: "pending|rebels|imperials", allyUnlocked: "" }`

8. **Lang keys** — added to lang/en.json.

---

## Phase 2 — Actor Sheet UI (actor-sheet.hbs + swia-actor-sheet.js)
*Steps depend on Phase 1 schema being in place.* ✅ **COMPLETE**

9. **Villain sheet — render new fields**:
   - Stats section: `isElite` toggle, `traits`, `reinforceCost`, `reward`
   - Special abilities list (add/remove rows, same pattern as weapons inventory)
   - Surge abilities list below attack dice (same pattern as weapon surge abilities)
   - Files: actor-sheet.hbs, swia-actor-sheet.js (`_prepareContext`, `addSpecialAbility`/`removeSpecialAbility` actions)

10. **Ally sheet — render surge abilities**:
    - Reuse villain surge abilities pattern below attack dice
    - Files: actor-sheet.hbs

11. **Hero sheet — render hero ability**:
    - Read-only text block in stats section (view mode) / editable textarea (edit mode)
    - Files: actor-sheet.hbs

12. **Wounded toggle — auto-reset health**:
    - In `_onToggleWounded` in swia-actor-sheet.js: when flipping to wounded, set `system.woundedAttributes.health.value = system.woundedAttributes.health.max`; when flipping back to healthy, reset `system.attributes.health.value = system.attributes.health.max`

---

## Phase 3 — Item Sheet UI (weapon-sheet.hbs, classcard-sheet.hbs) ✅ **COMPLETE**
*Shipped 2026-06-11. Notes: weapon surge rows save via DOM scrape (`_collectWeaponSurgeUpdate`, formcard pattern) with unnamed inputs to avoid the expandObject array bug; classcard template is shared with agendacard/imperialclasscard so new fields gate on `item.type`. Lang lesson learned: en.json had pre-seeded nested keys (`SurgeEffectType.*`) — adding a flat key with the same prefix breaks the ENTIRE lang file at boot (expandObject collision). Always audit before adding keys.*

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

## Phase 4 — Campaign Tracker (campaign-tracker.hbs + campaign-tracker.js) ✅ **COMPLETE**
*Shipped 2026-06-11. Missions persist in the `campaignResources` setting; rows normalized on read (stable `randomID` ids, validated type/outcome enums); add/remove preserves unsaved row edits; scraper returns null when the section isn't rendered so saves can't wipe the array.*

16. **Add missions section to campaign tracker**:
    - New collapsible section in tracker-form showing mission list
    - Each row: mission name, type badge (story/side), outcome selector (pending/rebels/imperials), ally unlocked field
    - GM can add/remove missions
    - Files: templates/campaign/campaign-tracker.hbs, scripts/campaign-tracker.js

---

## Phase 5 — Dice Roll Dialog (new feature) ✅ **COMPLETE**
*Shipped 2026-06-11 and verified in play. Implementation notes & deviations from the plan below:*

- **CRITICAL lesson:** Foundry resolves dice term classes **by class name** when parsing/deserializing rolls. Factory-generated classes sharing one name all collapse to the first registered term (everything rolled red). Each class gets a unique name via `Object.defineProperty(cls, "name", ...)`.
- Surge spending happens on the **chat card** (buttons update message flags + re-render content), not in the dialog — works after the dialog closes, restricted to roller/GM.
- Blast/Cleave ship as **reminder lines with values** on the card, not automated adjacent rolls (adjacency needs board logic — out of scope). Pierce IS automated (reduces block), evades cancel surges, white-die dodge zeroes the attack.
- Added a `defense` roll type (click your own defense block) and a dedicated **Weapon Attack** button for heroes on sheet + portals, since heroes have no innate attack block to click.
- Surge effect text may contain inline `<img>` icons — card renders labels unescaped with CSS constraining icons to text height.

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
    - **Pool sources differ by roll type** (heroes have no innate attack pool):
      - *Hero attack*: equipped weapon's `WeaponData.attackDice` + attached mods' `WeaponmodData.bonusDice`; needs equipped-weapon detection via item state (ready/exhausted/depleted) and mod aggregation
      - *Villain/ally attack*: `attributes.attack` directly (villains: use active form card's pool if Shift is active)
      - *Hero attribute test*: `attributes.strength`/`insight`/`tech` (or `woundedAttributes.*` when wounded) — tests just count surges, no defense pool
      - *Defense*: target's `attributes.defense` via `game.user.targets`; manual fallback when nothing targeted
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

## Phase 6 — Shared Combat Window (attacker vs defender) ✅ **BUILT 2026-06-12** (awaiting play verification)
*IA combat is attacker-and-defender; the Phase 5 roller is one-sided (attacker rolls both pools). Phase 6 is a single shared window the whole table sees and interacts with. Design decisions (agreed 2026-06-12): both pools roll simultaneously per IA rules (defender adjusts/reacts BEFORE the roll); damage applies via confirm button after surge spending; window auto-opens for GM + attacker owner + defender owner (button for spectators); defender power tokens (block/evade) included.*

**Architecture** — compose from what exists, don't rebuild:
- State lives in a world setting `swia.activeCombat`; every client's window re-renders via the `updateSetting` hook (campaign-tracker pattern). One active combat at a time.
- All mutations are socket intents executed by the active GM client (extends the Phase 5 surge-relay): adjustPool, roll, spendSurge, spendPowerToken, applyDamage. GM client validates by role — attacker-side actions need attacker ownership or GM; defender-side likewise. No GM online → warn (existing pattern).
- Roll mechanics reused from `roll-dialog.js`: extract pool-building, surge-ability gathering (structured + text-parsed + special abilities + legacy icon-led weapon rows), and `recomputeCard` math into exported helpers shared by both the solo dialog and the combat window.

**Flow:**
22. **Initiate**: an attack roll with a targeted token starts a combat instead of the solo dialog (tests/defense/untargeted attacks keep the solo dialog). Setting written (GM-relayed if a player initiates); windows auto-open for the involved parties.
23. **Setup phase**: attacker panel (weapon selector, pool, keywords, accuracy — editable by attacker/GM) vs defender panel (defense pool + available power tokens — editable by defender/GM). Either side can ready; attacker or GM clicks Roll.
24. **Roll**: GM client evaluates BOTH pools at once (IA simultaneous roll); faces/totals/net damage rendered center; DSN animates via a chat message carrying the rolls (speaker = attacker).
25. **Reaction phase**: attacker surge panel (all Phase 5 sources); defender spends block/evade power tokens (consumes the status effect via relay); every change recomputes live on all clients.
26. **Resolve**: Apply Damage button (GM or attacker owner) with confirm → writes net damage to defender health via relay, posts a summary chat card to the log, clears `activeCombat`.

**Files**: `scripts/dice/combat-window.js` + `templates/dice/combat-window.hbs` (new); `scripts/dice/roll-dialog.js` (extract shared helpers); `scripts/swia.js` (setting registration, auto-open hook, spectator button alongside portal buttons); lang + CSS.

**Out of scope for Phase 6**: rerolls (Focused), Blast/Cleave auto-application to additional figures, initiative / Foundry Combat tracker integration, multiple simultaneous combats.

---

## Verification Steps (per phase)

- **Phase 1**: ✅ done — fields ship via DataModels with validation; spot-check with `game.actors.getName("X").system` in console
- **Phase 2**: ✅ done
- **Phase 3**: ✅ done — verified in play (accuracy/keywords/structured surges render and save)
- **Phase 4**: ✅ done — missions persist across save/reopen
- **Phase 5**: ✅ done — verified in play: dialog pools pre-fill correctly, 3D DSN dice show per-color IA faces, card totals/net damage correct, surge spending deducts and applies. Remaining manual checks if issues arise: DSN disabled fallback; legacy `r/n/g/y/b/w` macros. Note: chat messages rolled before the class-name fix may render oddly — safe to delete.
- **Phase 6**: GM + 2 player clients. Player A targets player B's token (or an Imperial) and attacks → window opens on all three; defender adjusts pool pre-roll; Roll fires both pools at once with DSN; attacker spends a surge, defender spends an evade power token, totals recompute on every client; Apply Damage confirms and reduces defender health; summary card lands in chat; combat clears everywhere. Repeat with no GM connected → clear warning, no broken state.

---

## Deliberately Out of Scope (this plan)
- Initiative / Foundry Combat tracker integration (combat *resolution* is now Phase 6)
- Token HUD controls
- Automated condition enforcement (bleeding damage per round, etc.)
- ~~Power token spending in roll dialog~~ → defender power tokens land in Phase 6
- Campaign log / session notes field

---

## Key Files
- `scripts/data/actors.js` / `scripts/data/items.js` / `scripts/data/common.js` — all schema (Phase 1 ✅; replaces deleted template.json)
- `lang/en.json` — all new string keys
- `templates/actors/actor-sheet.hbs` — villain/ally/hero new UI (Phase 2 ✅)
- `scripts/sheets/swia-actor-sheet.js` — new action handlers, wounded health reset (Phase 2)
- `templates/items/weapon-sheet.hbs` — accuracy/keywords/structured surges (Phase 3)
- `templates/items/classcard-sheet.hbs` — text fields (Phase 3)
- `scripts/sheets/swia-item-sheet.js` — updated save/collect logic (Phase 3)
- `templates/campaign/campaign-tracker.hbs` — missions section (Phase 4)
- `scripts/campaign-tracker.js` — missions persistence (Phase 4)
- `scripts/dice/dice-terms.js` — IA die terms + SYMBOLS table + DSN presets, ported from swia-dice module (Phase 5 ✅)
- `scripts/dice/roll-dialog.js` — roll dialog + chat card surge spending (Phase 5 ✅)
- `templates/dice/roll-dialog.hbs` / `templates/dice/roll-card.hbs` — dialog + chat card templates (Phase 5 ✅)
- `icons/dice/` — face art copied from `Data/modules/swia-dice/images/` (Phase 5 ✅)
- `Data/modules/swia-dice` — **RETIRE NOW**: system absorbs terms, chat rendering, and DSN presets; GM warning fires if both are active