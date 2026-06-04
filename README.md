# Star Wars Imperial Assault (Foundry VTT System Scaffold)

Unofficial system scaffold targeting Foundry VTT v13.351. Focus is on actor sheets for heroes, villains, allies, and generic characters. This is a starting point—replace placeholder assets and flesh out rules, dice, and item automation as needed.

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
- Foundry v13 compatibility with V1/V2 sheet support.

## File Map
- `system.json` – system manifest; update `manifest`, `download`, `url` when publishing.
- `template.json` – actor/item templates and defaults.
- `scripts/swia.js` – system entry point; registers sheets, status effects, settings, and Handlebars helpers.
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
- `styles/` – sheet styling.
- `lang/en.json` – localization strings.
- `packs/` – placeholder for compendium packs.

## Next Steps
- [x] Add dice pool logic and custom roll dialogs matching Imperial Assault dice. - This is accomplished using Dice So Nice! integration and a custom module for Imperial Assault dice which can be found here: https://github.com/casegib/swia-dice
- [x] Implement item types (weapons, weapon mods, armor, gear, class cards, agenda cards, hero abilities, form cards) with relevant attributes.
- [ ] Flesh out items with automation hooks (dice rolls, surge spending, keyword effects).
- [x] Add token HUD controls and custom status effects.
- [x] Replace placeholder license/author fields in `system.json`.

## Recommended Modules
- [Dice So Nice!](https://foundryvtt.com/packages/dice-so-nice) for immersive dice rolling.
- [Dice Tray](https://foundryvtt.com/packages/dice-tray) for managing dice pools.
- [Status Counter](https://foundryvtt.com/packages/statuscounter) for custom status effects.
- [Star Wars Imperial Assault Dice](https://github.com/casegib/swia-dice) for accurate Imperial Assault dice representation.


## Massive Villain Tokens
- Open a villain sheet as GM and enable Edit Mode.
- In the token area, use `Token Footprint` preset buttons (`1x1`, `2x1`, `2x2`, `3x2`, `3x3`) or set width/height/scale manually.
- Footprint uses Foundry grid occupancy (`width x height`).
- Non-circular silhouettes should come from transparent token art; occupancy remains rectangular.


## Notes
This is an unofficial fan project. Respect Fantasy Flight Games/Asmodee IP and your local laws when distributing assets.
