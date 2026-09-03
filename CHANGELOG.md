# Changelog

All notable changes to the SWIA system. Versions match git tags and `system.json`.

## Unreleased — 0.1.8.0: compendiums and sheet layout

### Compendiums
Six packs, generated from transcribed and verified card data (`docs/class-cards.json`, `docs/cards/*.json`): **Heroes** (19 heroes with both sides, abilities, attribute pools and their starting class-deck equipment embedded, plus 7 companions), **Deployment Groups** (123 villain/ally actors with dice, abilities and surge abilities, Regular/Elite folders by affiliation), **Class Cards (Hero)** (172, one folder per hero; equipment cards are real weapon/armor/mod items), **Class Cards (Imperial)** (100, one folder per class), **Items, Supply & Rewards** (item deck by tier, supply, rewards, form cards) and **Agenda Cards** (114, one folder per deck, mission agendas flagged). Card text uses the system's inline icons; weapon surges are structured so they show as spend buttons on roll cards. Card art is not shipped — see README "Card art" for the two-step install from the `lvisintini/imperial-assault-data` scans. `npm run build:packs` regenerates everything (`scripts/build/build-packs.mjs`).

Display-layer changes below; no data model changes.

### The sheet scrolls, and the combat block stays put
- The hero sheet now scrolls instead of clipping at the window height (core's window content hides overflow; the sheet is its own scroll container and keeps its position across re-renders).
- In display mode the stats block — health, endurance, speed, XP, dice row, Weapon Attack — is pinned to the top while name, abilities and inventory scroll beneath it.
- Hero Abilities sit behind a disclosure, collapsed by default with a count badge; open/closed is remembered while the sheet is open.

### Compact weapon rows
- Each weapon is one line: art, name, range + dice (mod dice ringed), a ⚡-count chip, mod slots, state, chat. Surge text, printed abilities and attached mods open beneath it on the chevron (or the ⚡ chip). Expanded rows stay expanded across re-renders while the sheet is open.
- The four inventory columns are unchanged; with weapons collapsed they fit a kitted hero. A two-column grid is planned as a fallback if a full class deck still pushes the sheet tall (`docs/LAYOUT_PASS_2.md`).

### Stat glyphs
- Damage, Surge, Accuracy, Block, Evade and Dodge are drawn as their IA icons in the combat window bonus rows and result totals, on chat cards, in the roll dialog's token rows, and in condition notes ("+1 ▮" with a green die swatch). The word stays in the tooltip.
- The combat window's "Power Tokens: Block n · Evade n" line is gone; the token buttons already show what's held.

### Fixes
- Inline glyphs inside rich text (hero abilities, class-card and item descriptions, portal text) rendered at native icon size because each container's own `img` rule out-specified the glyph class; `img.swia-glyph` is now unconditionally text-height everywhere.
- Player Area: power-token and condition chip icons on the hero cards were rendering at portrait size (68px, circular) and stacking, because the portal's portrait rule matched every image inside the identity block. Portrait rule now targets only the portrait.

### Cleanup
- Removed the dormant side-panel inventory code (`toggleInventoryPanel` and its CSS) that no template referenced.

## 0.1.7.0 — Conditions, solo-roll parity, token-art fix

Requires Foundry VTT v13. No data migration; new fields default empty and existing worlds load unchanged.

### Conditions are now mechanics, not just icons

Focused, Hidden, Bleeding, Stunned and Weakened carry their printed rules, and the dice pipeline applies them.

- **Focused** adds a green die to attack and attribute-test pools and is discarded after the roll resolves.
- **Hidden** gives +1 Surge when attacking and −2 Accuracy to whoever attacks the hidden figure; discarded after the figure resolves an attack.
- **Weakened** applies −1 Surge when attacking and −1 Evade when defending; discarded at end of activation.
- **Stunned** blocks the Attack button. Players get a warning; the GM is offered an override.
- **Bleeding** has a *Suffer* button on the sheet and portal that takes 1 strain per action, or 1 damage once endurance is at 0.

Conditions show as chips in the hero-sheet header and on the Player Area portal cards, with Discard, *Spend Action* (Bleeding/Stunned, confirmed), *Suffer*, *End Activation*, and a picker to add one. Flipping a figure's activation token to "activated" also discards end-of-activation conditions automatically. The roll dialog, combat window and chat cards all show a Conditions line describing what was applied, and the combat window's bonus tooltip gained a Conditions column next to Manual / Armor / Tokens.

**Custom conditions.** Settings → *Configure Conditions* (GM) lets you define your own: name, icon, type, extra dice, result shifts, discard triggers, cannot-attack, strain per action. They appear in the token HUD and behave exactly like the built-ins. Leave every rule at 0 for a plain marker.

**Removed:** the icon-only Blind, Scanned, Recon and Wanted statuses. Their icons remain in `icons/` so any of them can be recreated as a custom condition in seconds. Figures that currently have one of those statuses keep the effect until it is removed by hand; it just no longer appears in the HUD picker.

### Solo rolls catch up with the combat window

- **Rerolls.** Every die on a solo chat card has a ↺ button. Rerolls are unlimited until a surge ability is spent; each reroll posts its own die to chat.
- **Surge undo.** A spent surge ability becomes an Undo button that refunds the surge, reverses its effects, re-readies an exhaust-to-use card, and unlocks rerolls.
- **Power tokens in the roll dialog.** Attacks can declare Damage/Surge tokens and defense rolls Block/Evade tokens, with Any tokens converted per row. Tokens are consumed only when you click Roll — closing the dialog spends nothing. Attribute tests don't take tokens.
- Solo-card actions use the same author-or-GM permission as before; players' clicks relay to the GM whenever one is online.

### Fixes

- **Custom token art survives wound/heal.** Token art set through Foundry's token config (distinct from the portrait) was replaced by the portrait after the first wound/heal cycle. The healthy art is now captured on wounding and restored on healing. Heroes wounded before this release still heal to the portrait.
- Negative result shifts can no longer push Evade, Accuracy, Damage or Surge totals below zero.
- Chat-card item exhaust/ready resolves the speaker token, so unlinked figures act on their own items rather than the base actor's.

### Under the hood

- New `scripts/conditions.js` owns the status-effect list and the condition registry.
- The combat window and solo cards share one set of result-state helpers (`replaceFace`, `recomputeFaceTotals`, `applySurgeToState`, `revertSurgeOnState`, exhaust/ready, token consumption) in `roll-dialog.js`, removing ~150 lines of duplicated reroll/spend logic.
- The condition tray is a shared Handlebars partial used by both the sheet and the portal.
- `HeroData` gained `healthyTokenImage`.

### Known limitations

- Stunned's movement restriction isn't enforced (the system doesn't track movement points).
- Bleeding's per-action strain is manual (the Suffer button); there is no action counter.
- Hidden's −2 Accuracy shows in the attacker's total; range is still judged by eye.
- Built-in condition rules aren't editable in the settings form; house-rule a variant as a custom condition with a different id.
- Tokens declared in the solo roll dialog have no post-roll undo (same as the combat window).
