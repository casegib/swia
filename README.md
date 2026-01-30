# Star Wars Imperial Assault (Foundry VTT System Scaffold)

Unofficial system scaffold targeting Foundry VTT v13.351. Focus is on actor sheets for heroes, imperials, and allies. This is a starting point—replace placeholder assets and flesh out rules, dice, and item automation as needed.

## Install (local dev)
1. Clone or copy this folder into your Foundry `Data/systems/swia` directory.
2. Launch Foundry VTT (v13.351) and enable the `Star Wars Imperial Assault` system for a world.

## Current Features
- Actor types: hero, imperial, ally with basic attributes (health, endurance, speed, defense, surge, threat).
- Editable abilities and equipment lists with add/remove controls.
- Minimal styling to differentiate the sheet.

## File Map
- `system.json` – system manifest; update `manifest`, `download`, `url` when publishing.
- `template.json` – actor/item templates and defaults.
- `scripts/` – system entry (`swia.js`) and actor sheet class.
- `templates/actors/` – Handlebars actor sheet template.
- `styles/` – sheet styling.
- `lang/en.json` – localization strings.
- `packs/` – placeholder for compendium packs.

## Next Steps
- Add dice pool logic and custom roll dialogs matching Imperial Assault dice.
- Flesh out items (weapons/gear/abilities) with automation hooks.
- Add token HUD controls and custom status effects.
- Replace placeholder license/author fields in `system.json`.

## Notes
This is an unofficial fan project. Respect Fantasy Flight Games/Asmodee IP and your local laws when distributing assets.
