# SWIA System Backlog

Working list of planned improvements. Items graduate from here into implementation passes.

## Next up

- Smoke-test the conditions pass in Foundry: toggle Focused on a hero and confirm the roll dialog shows +1 green and the card drops Focused after the roll; Hidden attacker gets +1 surge and is discarded on combat Apply (not on Cancel); Weakened defender's Evade total drops by 1 and comes off when the activation token flips; Stunned refuses the Attack button for a player and offers the GM an override; Bleeding's Suffer button takes strain then damage; Settings → Configure Conditions saves a custom condition that appears in the token HUD and on the sheet tray.
- Smoke-test the solo-roll parity pass in Foundry (see Done): solo attack/defense/test cards get per-die rerolls until a surge is spent, spent surges become Undo, and the roll dialog declares power tokens. Check as a player (relay through the GM) and as the GM; check a combat-window summary card stays inert.
- Table-test the exhaust/surge mechanics and inventory management in a real session
- Player Guide + GM Guide are now unblocked (the solo-roll parity pass was their gate)

## Planned

**Documentation**
- Player Guide + GM Guide from `docs/MANUAL_OUTLINE.md` (write after the solo-roll parity pass); publish as markdown in `docs/` and as a journal compendium. `docs/SURFACE_INVENTORY.md` is the code-derived control inventory to write from.

**Power-token follow-ups**
- Smoke-test the map badge in Foundry: grant a Block token from the portal and confirm the stock status icon disappears and the badge (icon + count) appears bottom-left of the map token; check an unlinked token too.
- Any in-flight combat saved before this build is dropped at load (its state shape predates the declared-bonus layers).
- Tokens declared in the solo roll dialog have no post-roll undo (same as the combat window, where the declaration window closes at the roll). If that bites at the table, stash the deleted effect data on the card the way the combat window does and add an Undo.

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

**Condition follow-ups**
- Stunned's movement restriction (no voluntary movement) is not enforced — the system doesn't track movement points. Card text only.
- Bleeding's "whenever you perform an action" is manual (the Suffer button on the sheet/portal tray); there is no action counter to hook.
- Conditions on the *defender* of a solo, targeted attack are read at roll time only (targeted attacks normally go to the combat window anyway).
- Built-in condition rules can't be edited in the settings form; if a table rule differs (e.g. a house-ruled Hidden), the workaround is a custom condition with a different id.
- Hidden's -2 Accuracy is applied to the attacker's displayed total; range is still adjudicated by eye.

**Known issues**
- Agenda cards: `influenceCost`, `agendaType`, `missionEffect` are in the data model and localized but the shared classcard sheet only exposes its extra fields for `type === "classcard"`; agenda and imperial class cards get name + art + state only.
- Actor sheet special-ability change scrape (`_onSpecialAbilityChange`) writes only name/description, dropping `surgeCost`; it survives only through the edit-mode-exit save path.
- Player Area drop zones show `.can-drop` for owners, but `_onPortalDrop` is GM-only — cosmetic/permission mismatch.
- `toggleInventoryPanel` (side-panel inventory, window resize) is registered on the actor sheet but no template emits the action; dead code or missing button.
- Item sheets are the only surfaces that do not autosave (explicit Save button); worth a hint in the sheet toolbar or a manual note.
- Portal defense dice over-draw if a GM sets a raw defense attribute above 9 (`buildDefensePool` clamps at 9, the raw render does not).

## Done (this cycle)
- Token-art fix: `HeroData` gained `healthyTokenImage`; `setWoundedState` stashes the current prototype token art there on every healthy → wounded transition (before overwriting it with the wounded art), and `getHealthyTokenSrc` reads the stash while wounded / the prototype while healthy, so custom token art set through Foundry's token config survives the wound/heal cycle. Heroes wounded before the field existed still heal to the portrait. Smoke-test: set token art distinct from the portrait, wound, heal, confirm the token art is back.
- Conditions pass: new `scripts/conditions.js` owns the status-effect list (conditions first, then power tokens) and a registry of condition records with rules — pool dice when attacking/testing, signed result shifts when attacking (damage/surge/accuracy) or defending (block/evade, and a shift on the attacker's accuracy), discard triggers (after attack, after test, end of activation, spend an action), cannot-attack, and strain-per-action. Built-ins: Focused, Hidden, Bleeding, Stunned, Weakened with their printed rules; the old Blind/Scanned/Recon/Wanted icon-only statuses were dropped from the built-ins (their PNGs stay in `icons/` so a GM can recreate any of them as a custom marker). Custom conditions live in the `customConditions` world setting, edited through Settings → Configure Conditions (`SWIAConditionsConfig`, `templates/settings/conditions-config.hbs`); they merge into `CONFIG.statusEffects` and the pipeline treats them like built-ins. Dice pipeline: the solo dialog and combat window both add condition dice to the pool and fold shifts into a `conditionBonus` layer next to manual/armor/token (breakdown tooltip updated); totals floor at 0 so a -1 Evade can't go negative; the dialog, window and cards show a Conditions line. Stunned gates `SWIARollDialog.open` (warn for players, confirm-override for the GM). After-attack/after-test discards fire when the solo card posts and when the combat window applies damage (Cancel keeps them). Sheet header and Player Area portal share a condition tray partial (`templates/actors/parts/condition-tray.hbs`) with Discard, Spend Action (confirm), Suffer (Bleeding: strain, then damage at max strain), End Activation, and an add picker; helpers in `actor-actions.js`. Flipping the activation token to "activated" also discards end-of-activation conditions (`updateActor` hook, fires once on the acting client).
- Solo-roll parity pass: solo chat cards now carry per-die ↺ rerolls (unlimited until a surge spend locks them; each reroll posts its own die to chat) and spent surge abilities flip to an Undo button that refunds the surge, reverses its effects, readies an exhaust-to-use source card, and unlocks rerolls. The roll dialog gained a Power Tokens fieldset (Damage/Surge on attacks, Block/Evade on defense, none on attribute tests; Any tokens convert per row) — tokens are consumed only when Roll is clicked, so closing the dialog spends nothing; the card shows the Declared tokens line. The combat window and the solo cards now share one set of result-state helpers in `roll-dialog.js` (`replaceFace`, `recomputeFaceTotals`, `applySurgeToState`, `revertSurgeOnState`, `exhaustSurgeSource`, `readySurgeSource`, `rollReplacementDie`, `consumeDeclaredTokens`), so the two surfaces cannot drift. Solo-card actions use one `cardAction` socket relay (author-or-GM, player → active GM; the legacy `spendSurge` wire shape is still accepted). Players relay whenever a GM is online rather than try-then-relay, since a reroll is not idempotent. Combat summary cards are flagged `readOnly` so they never offer reroll/undo. Card actor resolution is token-aware (`ChatMessage.getSpeakerActor`) so unlinked figures exhaust/ready their own items.
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
