## Model (revised from the sample survey)

The sample survey proposed `passive` + one `use` block. The census changes three things.

**1. One modifier schema, shared.** *(Built in the stage 2 pass: `modifierField()` in `scripts/data/common.js`; card data carries it as a sparse `passive` object per card.)* A passive card's effect (+2 Health, +1 Accuracy, Pierce 1, +1 Block, +1 white die) is the same shape as a condition's effect and as armor's. Define it once and reuse it:

```
modifier: {
  stats:   { health, endurance, speed },
  attack:  { damage, surge, accuracy, pierce },
  defense: { block, evade },
  dice:    { attack: {red,blue,green,yellow}, defense: {black,white} }
}
```
Armor (`bonusHealth/bonusBlock/bonusEvade`), conditions (`attackDice/attack/defense`) and class-card passives all become instances. `equipmentEffectsFor(actor)` sums armor + class-card passives + (imperial) attachments; `conditionEffectsFor` stays separate because conditions also discard.

**2. `use` is a list, and it carries a modifier plus a cost.** Several cards have two declared halves (Combat Veterans attack + defense; Gunslinger passive + exhaust). Each entry:

```
use: [{
  when:      "attack" | "defense" | "test",
  cost:      { exhaust, strain, deplete },
  note:      "melee weapon, while wounded",     // printed condition, shown on the button
  modifier:  { attack, defense, dice },          // same schema as above (stats unused here)
  surgeAbilities: [ …weapon structure… ]
}]
```

**3. Rerolls need nothing.** 14 declared cards are "exhaust to reroll N dice". Rerolls are already unlimited in this system until a surge is spent, so those cards are text. If you ever tighten rerolls to the printed rules, these become buttons with `cost.exhaust` and an `other: reroll` flag — leave the door open, don't build it.

**Imperial specifics.** Attachments are items on the deployment group's actor (a new `attachment` item type, or armor with an `attachment` flag — armor already has the health/block/evade layer, so the flag is cheaper). Class-wide declared cards (Shock Troopers, Sharpshooters, Find the Weakness, No Quarter…) apply to any Imperial figure meeting a trait condition; the honest model is a GM-side "Imperial class" actor or a world-level list the combat window reads when the attacker is a villain/ally, offering the button on every imperial attack. That's the one new surface the imperial side needs; everything else reuses the hero path.

## Scope recommendation (unchanged in order, resized)

1. **Equipment tag** — `classXp`, `heroClass` on weapon/armor/weaponmod; Class Cards column lists them. Covers 26 hero cards with no new mechanics.
2. **Shared modifier schema + passive layer** — refactor armor and conditions onto it, add class-card `passive`, extend derived data to endurance and speed. Covers 21 hero + 16 imperial cards, and simplifies two existing systems.
3. **Declared card effects** — `use` list, card-backed buttons on both sides of the combat window and in the solo dialog, cost/undo/refund. Covers 49 hero + 37 imperial cards. This is the pass.
4. **Imperial attachments and class-wide cards** — armor `attachment` flag; world-level imperial class list read by the combat window. After 3.
5. **Compendium generator** — from the dataset JSON plus these transcriptions; art referenced locally, not committed.

Action/event cards (58 hero, 38 imperial) get text and the exhaust state. That is 40% of all cards and it is the right call.

