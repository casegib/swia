# SWIA Copilot Instructions

This is a Foundry VTT system for Star Wars: Imperial Assault (SWIA). Key focus: actor sheets for heroes, imperials, and allies with dice-based attribute systems.

## Architecture Overview

**Core Entry Point**: [scripts/swia.js](../../scripts/swia.js) initializes the system during Foundry's "init" hook, registering actor sheets and Handlebars helpers.

**Actor Sheet Class**: [scripts/sheets/swia-actor-sheet.js](../../scripts/sheets/swia-actor-sheet.js) is the main component that:
- Handles both Foundry v1 (ActorSheet) and v2 (ActorSheetV2 with Handlebars mixin) compatibility
- Manages two states: **healthy** and **wounded** (heroes only, via `system.state.wounded`)
- When wounded, displays `woundedAttributes` instead of `attributes` (different dice counts and speed)
- Converts numeric dice counts into arrays for template rendering (e.g., `strengthRedDice: Array.from({length: 3})`)

**Template Structure**: [template.json](../../template.json) defines three actor types:
- **hero**: Has endurance, surge, strength/insight/tech/attack attributes + wounded state
- **imperial**: Has attack, surge, threat attributes (no wounded state)
- **ally**: Like imperial but surge=1, threat=0

Each actor type inherits the "base" template which includes health, speed, defense, abilities[], equipment[].

## Key Patterns

**Dice Attributes as Objects**: All attack/defense dice are stored as `{red: 0, blue: 0, green: 0, yellow: 0}` or `{black: 0, white: 0}` structures. The sheet converts these to arrays for visual rendering via Handlebars `range` helper.

**Wounded State Toggle**: Only heroes can toggle wounded. This switches the active attribute set displayed:
`javascript
const currentAttrPath = isWounded ? "woundedAttributes" : "attributes";
const currentAttributes = system[currentAttrPath];
`
Handlebars template uses `currentAttrPath` to dynamically bind form inputs.

**Edit Mode**: GM-only toggle that enables/disables form fields and adds click handlers to profile/token images for editing.

**Handlebars Helpers** (swia.js):
- `capitalize`: String capitalization
- `range(count)`: Creates array for iteration (e.g., dice loops)
- `eq(a, b)`: Equality comparison
- `or(a, b)`: Logical OR

**Sheet Actions** (V2 via `DEFAULT_OPTIONS.actions`):
- `toggleWounded`: Flip hero wounded state
- `toggleEdit`: GM-only edit mode
- `addAbility` / `addEquipment`: Add rows to lists
- `removeRow`: Delete list items
- `editImage`: Open file picker (editor only)
- `changeName`: Update actor name (editor only)

## Development Workflow

**No build step**: This is vanilla Foundry JavaScript. Edit files directly; Foundry auto-reloads on save (with browser refresh).

**Template Files**: Stored in [templates/actors/actor-sheet.hbs](../../templates/actors/actor-sheet.hbs). Preloaded in `swia.js` hook. Use `data-action="actionName"` to bind to sheet actions.

**Localization**: [lang/en.json](../../lang/en.json) contains all strings. Use `{{localize "KEY.Path"}}` in templates.

**CSS**: [styles/swia.css](../../styles/swia.css) styles the sheet. Use class selectors from template root element (e.g., `.swia-sheet.type-hero`).

**Debugging**: Check Foundry console (F12) for `console.log` output. Check actor data in DevTools or via Foundry's entity data inspector.

## Adding New Features

1. **New Attribute**: Add to `template.json` for relevant actor type.
2. **New Sheet Field**: 
   - Add HTML to [actor-sheet.hbs](../../templates/actors/actor-sheet.hbs)
   - Bind with `name="system.path.to.attribute"`
   - Add to `_prepareContext` / `getData` context if rendering derived data
3. **New Action Handler** (e.g., rolling dice):
   - Add method like `_onRollStrength(event)` to SWIAActorSheet
   - Add to `DEFAULT_OPTIONS.actions` (V2) or use `activateListeners` (V1)
   - Test both V1/V2 paths if modifying sheet class

## Compatibility Notes

- Foundry v13.351 is verified. System supports v13+.
- Dual compatibility (V1/V2) is maintained via conditional imports and method overrides (`_prepareContext` for V2, `getData` for V1).
- Always test changes in both Foundry versions if touching `SWIAActorSheet`.

## Important Files

- [system.json](../../system.json): Manifest; update version, author, URLs before publishing.
- [README.md](../../README.md): User-facing docs. Update when adding major features.
- [template.json](../../template.json): Schema; the source of truth for actor/item data structure.

## Next Priority Items

- Dice pool logic / roll dialogs
- Item automation (weapons, gear, abilities)
- Token HUD controls
- Custom status effects (currently placeholder)
