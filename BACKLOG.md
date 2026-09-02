# SWIA System Backlog

Working list of planned improvements. Items graduate from here into implementation passes.

## Next up

- Commit everything to git with a `system.json` version bump (two feature passes + fixes currently uncommitted)
- Table-test the exhaust/surge mechanics and inventory management in a real session

## Planned

**Documentation**
- Player Guide + GM Guide from `docs/MANUAL_OUTLINE.md` (write after the solo-roll parity pass); publish as markdown in `docs/` and as a journal compendium. `docs/SURFACE_INVENTORY.md` is the code-derived control inventory to write from.

**Power-token follow-ups**
- Smoke-test the map badge in Foundry: grant a Block token from the portal and confirm the stock status icon disappears and the badge (icon + count) appears bottom-left of the map token; check an unlinked token too.
- Solo roll dialog has no declaration step, so tokens can only be declared in the combat window. If tokens matter for untargeted rolls, add a checkbox row to the roll dialog.
- Any in-flight combat saved before this build is dropped at load (its state shape predates the declared-bonus layers).

**Armor follow-ups**
- Smoke-test in Foundry: duplicate a damaged hero wearing +N armor and confirm the copy keeps the same damage (Foundry should not fire `createItem` for items carried in `Actor.create` data; if it does, the copy heals by N).
- Conditional armor text ("+1 Block against Ranged") is still a manual stepper bump in the combat window; a typed "vs melee/ranged" field could auto-apply it.

**Item QoL**
- Weapon `exhaustAbilities` clickable on sheet: posts chat card + exhausts the item (schema field exists, currently unrendered)
- Migrate the Companion and Imperial portals onto the shared `item-cards.js` preview helper (they still carry their own copies)
- "Give to…" item trading between heroes (between-mission phase)
- Class card XP badges; optional XP deduction on purchase with GM override
- Optional: collapse-per-weapon ability lists if surge-heavy loadouts make the sheet too tall
- Optional: one-mod-per-subtype validation (no double barrels) — table-rules toggle

**Known issues**
- Agenda cards: `influenceCost`, `agendaType`, `missionEffect` are in the data model and localized but the shared classcard sheet only exposes its extra fields for `type === "classcard"`; agenda and imperial class cards get name + art + state only.
- Actor sheet special-ability change scrape (`_onSpecialAbilityChange`) writes only name/description, dropping `surgeCost`; it survives only through the edit-mode-exit save path.
- Player Area drop zones show `.can-drop` for owners, but `_onPortalDrop` is GM-only — cosmetic/permission mismatch.
- `toggleInventoryPanel` (side-panel inventory, window resize) is registered on the actor sheet but no template emits the action; dead code or missing button.
- Item sheets are the only surfaces that do not autosave (explicit Save button); worth a hint in the sheet toolbar or a manual note.
- Wound/heal destroys custom token art: `getHealthyTokenSrc` falls back to `actor.img` because wounding overwrites `prototypeToken.texture.src`. A GM who set token art distinct from the portrait loses it after the first wound/heal cycle. Proper fix: capture `system.healthyTokenImage` before the first wound and restore from it. (Do NOT just read prototypeToken first — healing would then restore the wounded art.)
- Portal defense dice over-draw if a GM sets a raw defense attribute above 9 (`buildDefensePool` clamps at 9, the raw render does not).

**Earlier follow-ups (from combat window work)**
- Mirror unlimited rerolls + surge undo into the solo roll dialog and chat cards

## Done (this cycle)
- Power tokens declared before the roll: attacker (Damage/Surge) during setup, defender (Block/Evade) until its defense roll — the same window as the manual steppers. Combat state keeps bonuses by source (manual / armor / token) so each undoes on its own; a declared token's effect data is stashed so Undo restores it exactly, and Cancel refunds every declared token. Any tokens convert at spend time. Attacker-side tokens were previously unread. Spending no longer locks rerolls. Combat sides now resolve through the token uuid, so unlinked figures read/spend their own tokens instead of the base actor's.
- Power-token trays on the hero sheet header and portal cards, with GM +/- to grant or remove tokens (replaces hunting through the token HUD). Shared helpers in `actor-actions.js`.
- Map token badge (`scripts/token-badge.js`): power tokens are hidden from the stock status strip via an Actor subclass and drawn as one icon + count per type held, bottom-left of the token.
- Armor effects: armor no longer models defense dice (it never did on the cards). `ArmorData` carries `bonusHealth` / `bonusBlock` / `bonusEvade`; `armorEffectsFor()` in `common.js` is the single chokepoint. First derived-data layer in the system: `prepareDerivedData` adds equipped armor Health onto `health.max` (both hero sides), with `baseMax`/`armorBonus` kept for display and the hero sheet's max input reading `_source`. Item hooks in `actor-actions.js` shift current health by the same delta on equip/unequip/edit/add/remove (damage-preserving). Combat window seeds the defender's Block/Evade bonus row from armor (still adjustable); solo defense cards apply it too. Portal + hero sheet show Health/Block/Evade chips instead of gold-ringed dice.
- Armor sheet layout pass: rebuilt on the weapon card frame (title strip with state pill + cost chip, framed art with a DEFENSE badge, subtitle/traits row, compact meta rows) and gained the fields the printed cards actually use — `traits`, `bonusHealth`, printed `abilities` rows, (surge editor added then removed — defenders don't spend surges). Ability rows on both weapon and armor now save through a DOM scrape (`_collectAbilityRowsUpdate`) instead of indexed dot-paths, which had been re-defaulting `prefix` on every save. Generated chat text cards now show printed ability lines and bonus health.
- Card-art borrows: hover card preview on hero-sheet and portal item rows, 💬 send-to-chat on every row posting the scan (or a generated text card for items without one); new `scripts/item-cards.js` shared by both surfaces; `sanitizeRichHTML` added for scrubbing broadcast HTML
- Player Area party overview: unspent-XP headline (GM-editable, shares `system.xp` with the Campaign Tracker), clickable state pills, health/endurance steppers, per-figure Ready All, Armor column with equip toggles, mod chips on weapon cards, armor dice gold-ringed in DEFENSE, companions nested under their owner
- New `scripts/actor-actions.js`: shared mutations (wound/defeat, stat + XP steppers, armor equip, Ready All, token sync) used by both the actor sheet and the portal so the two surfaces cannot drift
- Confirm dialog on the Healthy → Wounded transition (both surfaces)
- Weapon pool substitution: `poolAttribute` on weapons draws the attack pool from Strength/Insight/Tech (wounded-aware); hero sheet shows the live substituted dice with a note, item sheet shows ? pips
- Pass 2: `exhaustToUse` surge flag, auto-exhaust with undo, depleted gating, Ready All
- Pass 1: armor section, nested mods with attach/detach + slot limits, effective dice, surge lines on weapon rows
- Combat window: reopen on attack when combat already active (no more stranded state)
- Combat window: auto-opens for all connected users (spectators view-only)
- Unlimited dice rerolls until a spend locks them; surge spend undo
- Untargeted attacks open a pick-a-target prompt (sets target reticle, solo-roll fallback)
- Hero sheet display pass: health/endurance steppers, gold Weapon Attack button, Trait label, state pills (Healthy/Wounded/Defeated), quieter borders, aligned stat rows, empty-state cleanup, black-die visibility
- Hero sheet edit pass: compact chip dice editors, Healthy|Wounded stat tabs, custom-slot add tile, side-by-side selects, Token Setup disclosure, stats-only default expansion
