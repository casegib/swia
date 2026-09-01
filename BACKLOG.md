# SWIA System Backlog

Working list of planned improvements. Items graduate from here into implementation passes.

## Next up

- Commit everything to git with a `system.json` version bump (two feature passes + fixes currently uncommitted)
- Table-test the exhaust/surge mechanics and inventory management in a real session

## Planned

**Card-art borrows (from Vassal comparison)**
- Send-to-chat posts the item's uploaded card image when one exists (text card as fallback)
- Hover preview on inventory rows showing the card art (compact rows stay the structure; art is garnish)

**Item QoL**
- Weapon `exhaustAbilities` clickable on sheet: posts chat card + exhausts the item (schema field exists, currently unrendered)
- Send-to-chat button on every item row (💬)
- "Give to…" item trading between heroes (between-mission phase)
- Class card XP badges; optional XP deduction on purchase with GM override
- Optional: collapse-per-weapon ability lists if surge-heavy loadouts make the sheet too tall
- Optional: one-mod-per-subtype validation (no double barrels) — table-rules toggle

**Known issues**
- Wound/heal destroys custom token art: `getHealthyTokenSrc` falls back to `actor.img` because wounding overwrites `prototypeToken.texture.src`. A GM who set token art distinct from the portrait loses it after the first wound/heal cycle. Proper fix: capture `system.healthyTokenImage` before the first wound and restore from it. (Do NOT just read prototypeToken first — healing would then restore the wounded art.)
- Portal defense dice over-draw if a GM sets a raw defense attribute above 9 (`buildDefensePool` clamps at 9, the raw render does not).

**Earlier follow-ups (from combat window work)**
- Mirror unlimited rerolls + surge undo into the solo roll dialog and chat cards
- Undo for spent power tokens in the combat window (recreate the consumed status effect)

## Done (this cycle)
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
