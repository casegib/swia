# Star Wars Imperial Assault (Foundry VTT System Scaffold)

Unofficial system scaffold targeting Foundry VTT v13.351. Focus is on actor sheets for heroes, villains, and allies. This is a starting point—replace placeholder assets and flesh out rules, dice, and item automation as needed.

## Install (local dev)
1. Clone or copy this folder into your Foundry `Data/systems/swia` directory.
2. Launch Foundry VTT (v13.351) and enable the `Star Wars Imperial Assault` system for a world.

## Current Features
- Actor types: `hero`, `villain`, and `ally` with system-specific attribute schemas.
- Hero healthy/wounded state toggle with separate wounded attributes and biography.
- Activation token toggle on actor sheets.
- GM edit mode for actor and item sheets (including portrait/token/card image updates).
- Owned item support with item types: `weapon`, `gear`, `ability`.
- Dedicated item sheets for all item types, including weapon surge ability rows and card state cycling (`ready` -> `exhausted` -> `depleted`).
- Actor inventory side-panel tabs (Abilities, Items/Gear, Weapons) with open/delete/cycle-state controls.
- Custom status effects and power token icons registered in the system.
- Foundry v13 compatibility with V1/V2 sheet support.

## File Map
- `system.json` – system manifest; update `manifest`, `download`, `url` when publishing.
- `template.json` – actor/item templates and defaults.
- `scripts/` – system entry (`swia.js`) and actor sheet class.
- `templates/actors/` – Handlebars actor sheet template.
- `styles/` – sheet styling.
- `lang/en.json` – localization strings.
- `packs/` – placeholder for compendium packs.

## Next Steps
- [x] Add dice pool logic and custom roll dialogs matching Imperial Assault dice. - This is accomplished using Dice So Nice! integration and a custom module for Imperial Assault dice which can be found here: https://github.com/casegib/swia-dice
- [x] Implement item types (weapons, gear, abilities) with relevant attributes.
- [ ] Flesh out items (weapons/gear/abilities) with automation hooks.
- [x] Add token HUD controls and custom status effects.
- [x] Replace placeholder license/author fields in `system.json`.

## Recommended Modules
- [Dice So Nice!](https://foundryvtt.com/packages/dice-so-nice) for immersive dice rolling.
- [Dice Tray](https://foundryvtt.com/packages/dice-tray) for managing dice pools.
- [Status Counter](https://foundryvtt.com/packages/statuscounter) for custom status effects.
- [Star Wars Imperial Assault Dice](https://github.com/casegib/swia-dice) for accurate Imperial Assault dice representation.


## Notes
This is an unofficial fan project. Respect Fantasy Flight Games/Asmodee IP and your local laws when distributing assets.
