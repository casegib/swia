# Sheet Layout Pass 2 — plan

Three changes, all template + CSS with small context-builder edits. No schema changes, no migration. Builds on pass 1 (scrolling sheet, sticky combat header, abilities disclosure).

1. Glyphs for stat labels across the dice surfaces
2. Compact rows for weapons (and class cards)
3. Two-column inventory grid — only if compact rows leave the sheet tall on a real loadout

Inventory *tabs* were considered and rejected: they trade the single-glance overview of a hero's whole loadout for a click per category, which is exactly what a player doesn't want mid-defense. Compact rows attack the actual cause of the height (weapon rows showing every surge line and mod all the time); the grid change is the fallback if that isn't enough. The Player Area portal remains the everything-at-once surface for the party and is untouched.

Build order: 1 → 2 → evaluate → 3 if needed.

---

## 1. Glyphs for stat labels

### Today

Three surfaces write stat names as words: the combat window's Declared Bonuses rows (`combat-window.hbs`, `label` from `SWIA.Dice.*`), the roll-card totals (`roll-card.hbs` lines ~44–55: "Damage 4 · Surge 2 · Accuracy 5 · Block 1 · Evade 1"), and the solo roll dialog's token rows (`roll-dialog.hbs`, the `label` next to each token stepper). The combat window also shows a redundant "Power Tokens: Block 0 · Evade 0" held-count line on both panels. Condition notes render "+1 Green Die" as words.

### Target

One inline-glyph convention: `<img class="swia-glyph" src="systems/swia/icons/<Stat>.png" alt="Damage" title="Damage">` at 1em height, vertically centred, with the word kept in `title`/`alt`. Icons exist: `Damage.png`, `Surge.png`, `Block.png`, `Evade.png`, `Dodge.png`, `Reticle.png` (accuracy), `Strain.png`. Dice colours render as the existing `.dice-block <color>` swatch.

### Changes

- **Helper**: a Handlebars helper `swiaGlyph stat` registered in `swia.js` next to `eq`/`or`, returning the `<img>` (SafeString). One place owns the path mapping (`accuracy → Reticle.png`); templates call `{{{swiaGlyph "damage"}}}`. Also a JS export of the same mapping for places that build strings in code (condition notes).
- **Combat window**: bonus row `label` → glyph + `title`; delete both `combat-tokens-held` paragraphs (the ×n token buttons already show held counts, and the Any button appears when held). Results totals (`roll-card-totals` inside the window) → glyph + number.
- **Roll card**: totals → glyph + number; "Declared tokens" line → glyphs; test cards' "Surges: n" → glyph.
- **Roll dialog**: token row labels → glyph + `title`; the stat name stays in the stepper tooltip.
- **Condition notes** (`conditions.js` `conditionEffectsFor`): produce `+1 <span class="dice-block green"></span>` instead of "+1 Green Die", and glyphs for `+1 Surge` etc. The notes are already rendered with triple-stash, so HTML is fine; run them through the existing `sanitizeLabelHTML` allowlist (it permits `img` and `span`).
- **CSS**: `.swia-glyph { height: 1em; width: auto; vertical-align: -0.15em; border: 0 }` once, globally scoped under `.swia-roll-card, .swia-combat-window, .swia-roll-dialog`. The condition notes' `.dice-block` needs a 0.9em size variant inside a note chip.
- **Localization**: no keys removed — the words move into `title`.

### Verification
- Every glyph has a `title` (hover shows the word) and `alt`.
- Combat window bonus rows fit on one line in the defender panel at 720px window width (the label was what wrapped them).
- Summary chat card (read-only) and live solo cards render identically.
- Condition note for Focused reads "+1 ▮" with a green swatch in dialog, window and card.
- Dice So Nice / chat log with a narrow sidebar: glyphs don't overflow the card totals row (flex-wrap is already on).

## 2. Compact rows (weapons, then class cards)

### Today

Each `.weapon-entry` (`actor-sheet.hbs` ~913–990) is: image · name · a meta row (range icon, base dice, mod dice, mod bonus tags, slot counter, pool note) · an inline abilities row · a **surge-lines block** (one line per surge ability, weapon + mods, with cost icon, label, exhaust flag, source) · controls (state pill, chat, delete) · a nested **mods block** (one row per attached mod with dice and its own controls). Biv's Repeating Blaster with one surge and no mods is already three lines; a modded weapon with three surges is seven or eight.

### Target

One line per weapon by default; details on expand.

```
[img] Repeating Blaster   [ranged] ▪▪   ⚡1   Mods 0/2        READY  💬  ▾
```

Collapsed line: image · name · range icon + dice (base + mod dice, as today) · a surge count chip (`⚡ 3`) · the mod-slot chip · state pill · chat · a chevron. Expanded (chevron, or click on the name area): the abilities row, the surge lines and the mods block exactly as they render today, indented under the line. Hover card preview (`bindCardPreviews`) keeps working on the image either way.

Default state: collapsed. A weapon that is *depleted* or has an *exhausted-to-use* surge still shows its state pill on the line, so nothing critical is hidden. Remember expanded rows per sheet in a `Set` of item ids on the instance (same pattern as `_abilitiesOpen`), reset when the sheet closes.

### Changes

**Template**
- Restructure `.weapon-entry` into `.weapon-line` (the collapsed row) + `.weapon-details` (everything currently below the meta row), with `data-action="toggleItemDetails"` on the chevron and `aria-expanded`. `.weapon-details` gets `hidden` unless the id is in the expanded set.
- Surge count chip: `{{surgeLines.length}}` is already in context. Exhaust-to-use surges could tint the chip — optional.
- Keep `data-action="openItem"` on image and name; the chevron and the line's empty space toggle.

**Sheet class**
- `this._expandedItems = new Set()`; `_onToggleItemDetails` toggles the id and flips `hidden` on the row's `.weapon-details` directly (no render). Context adds `expanded: this._expandedItems.has(w.id)` per weapon.

**CSS**
- `.weapon-line` flex row, 28px tall, gap 6px; `.weapon-surge-chip` styled like `.mod-slots`; `.weapon-details` with a left rule in accent at 0.25 and 8px padding; chevron rotates on `[aria-expanded="true"]`.
- The existing `.weapon-surge-lines`, `.weapon-mods`, `.weapon-abilities-inline` rules apply unchanged inside `.weapon-details`.

**Class cards**
- Class-card rows today are name + state + chat. Once the class-card pass lands (`passive` / `use` blocks), a row will want the same collapsed line (name · XP · a chip per mechanical effect · state · chat · chevron) with the rules text and effect details on expand. Build the row as a shared partial (`templates/actors/parts/item-row.hbs`) with slots for the line chips and the details, so weapons and class cards share the collapse behaviour and the `_expandedItems` set from day one, even though class cards have nothing to expand yet.

**Portal parity**
- The Player Area weapon cards (`player-portal.hbs`) show surge lines and mod chips too. Leave them for this pass; the portal is one card per hero and the height problem is the sheet's. Note it in the backlog if the portal later feels tall.

### Verification
- Collapsed row shows dice, surge count, slot count, state; expanding shows surge text and mods identical to today.
- Cycling state or posting to chat from the line works without expanding.
- Expanding survives a re-render caused by an unrelated actor update (e.g. health stepper) — the set is on the instance.
- Card hover preview still fires on the image.
- Delete (edit mode) still available — put it on the line, not in details.

---

## 3. Two-column inventory grid (fallback)

### Today

`.inventory-sections` is `grid-template-columns: repeat(auto-fit, minmax(230px, 1fr))` — four ~230px columns at 980px width. Weapons is the tallest column by a wide margin; Armor and Accessories are usually one item or empty.

### When

Only after §2 is in Foundry and a fully kitted hero (two weapons with mods, armor, four or more class cards) still pushes the inventory well past one screen. Compact rows should make this unnecessary for most heroes; decide on a real loadout, not on Biv's two weapons.

### Target

Two columns, weapons wide:

```
┌──────────────────────────────────┬───────────────────┐
│ WEAPONS (2)                      │ CLASS CARDS (2)   │
│  row · row                       │  row · row        │
├──────────────────────────────────┤                   │
│ ARMOR (1)                        ├───────────────────┤
│  row                             │ ACCESSORIES (0)   │
│                                  │  drop zone        │
└──────────────────────────────────┴───────────────────┘
```

Every category stays visible; weapons get ~60% of the width so an expanded row (surge lines, nested mods) has room; armor sits under weapons because both are combat gear; class cards and accessories stack on the right.

### Changes

- CSS only, display mode: `.swia-sheet:not(.editing) .inventory-sections { grid-template-columns: 3fr 2fr; grid-template-areas: "weapons classcards" "armor classcards" "armor gear"; }` with `grid-area` on each `.inventory-group` (`inventory-group-weapons` exists; add `-armor`, `-classcards`, `-gear` classes to the other three groups in the template). `align-items: start` stays so short groups don't stretch.
- Below 720px sheet width, fall back to one column (existing media query, widen its threshold).
- Edit mode keeps the current four-column auto-fit grid; the GM edits one category at a time and the collapsible headers already work there.
- The Ready All toolbar stays above the grid, full width.

### Verification

- All four categories visible without scrolling on a 700px-tall window with a kitted hero, weapons collapsed.
- Expanding a weapon doesn't push Class Cards (they're in the other column).
- Drop zones for empty Armor / Accessories still show.

---

## Cleanup in the same pass

Delete the dormant side-panel inventory code: `_onToggleInventoryPanel`, `_activeInventoryPanel`, the `activeInventoryPanel` context key and the `toggleInventoryPanel` action in `scripts/sheets/swia-actor-sheet.js`, and the `.inv-tab-strip` … `.inv-panel[data-panel]` / `.inv-panel-open` rules in `styles/swia.css` (~2360–2460). No template references any of it (backlog Known issue).

## Effort

Glyph swap ½ day; compact rows ½–1 day including the shared partial and the dormant-code cleanup; two-column grid an hour if it's needed. One release (0.1.8.0) — all display-layer, one Foundry smoke test: open a kitted hero, expand a weapon, start a combat, roll solo, read the cards.

## Not in this pass

- Portal weapon cards (see §2).
- Inventory tabs (rejected — see top).
- Any change to the sticky header or abilities disclosure from pass 1 — if the flat parchment on the sticky block reads as a band in play, fix it here as a one-line CSS tweak, otherwise leave it.
