# SWIA System Backlog

Working list of planned improvements. Items graduate from here into implementation passes.

## In flight

**Pass 1 — Inventory & attachments (hero sheet)** *(in progress)*
- Armor section with equip toggle (wired to `system.equipped`, feeds `buildDefensePool`)
- Weapon mods nested under their weapon; unattached-mod pool with "Attach to…" picker writing `attachedWeaponId`
- Attachment slot display ("Mods 1/2") and enforcement against `attachmentSlots`; compat filtering via `modCompatType`
- Effective dice on weapon rows (mod dice gold-outlined, flat bonuses as tags)
- Surge/exhaust/action ability lines on weapon rows with cost badges (display only in this pass)
- Color-coded card-state pills (green ready / amber exhausted / red depleted)

## Next up

**Pass 2 — Exhaust & surge mechanics**
- `exhaustToUse` flag on the shared weapon/mod surge-entry schema (one checkbox, works for both editors)
- Combat window: surge buttons tagged with source item id; spending a flagged surge exhausts the source item; surge-undo readies it back
- Exhausted item semantics (locked in): printed dice/damage/accuracy/keywords always apply; only flagged surge + exhaust abilities are gated; depleted = item fully off (weapon leaves attack dropdowns, mod contributes nothing)
- Exhausted weapons remain usable (e.g. abilities that reference carried weapons)
- "Ready All" button (status phase): readies all exhausted weapons, mods, class cards, gear on a hero
- Weapon `exhaustAbilities` clickable on sheet: posts chat card + exhausts the item

**Weapon pool substitution**
- Optional `poolAttribute` field on weapons ("", strength, insight, tech). When set, `buildAttackPool` substitutes that attribute pool (Ancient Lightsaber: "your attack pool is your Insight pool"). Sheet shows ? dice chips + italic rule text.

## Planned

**GM portal: party overview ("Rebel Heroes Area")** — inspired by the Vassal module layout
- One column per hero: portrait, name, health/endurance steppers, state pill, **unspent XP promoted to a headline**, compact equipment list, companions in their owner's column
- Click-through to full actor sheets; visible to GM (and optionally players) as the at-a-glance table state
- This is the layer where Vassal's all-players-at-once layout belongs; the actor sheet stays the deep per-hero view

**Card-art borrows (from Vassal comparison)**
- Send-to-chat posts the item's uploaded card image when one exists (text card as fallback)
- Hover preview on inventory rows showing the card art (compact rows stay the structure; art is garnish)

**Item QoL**
- Send-to-chat button on every item row (💬)
- "Give to…" item trading between heroes (between-mission phase)
- Class card XP badges; optional XP deduction on purchase with GM override
- Optional: collapse-per-weapon ability lists if surge-heavy loadouts make the sheet too tall
- Optional: one-mod-per-subtype validation (no double barrels) — table-rules toggle

**Earlier follow-ups (from combat window work)**
- Mirror unlimited rerolls + surge undo into the solo roll dialog and chat cards
- Confirm dialog on Healthy → Wounded pill click (health pool reset is destructive)
- Undo for spent power tokens in the combat window (recreate the consumed status effect)

## Done (this cycle)
- Combat window: reopen on attack when combat already active (no more stranded state)
- Combat window: auto-opens for all connected users (spectators view-only)
- Unlimited dice rerolls until a spend locks them; surge spend undo
- Untargeted attacks open a pick-a-target prompt (sets target reticle, solo-roll fallback)
- Hero sheet display pass: health/endurance steppers, gold Weapon Attack button, Trait label, state pills (Healthy/Wounded/Defeated), quieter borders, aligned stat rows, empty-state cleanup, black-die visibility
- Hero sheet edit pass: compact chip dice editors, Healthy|Wounded stat tabs, custom-slot add tile, side-by-side selects, Token Setup disclosure, stats-only default expansion
