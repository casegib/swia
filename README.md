# Star Wars Imperial Assault (Foundry VTT System Scaffold)

Unofficial system scaffold targeting Foundry VTT v13.351. Focus is on actor sheets for heroes, villains, allies, and generic characters. This is a starting point—replace placeholder assets and flesh out rules and item automation as needed.

## Install (local dev)
1. Clone or copy this folder into your Foundry `Data/systems/swia` directory.
2. Launch Foundry VTT (v13.351) and enable the `Star Wars Imperial Assault` system for a world.

## Current Features
- Actor types: `hero`, `villain`, `ally`, and `character` with system-specific attribute schemas.
- Hero healthy/wounded state toggle with separate wounded attributes and biography.
- Activation token toggle on actor sheets.
- GM edit mode for actor and item sheets (including portrait/token/card image updates).
- Villain token footprint controls (preset buttons + manual width/height/scale) for massive multi-grid figures.
- Owned item support with item types: `weapon`, `weaponmod`, `armor`, `gear`, `classcard`, `agendacard`, `imperialclasscard`, `heroability`, `formcard`.
- Dedicated item sheets for all item types, including weapon surge ability rows and card state cycling (`ready` -> `exhausted` -> `depleted`).
- Actor inventory side-panel tabs (Abilities, Items/Gear, Weapons) with open/delete/cycle-state controls.
- Automated schema migration from legacy `ability` items to `classcard` on world load.
- Four portal applications: Player Portal, Companion Portal, Imperial Portal, and GM Portal.
- Campaign Tracker with shared resource tracking (credits, XP, imperial influence, threat, requisition) and per-hero XP.
- Round state tracking: current round, phase (`activation` / `status`), and ordered activation queue.
- Custom status effects (weakened, stunned, bleeding, focused, hidden, blind, scanned, recon, wanted) and power token icons (block, damage, evade, surge, any) registered in the system.
- Built-in Imperial Assault dice: custom attack dice (red, blue, green, yellow) and defense dice (black, white) registered as `CONFIG.Dice.terms` with per-face symbol tables and face icons.
- `SWIARollDialog` for attack, attribute test, and defense rolls, building dice pools from weapons, weapon mods, and attributes with keyword and accuracy display.
- Roll chat cards with spendable surge abilities gathered from weapons, weapon mods, form cards, and special abilities.
- Shared `SWIACombatWindow` attacker-vs-defender flow synced to all clients via the `swia.activeCombat` world setting and the `updateSetting` hook.
- GM socket relay (`system.swia`) for permission-checked surge and power token spends, per-die rerolls, and damage application.
- Power token (block/evade) consumption and wounded-aware damage application to actor health.
- Dice So Nice! integration for 3D dice, plus a startup warning if the legacy external `swia-dice` module is still active.
- Foundry v13+ ApplicationV2 sheets with TypeDataModel schemas.

## File Map
- `system.json` – system manifest; update `manifest`, `download`, `url` when publishing. Document types declared under `documentTypes`.
- `scripts/data/actors.js` – TypeDataModel schemas for actor types: `hero`, `villain`, `ally`, `character`.
- `scripts/data/items.js` – TypeDataModel schemas for item types: `weapon`, `weaponmod`, `armor`, `gear`, `classcard`, `agendacard`, `imperialclasscard`, `heroability`, `formcard`.
- `scripts/data/common.js` – Shared field builders and helpers for data model definitions.
- `scripts/dice/dice-terms.js` – Custom Imperial Assault dice term definitions, symbol tables, face icons, Dice So Nice presets, chat rendering hooks, and legacy module detection.
- `scripts/dice/roll-dialog.js` – `SWIARollDialog` and shared pool-building helpers; roll chat cards with surge spending and the GM socket relay.
- `scripts/dice/combat-window.js` – `SWIACombatWindow` shared attacker-vs-defender combat synced via the `swia.activeCombat` world setting.
- `scripts/swia.js` – system entry point; registers data models, sheets, status effects, settings, dice terms, combat hooks, and Handlebars helpers.
- `scripts/campaign-tracker.js` – Campaign Tracker application and shared resource helpers.
- `scripts/companion-portal.js` – Companion Portal application.
- `scripts/gm-portal.js` – GM Portal application.
- `scripts/imperial-portal.js` – Imperial Portal application.
- `scripts/player-portal.js` – Player Portal application.
- `scripts/sheets/swia-actor-sheet.js` – Actor sheet class for `hero`, `villain`, and `ally`.
- `scripts/sheets/swia-character-sheet.js` – Actor sheet class for `character`.
- `scripts/sheets/swia-item-sheet.js` – Item sheet class for all item types.
- `templates/actors/` – Handlebars templates for actor sheets and all portal views.
- `templates/campaign/campaign-tracker.hbs` – Campaign Tracker template.
- `templates/items/` – Item sheet templates (`weapon`, `weaponmod`, `armor`, `gear`, `classcard`, `formcard`, `heroability`).
- `templates/dice/` – Dice and combat templates (`roll-dialog.hbs`, `roll-card.hbs`, `combat-window.hbs`).
- `icons/dice/` – Imperial Assault die face images.
- `styles/` – sheet styling.
- `lang/en.json` – localization strings.
- `packs/` – placeholder for compendium packs.

## Next Steps
- [x] Add dice pool logic and custom roll dialogs matching Imperial Assault dice. - Imperial Assault dice are now built into the system (`scripts/dice/`), with optional Dice So Nice! integration. The standalone [swia-dice](https://github.com/casegib/swia-dice) module is no longer required and is treated as legacy.
- [x] Implement item types (weapons, weapon mods, armor, gear, class cards, agenda cards, hero abilities, form cards) with relevant attributes.
- [x] Flesh out items with automation hooks (dice rolls, surge spending, keyword effects). - Delivered via `SWIARollDialog`, surge-spending roll cards, and the shared `SWIACombatWindow`.
- [x] Add token HUD controls and custom status effects.
- [x] Replace placeholder license/author fields in `system.json`.

## Recommended Modules
- [Dice So Nice!](https://foundryvtt.com/packages/dice-so-nice) for immersive 3D dice rolling.
- [Dice Tray](https://foundryvtt.com/packages/dice-tray) for managing dice pools.
- [Status Counter](https://foundryvtt.com/packages/statuscounter) for custom status effects.
- ~~[Star Wars Imperial Assault Dice](https://github.com/casegib/swia-dice)~~ — Imperial Assault dice are now built into this system; the standalone module is legacy and no longer required.


## Massive Villain Tokens
- Open a villain sheet as GM and enable Edit Mode.
- In the token area, use `Token Footprint` preset buttons (`1x1`, `2x1`, `2x2`, `3x2`, `3x3`) or set width/height/scale manually.
- Footprint uses Foundry grid occupancy (`width x height`).
- Non-circular silhouettes should come from transparent token art; occupancy remains rectangular.


## Notes
This is an unofficial fan project. Respect Fantasy Flight Games/Asmodee IP and your local laws when distributing assets.
