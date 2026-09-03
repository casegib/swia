# Class Card Survey — full census

All 172 hero class cards (19 heroes) and 100 imperial class cards (11 classes), transcribed from the scans in `lvisintini/imperial-assault-data` (MIT-licensed metadata + images; card content © LFL/FFG), then **verified card-by-card at 2× against an icon legend** (the first pass misread ~15% of cards: Strength/Insight glyphs, Block/Evade/Dodge, strain-vs-action costs, damage power-token icons, and two weapons' dice). Source of truth is `docs/class-cards.json`; this file is generated from it by `scripts/build/class-card-survey.py`.

Notation: ⚡ surge · ✦ strain · ⊠ damage · [Block] · [Evade] · [Dodge] · ◆ threat · ⟶ action · [melee] / [ranged] · [Str]/[Ins]/[Tech] attribute tests · [damage token] etc. for power-token icons. Flavor text omitted.

## Shapes

- **equipment** — the card is a weapon, armor, modification or equipment item. Create as that item type; add `classXp`/`heroClass` so it lists under Class Cards.
- **passive** — permanent, no choice, no cost: +Health/+Endurance/+Speed and always-on roll modifiers. Derived-data layer.
- **declared** — a roll effect the player opts into when attacking, defending or testing, usually costed (exhaust/strain/deplete) and/or conditional. Card-backed button in the Declared Bonuses rows, undoable, refunded on cancel.
- **action** — spent as an action or at a timing outside a roll. Text + exhaust state only.

## Census

| | Cards | equipment | passive | declared | action |
|---|---|---|---|---|---|
| Hero (19 decks) | 172 | 30 | 22 | 54 | 66 |
| Imperial (11 classes) | 100 | 0 | 18 | 39 | 43 |
| All | 272 | 30 | 40 | 93 | 109 |

Hero decks: **106 of 172 cards (62%)** are mechanical under the first three shapes; 66 are action/event text. Every deck has a starter weapon; 8 heroes (Biv Bodhrik, Davith Elso, Drokkatta, Loku Kanoloa, Onar Koma, Shyla Varad, Verena Talos, Vinto Hreeda) also carry extra weapons, armor or equipment in the deck. All 19 heroes have at least one declared card, and 16 of 19 have a passive stat card.

Imperial classes: **57 of 100 (57%)** are mechanical — but imperial passives are mostly *attachments* that live on one deployment group, and several declared cards are *class-wide* (Shock Troopers, Sharpshooters, Find the Weakness) applying to every Imperial figure of a trait. Those need a different home than a hero's item list; see the model section.

### Per hero

| Hero | equipment | passive | declared | action |
|---|---|---|---|---|
| Biv Bodhrik | 3 | 0 | 2 | 4 |
| Davith Elso | 2 | 0 | 4 | 3 |
| Diala Passil | 1 | 1 | 2 | 5 |
| Drokkatta | 3 | 2 | 2 | 2 |
| Fenn Signis | 1 | 1 | 3 | 4 |
| Gaarkhan | 1 | 1 | 3 | 4 |
| Gideon Argus | 1 | 1 | 2 | 5 |
| Jarrod Kelvin | 1 | 1 | 2 | 5 |
| Jyn Odan | 1 | 0 | 4 | 4 |
| Ko-Tun Feralo | 1 | 2 | 3 | 3 |
| Loku Kanoloa | 2 | 3 | 1 | 3 |
| MHD-19 | 1 | 1 | 2 | 5 |
| Mak Eshka'rey | 1 | 1 | 3 | 4 |
| Murne Rin | 1 | 1 | 2 | 5 |
| Onar Koma | 2 | 2 | 4 | 1 |
| Saska Teft | 1 | 2 | 4 | 2 |
| Shyla Varad | 3 | 1 | 3 | 2 |
| Verena Talos | 2 | 1 | 4 | 3 |
| Vinto Hreeda | 2 | 1 | 4 | 2 |

### Per imperial class

| Class | passive | declared | action |
|---|---|---|---|
| Armored Onslaught | 1 | 4 | 4 |
| Hutt Mercenaries | 1 | 6 | 2 |
| Imperial Black Ops | 2 | 4 | 3 |
| Inspiring Leadership | 0 | 1 | 8 |
| Military Might | 2 | 2 | 5 |
| Nemeses | 1 | 5 | 4 |
| Power of the Dark Side | 1 | 2 | 6 |
| Precision Training | 2 | 7 | 0 |
| Reactive Defenses | 1 | 4 | 4 |
| Subversive Tactics | 3 | 2 | 4 |
| Technological Superiority | 4 | 2 | 3 |

## What the declared cards actually need

Over the 93 declared cards (hero + imperial):

| Feature | Cards | Model support |
|---|---|---|
| Flat result bonus (+damage/+surge/+accuracy/+block/+evade/+dodge) | 52 | `bonus` — same as the condition layer |
| Add or swap dice in the pool | 17 | `dice.add` / `dice.remove` — same as Focused/Ferocity |
| Grants a surge ability for this attack | 10 | `surgeAbilities` — same structure as weapons |
| Reroll dice | 14 | **Already free** — rerolls are unlimited until a surge spend; these cards need no button |
| Pierce / Cleave / Blast keyword | 10 | `bonus.pierce`; Cleave/Blast stay text (as on weapons) |
| Applies a condition to the target | 4 | Text, or a surge ability with `effectType: "condition"` (small addition) |
| Convert results (e.g. Block to Evade) | 3 | Text; too few to model |
| Spatial condition (spaces, adjacent, line of sight) | 29 | Printed on the button as `note`; never enforced |
| Costed: exhaust | 64 | Button flips the card to exhausted; undo readies it |
| Costed: strain | 16 | Button spends strain via `adjustActorStat`; undo refunds |
| Costed: deplete | 3 | Button flips to depleted; undo readies |
| No cost (pure reminder) | 20 | Still worth a button: one click instead of a manual stepper |

Timing: attack 64, defense 20, both 7, test 2. Defense-side and test-side buttons are needed, not just attack.

## Passive cards: what they modify

| Modifier | Cards |
|---|---|
| Health | 11 |
| Endurance | 5 |
| Speed | 6 |
| Accuracy | 7 |
| Block | 4 |
| Evade | 4 |
| Dodge | 0 |
| Pierce | 3 |
| Extra defense die | 1 |
| Grants a surge ability | 3 |

40 passive cards; nearly all also carry a second, non-passive clause. The passive part is what the derived-data layer applies; the rest is text on the same card.

## Model (revised from the sample survey)

The sample survey proposed `passive` + one `use` block. The census changes three things.

**1. One modifier schema, shared.** A passive card's effect (+2 Health, +1 Accuracy, Pierce 1, +1 Block, +1 white die) is the same shape as a condition's effect and as armor's. Define it once and reuse it:

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



## Card text


### Hero decks


#### Biv Bodhrik

| Card | XP | Shape | Text |
|---|---|---|---|
| Repeating Blaster | — | equipment | Attack: [ranged] blue + red. Traits: Blaster - Heavy. ⚡: +1 Accuracy. |
| Advance | 1 | action | When an adjacent hostile figure is defeated, you may interrupt to place your figure in one of the spaces that the defeated figure occupied. |
| Shake It Off | 1 | action | Exhaust this card at the start of your activation to test [Str]. If you roll 2 or more successes, you may recover 1✦ or discard 1 Harmful condition. |
| Crushing Blow | 2 | declared | Exhaust this card while performing the [melee] attack of "Close and Personal" to choose one of the following: The attack gains: ⚡: Weaken, Stun. The attack gains: ⚡: +2⊠. |
| Into the Fray | 2 | declared | While defending, if you are within 3 spaces of 2 or more hostile figures, apply +1[Block] to your defense results. |
| Trophy Armor | 3 | equipment (+declared) | Traits: Armor - Heavy. +4 Health. Exhaust this card while defending to reroll 1 defense die. |
| Vibrobayonet | 3 | equipment (+declared) | Traits: Modification - Blade. While performing "Close and Personal," the [melee] attack gains: +1⊠, Pierce 1, Bleed. |
| Final Stand | 4 | action | ⟶: Deplete this card to recover ✦ equal to your Endurance, move a number of spaces up to your Speed, and perform "Close and Personal" without using an action or suffering the ✦ cost. Then, you suffer 2⊠ and become Stunned. |
| Stay Down | 4 | action | 2✦: Exhaust this card after you resolve "Close and Personal." If the target was not defeated, perform the [melee] attack from "Close and Personal" again, targeting the same figure. |

#### Davith Elso

| Card | XP | Shape | Text |
|---|---|---|---|
| Heirloom Dagger | — | equipment | Attack: [melee] green + yellow. Traits: Blade. ⚡: +1⊠. ⚡: Pierce 1, Bleed. |
| Covert Operative | 1 | declared (+action) | At the start of each mission, become Hidden. While defending, you may discard the Hidden condition to apply +1[Block] to the defense results. After an attack targeting you resolves, if you did not suffer any ⊠, become Hidden. |
| Elusive Agent | 1 | action | Exhaust this card when you become Hidden to recover 1✦. |
| Blindside | 2 | action | Exhaust this card when you exit a space containing a hostile figure and roll 1 blue die. That figure suffers ⊠ equal to the ⊠ results. Apply +1⊠ to the results if you are Hidden. |
| Falling Leaf | 2 | declared | 1✦: Exhaust this card when you declare an attack with a [melee] weapon to add 1 yellow die to the attack pool. |
| Force Illusion | 3 | action | 1✦: Exhaust this card while a hostile figure in your line of sight is attacking. The defender becomes Hidden. |
| Shrouded Lightsaber | 3 | equipment | Attack: [melee] green + yellow. Traits: Lightsaber - Blade. ⚡: Pierce 3. ⚡: +1⊠. ⚡: +1⊠. ⚡: +2⊠. Use only while Hidden. |
| Embody the Force | 4 | declared (+passive) | Apply +1 Endurance and +3 Health to your hero. Exhaust this card while attacking to apply +1⊠ to the attack results. Exhaust this card while defending to apply +1[Block] to the defense results. |
| Fell Swoop | 4 | declared (+action) | Exhaust this card while attacking with a [melee] weapon. The attack gains: ⚡⚡: After this attack resolves, become Hidden, move up to 2 spaces, then perform another attack. |

#### Diala Passil

| Card | XP | Shape | Text |
|---|---|---|---|
| Plasteel Staff | — | equipment | Attack: [melee] green + yellow. Traits: Staff. Reach. ⚡: Stun. ⚡: +1⊠. |
| Force Adept | 1 | declared | 1✦: Use while you or a friendly figure is performing an attack or attribute test. That figure may reroll 1 die. Exhaust this card when you perform a [Str] or [Tech] test. Add 1 blue die to your dice pool. |
| Force Throw | 1 | action | 2✦: Exhaust this card during your activation to choose another small figure within 3 spaces and test [Ins]. If you pass, push that figure 3 spaces. Then, if the figure is hostile, it suffers 1⊠. |
| Battle Meditation | 2 | action | Use when you rest during your activation. Test [Ins]. If you pass, choose yourself or a friendly figure. That figure becomes Focused. |
| Defensive Stance | 2 | declared (+action) | When you use "Foresight," apply +1[Block] to your defense results. After an attack targeting you is resolved, if you suffered no ⊠, you become Focused. |
| Art of Movement | 3 | passive | Apply +1 Speed to your hero. You ignore additional movement point costs when entering difficult terrain or spaces containing hostile figures. |
| Snap Kick | 3 | action | Exhaust this card after you resolve an attack with a [melee] weapon to choose 1 hostile figure adjacent to you and roll 1 green die. That figure suffers ⊠ equal to the ⊠ results. |
| Dancing Weapon | 4 | action (+declared) | ⟶1✦: Perform a [ranged] attack using a [melee] weapon. Add 1 blue die to the attack pool and gain: ⚡: +2 Accuracy, +1⊠. |
| Way of the Sarlacc | 4 | action | ⟶2✦: For each hostile figure adjacent to you, perform 1 attack with a [melee] weapon targeting that figure. |

#### Drokkatta

| Card | XP | Shape | Text |
|---|---|---|---|
| MGL-9 Boomer | — | equipment | Attack: blue + red [ranged]. Traits: Projectile - Explosive. ⚡: Blast 1⊠. ⚡: +1 Accuracy. |
| Charging Up | 1 | passive (+action) | Apply +2 Health to your hero. At the end of each of your activations, gain 1 [damage token]. |
| Leave No One Behind | 1 | action | Exhaust this card during your activation to gain 1 movement point. Exhaust this card during your activation to choose a friendly figure in your line of sight and 4 or more spaces away. That figure gains 2 movement points. |
| Bank Shot | 2 | passive | +1 Accuracy. When you declare an attack with a [ranged] weapon, you may target a figure adjacent to an empty space in your line of sight. |
| Shrapnel Rounds | 2 | equipment (+declared) | Traits: Explosive. Blast 1⊠. Exhaust this card while attacking to reduce the Blast by X to a minimum of 0. A figure other than the target within 2 spaces of the target suffers X⊠. |
| Repeater Cannon | 3 | equipment | Attack: blue + green [ranged]. Traits: Projectile - Explosive. +1⊠. ⚡: Pierce 2. ⚡: Blast 1⊠. ⚡⚡: Each hostile figure within 2 spaces of the target space suffers 1⊠. |
| Structural Exploitation | 3 | declared | Exhaust this card while attacking to apply +1⊠, +1 Accuracy, and Pierce 1 to the attack results. If the target is an object, apply an additional +1⊠ and Pierce 1 to the attack results. |
| Thermal Explosives | 4 | declared (+action) | 1✦: Exhaust this card when you declare an attack with a [ranged] weapon to add 1 yellow die to the attack pool. When you use "Demolish", up to 2 figures or objects of your choice on or adjacent to the chosen space each suffer an additional 1⊠. |
| Wookiee Wrath | 4 | action | Exhaust this card during your activation and choose an adjacent hostile figure. Roll 1 red die. That figure suffers ⊠ equal to the ⊠ results. Then, you may push that figure up to two spaces. |

#### Fenn Signis

| Card | XP | Shape | Text |
|---|---|---|---|
| Infantry Rifle | — | equipment | Attack: [ranged] blue + green. Traits: Blaster - Rifle. ⚡: +1⊠. ⚡: +1 Accuracy. |
| Tactical Movement | 1 | action | Exhaust this card at the start of your activation. Choose yourself or a friendly figure within 3 spaces. That figure gains 2 movement points. |
| Take Cover | 1 | declared | 1✦: Exhaust this card when an attack targeting you is declared. Add 1 white die to your defense pool. |
| Adrenaline Rush | 2 | action | Exhaust this card after an attack targeting you is resolved. If you suffered 1 or more ⊠, test [Str]. If you pass, recover 3✦. |
| Weapon Expert | 2 | declared | 1✦: Use while attacking to gain Pierce 1 and apply +2 Accuracy to the attack results. |
| Suppressive Fire | 3 | action | 1✦: Exhaust this card after resolving an attack using "Havoc Shot." Each figure that suffered 1 or more ⊠ chooses to either suffer 1⊠ or become Stunned. If that figure was already Stunned, it must choose to suffer 1⊠. |
| Trench Fighter | 3 | declared | Exhaust this card when you declare an attack targeting a figure within 3 spaces. Apply +2⊠ to the attack results. |
| Rebel Elite | 4 | passive | Apply +3 Health and +1 Endurance to your hero. When you use "Havoc Shot," it applies Blast 2⊠ instead of Blast 1⊠. |
| Superior Positioning | 4 | action (+declared) | ⟶1✦: Move a number of spaces up to your Speed and become Focused. While defending, while you are Focused, apply +1[Block] to your defense results. |

#### Gaarkhan

| Card | XP | Shape | Text |
|---|---|---|---|
| Vibro-Ax | — | equipment | Attack: [melee] red + yellow. Traits: Blade. ⚡: Pierce 1. ⚡: Cleave 1⊠. |
| Wookiee Fortitude | 1 | action | 1✦: Exhaust this card during your activation to either recover 2⊠ or discard one of your conditions. |
| Wookiee Loyalty | 1 | declared | Exhaust this card while you or an adjacent friendly figure is defending to apply +1[Block] to the defense results. |
| Ferocity | 2 | declared | When you declare an attack while you are Focused, add 1 red die to your attack pool instead of 1 green die. This attack also gains: ⚡: Cleave 1⊠. |
| Staggering Blow | 2 | action | 1✦: Exhaust this card after you resolve an attack. If the target suffered 3 or more ⊠, it becomes Stunned. |
| Rampage | 3 | action | After you resolve "Charge," each hostile figure adjacent to you suffers 1⊠. |
| Vicious Strike | 3 | declared | 1✦: Use when you declare an attack with a [melee] weapon. Apply +1⊠ to the attack results. |
| Brutal Cleave | 4 | action | 1✦: Exhaust this card after you resolve an attack with a [melee] weapon. Perform an additional attack targeting a different figure or object adjacent to the target of the first attack. |
| Unstoppable | 4 | passive (+declared) | Apply +1 Endurance and +1 Speed to your hero. While attacking, while you are wounded, apply +2⊠ to your attack results. |

#### Gideon Argus

| Card | XP | Shape | Text |
|---|---|---|---|
| Holdout Blaster | — | equipment | Attack: [ranged] blue + yellow. Traits: Blaster - Pistol. ⚡: Pierce 2. |
| Called Shot | 1 | declared | Exhaust this card while you or a friendly figure is attacking. If the target is in your line of sight, apply +1⚡ to the attack results. |
| Military Efficiency | 1 | declared | Exhaust this card while attacking to convert 1⊠ result to 1⚡ result. Exhaust this card while defending to convert 1[Block] result to 1[Evade] result. |
| Air of Command | 2 | passive | Apply +2 Health to your hero. When you use "Command," you may choose any friendly figure in your line of sight. |
| Mobile Tactician | 2 | action | After you resolve "Command," gain 2 movement points. |
| For the Cause | 3 | action | 1✦: Exhaust this card when another friendly figure within 3 spaces declares an attack. That figure becomes Focused. |
| Rallying Shout | 3 | action | Exhaust this card during your activation to choose another hero in your line of sight. That hero recovers 2✦. |
| Hammer and Anvil | 4 | action | ⟶2✦: Choose another friendly figure. You and that figure may each perform an attack targeting the same figure. The target figure chooses the order in which these attacks resolve. During the second attack, remove all dice from the target's defense pool. |
| Masterstroke | 4 | action | Exhaust this card after you resolve "Command." You may perform an additional "Command" without using an action or suffering the ✦ cost. |

#### Jarrod Kelvin

| Card | XP | Shape | Text |
|---|---|---|---|
| Vibro-Claws | — | equipment | Attack: yellow + yellow [melee]. Traits: Blade - Fist. ⚡: Pierce 2. ⚡: Gain 1 ⊠ power token. This item cannot be sold. |
| Balanced Approach | 1 | action | At the end of your activation: If you did not perform an attack, gain 1 [damage token]. If you did not perform a move, gain 1 movement point. If you did not perform a rest, recover 1⊠. |
| Forward Momentum | 1 | action | At the start of your activation, you or J4X-7 gains 1 movement point. After an attack targeting you resolves, if you used "Parry," you gain 1 movement point. |
| Scouts Loadout | 2 | declared (+action) | Exhaust this card while a Rebel figure is attacking a figure in your or J4X-7's line of sight to apply -1[Evade] to the defense results. When an Imperial figure deploys in J4X-7's line of sight, a Rebel figure of your choice may gain 1[Evade]. Limit once per deployment. |
| Slicers Upgrades | 2 | action | J4X-7 gains: ⟶⟶: Move up to 1 space. Then, either interact with an object as though you are a hero, applying +1⚡ to the test results if that interaction requires a test, or an object adjacent to you suffers 3⊠. |
| Explosive Reflexes | 3 | declared (+passive) | Apply +1 Endurance to your hero. Exhaust this card when you declare an attack with a [melee] weapon, when J4X-7 declares an attack, or when an attack targeting you is declared to replace 1 die in the attack pool with another attack die of your choice. |
| Mutual Progression | 3 | passive | Apply +1 Speed to your hero and to J4X-7. You and J4X-7 each gain "1[Block]." |
| Leaping Slash | 4 | action | 1✦⟶: Move up to 2 spaces. Then, you may exhaust the Vibro-Claws to perform an attack with that weapon. Then, perform an attack with a different [melee] weapon. |
| Mechanical Master | 4 | action (+passive) | Apply +2 Health to your hero. When J4X-7 declares an attack, it becomes Focused. Exhaust this card at the start of another hero's activation. J4X-7 may ready and activate at the start or end of that hero's activation. |

#### Jyn Odan

| Card | XP | Shape | Text |
|---|---|---|---|
| Vintage Blaster | — | equipment | Attack: [ranged] green + green. Traits: Blaster - Pistol. ⚡: +1⊠. ⚡: +1 Accuracy. |
| Quick As A Whip | 1 | action | After an attack targeting you is resolved, you may move 1 space. |
| Smugglers Luck | 1 | declared (+action) | Exhaust this card while performing an attribute test to reroll any number of dice. Exhaust this card after you draw a Supply card to discard that card and draw another one. During the Rebel upgrade stage, draw 1 additional Item card. |
| Cheap Shot | 2 | declared | When you use "Quick Draw," apply +1⊠ to the attack results. The attack also gains: ⚡: Stun |
| Roll With It | 2 | declared | 1✦: Use when an attack targeting you is declared to apply +1[Block] to your defense results. You may convert 1 or more [Block] results to [Evade] results. |
| Get Cocky | 3 | action | Exhaust this card after you resolve an attack. If the target figure was defeated, recover 2✦ or become Focused. |
| Gunslinger | 3 | declared (+passive) | While attacking with a PISTOL you can use ⚡ abilities from any PISTOL you brought to the mission. 1✦: Exhaust this card while attacking to apply +1⚡ to your attack results. |
| Sidewinder | 4 | action | After you resolve an attack, you may move up to 2 spaces. |
| Trick Shot | 4 | action (+declared) | 1✦: Use before you declare an attack with a [ranged] weapon. You can draw line of sight from any space within 3 spaces. |

#### Ko-Tun Feralo

| Card | XP | Shape | Text |
|---|---|---|---|
| Service Rifle | — | equipment | Attack: blue + green [ranged]. Traits: Blaster - Rifle. ⚡: +2 Accuracy. While attacking with this weapon, you may reroll 1 attack die. |
| Auxiliary Training | 1 | declared | Exhaust this card while a friendly figure is attacking or defending. If that figure spent a power token during this attack, it may reroll 1 of its dice. |
| Inch By Inch | 1 | action | Exhaust this card during your activation. You and another friendly figure within 3 spaces each gain 1 movement point. |
| Combat Logistics | 2 | action | Exhaust this card when a friendly figure within 3 spaces performs a rest. That figure gains 1 ⊠ power token. At the start of each mission, draw 1 Supply card. |
| Dig In | 2 | declared | 1✦: Exhaust this card when an attack targeting a friendly figure within 2 spaces is declared to apply +2[Block] to the defense results. |
| Fire Support Specialist | 3 | declared | 1✦: Exhaust this card when a friendly figure within 3 spaces spends a power token during an attack. Remove 1 defense die from the defense pool. |
| Opportunist | 3 | passive (+action) | Apply +2 Health and +1 Speed to your hero. After a friendly figure within 3 spaces resolves an attack, if that figure spent a power token, you may move 1 space. |
| Self-sufficient | 4 | passive (+action) | When you spend a power token, apply +2 of the symbol on that token to the results instead of +1. 1✦: Exhaust this card during your activation to gain 1 power token. |
| Squad Cohesion | 4 | action (+passive) | At the start of each mission, distribute 4 power tokens among Rebel figures. A Rebel figure can use power tokens in the play areas of friendly figures within 3 spaces of him. Friendly figures within 2 spaces of you can use any power token as ⊠, [Evade], ⚡, or [Block]. |

#### Loku Kanoloa

| Card | XP | Shape | Text |
|---|---|---|---|
| All-Weather Rifle | — | equipment | Attack: [ranged] blue + green. Traits: Projectile - Rifle. +1 Accuracy. ⚡: Weaken. ⚡: Pierce 1. |
| Combat Spotter | 1 | passive | While performing "Set Your Sights," you may ignore figures when determining line of sight. Friendly figures may ignore figures when determining line of sight to a figure with a recon token. |
| Scouting Report | 1 | action | 1✦: Exhaust this card at the start or end of your activation to place a recon token on a crate. A hero can interact with that crate during his activation without using an action. |
| Overwatch | 2 | action (+declared) | ⟶: Place a recon token on this card. When a hostile figure declares a move or attack, you may discard a recon token from this card to interrupt to perform an attack targeting that figure. Apply +1⚡ to the attack results. |
| Spectrum Scanner | 2 | equipment (+action) | Traits: Sights. Exhaust this card when a figure with a recon token is defeated to place 1 recon token on another figure in the same group. |
| Scouts Guidance | 3 | action (+declared) | 2✦: Use during your activation to place 1 recon token on another friendly figure. While a friendly figure with a recon token is defending, apply +1[Evade] to the defense results. |
| Study of Enemies | 3 | passive (+declared) | Apply +2 Health to your hero. Your attacks gain: ⚡: Exhaust this card to place a recon token on a hostile figure within 2 spaces of the target. |
| Coordinated Attack | 4 | declared | 2✦: Exhaust this card when an attack targeting a figure with a recon token is declared to add 1 die of your choice to the attack pool. |
| Mon Cala Special Forces | 4 | passive (+action) | +1[Evade]. +1 Accuracy. Exhaust this card when a hostile figure with a recon token is defeated to recover 2✦ or become Focused. |

#### MHD-19

| Card | XP | Shape | Text |
|---|---|---|---|
| Sidearm Blaster | — | equipment | Attack: [ranged] blue + yellow. Traits: Blaster - Pistol. ⚡: Stun. ⚡: Pierce 1. |
| Bacta Injector | 1 | action | 1✦: Exhaust this card during your activation and choose an adjacent friendly figure. That figure recovers 1⊠ or discards 1 HARMFUL condition. |
| Improper Procedure | 1 | action | 1✦: Exhaust this card during your activation and choose an adjacent hostile figure. That figure suffers 1⊠ and becomes Weakened. |
| Field Surgeon | 2 | declared (+action) | Your attacks gain: ⚡: Exhaust this card and choose an adjacent friendly figure. That figure recovers 2⊠. After another hero is defeated, you may interrupt to perform an attack targeting the figure who defeated that hero. |
| Fuel Injection | 2 | passive (+action) | Apply +1 Speed to your hero. 1✦: Exhaust this card when an attack targeting another friendly figure within 4 spaces resolves. You may interrupt to move up to 2 spaces. |
| Adrenal Vapor | 3 | declared | 2✦: Use when another friendly figure within 2 spaces declares an attack. Add 1 yellow die to the attack pool. The attack gains: ⚡: Recover 1⊠ |
| Miracle Worker | 3 | action | Deplete this card when another hero within 4 spaces of you has suffered ⊠ equal to his Health. Instead of being defeated, that hero recovers 3⊠. |
| Bacta Radiator | 4 | action | At the start of each round, each friendly figure within 2 spaces recovers 1✦ and 1⊠ for each of your activation tokens. |
| Combat Override | 4 | action | 2✦: Exhaust this card during your activation to search the Supply deck for an EXPLOSIVE card and gain that card. Then, shuffle the Supply deck. ⟶⟶: Exhaust this card to perform 3 attacks, then suffer 3⊠. |

#### Mak Eshka'rey

| Card | XP | Shape | Text |
|---|---|---|---|
| Longblaster | — | equipment | Attack: blue + blue. Traits: Blaster - Rifle. ⚡: +1 ⊠. ⚡: Pierce 1. |
| Disengage | 1 | action | 1✦: Exhaust this card when a hostile figure enters a space within 3 spaces of you to gain 3 movement points. |
| Supply Network | 1 | action | Exhaust this card during your activation to test [Ins]. If you pass, reveal the top card of the Supply deck and place it on the top or bottom of the deck. ⟶: Deplete this card to draw 1 card from the Supply deck. |
| Jeswandi Training | 2 | passive (+action) | Apply +2 Health to your hero. Exhaust this card after a hostile figure within 3 spaces resolves an attack. You become Focused. |
| Target Acquired | 2 | declared | 1✦: Exhaust this card before you declare an attack. During this attack, figures do not block your line of sight. Apply +2 Accuracy to the attack results. |
| Execute | 3 | declared (+action) | After you resolve an attack, if the target figure was defeated, recover 1✦. 1✦: Exhaust this card when you use "Ambush." Remove all white dice from the target's defense pool. |
| Expertise | 3 | action | 1✦: Exhaust this card during your activation after you interact. Perform 1 additional action during this activation. |
| Decoy | 4 | declared (+action) | Deplete this card when an attack targeting you is declared. The attack misses. After the attack resolves, you may interrupt to place your figure in any empty space within 3 spaces. Then, you become Focused and may perform an attack. |
| No Escape | 4 | action | 2✦: Exhaust this card after you resolve an attack. If the target figure was not defeated, you become Focused. Then, perform 1 additional attack targeting the same figure. |

#### Murne Rin

| Card | XP | Shape | Text |
|---|---|---|---|
| Diplomat's Blaster | — | equipment | Attack: blue + green. Traits: Blaster - Pistol. ⚡: Pierce 1. After resolving an attack with this weapon, if the target suffered 1 or more ⊠, you may push that figure 1 space. |
| Company of Heroes | 1 | action | When you deploy a unique ALLY, reduce its deployment cost by 4 (to a minimum of 0). |
| Sonic Bellow | 1 | action | Exhaust this card during your activation to test [Ins]. If you pass, choose a hostile figure with a figure cost of 3 or less within 3 spaces. That figure becomes Stunned. |
| Professional Aide | 2 | declared | Exhaust this card while another Rebel figure within 3 spaces is attacking or performing an attribute test to apply +1 ⚡ to the results. |
| Rebel Propaganda | 2 | passive (+action) | Apply +2 Health to your hero. 1✦: Exhaust this card during your activation and choose another hero within 3 spaces. Then, test [Ins]. For each success, discard 1 strain token from that hero's Hero sheet. |
| Double Agent | 3 | action | When you use "False Orders," before performing the attack, you may push the chosen figure up to 2 spaces. After the attack resolves, that figure becomes Stunned. |
| Solidarity | 3 | action | When another hero within 3 spaces performs a rest, recover 2✦. When another hero within 3 spaces performs a move, gain 2 movement points. |
| Lead from the Front | 4 | declared | While attacking or using "False Orders" during your activation, for each ready activation token in play, that attack may gain 1 of the following (limit once per option per attack): +1 ⊠; Pierce 1; Recover 1 ⊠; +2 Accuracy. |
| Waylay | 4 | action | 1✦: Use after "False Orders" resolves. Choose another hero within 3 spaces to interrupt to perform an attack. 1✦: Use after "False Orders" resolves. Choose a friendly ALLY within 3 spaces to interrupt to perform an attack. |

#### Onar Koma

| Card | XP | Shape | Text |
|---|---|---|---|
| Bodyguard Rifle | — | equipment (+declared) | Attack: green + red. Traits: Blaster - Rifle. When you declare an attack with this weapon, you may apply -1 ⊠ and +2 Accuracy to the attack results. |
| Get Down | 1 | declared | Exhaust this card while you or another friendly figure within 2 spaces is defending. Test [Str] or [Ins]. If you pass the [Str] test, apply +1 [Block] to the defense results. If you pass the [Ins] test, apply +1 [Evade] to the defense results. |
| Keep Up | 1 | action | Exhaust this card at the end of an activation to gain 1 movement point. |
| Mutual Destruction | 2 | declared (+action) | While attacking, you may suffer 1 ⊠ to apply +1 ⊠ to the attack results. Exhaust this card when you use "Rush." You and the pushed figure each suffer 1 ⊠. |
| Stay Behind Me | 2 | passive (+declared) | Apply +2 Health to your hero. While an adjacent friendly figure is defending, if you are healthy, you may suffer 1 ⊠ to apply +1 [Block] to the defense results. |
| Brute Strength | 3 | passive (+action) | When you perform a [Tech] or [Ins] test you may use your [Str] attribute instead. Exhaust this card when you would perform an interact. Test [Str]. If you receive 2 or more successes, perform that interact without using an action. |
| Hold Still | 3 | declared (+action) | Exhaust this card while an adjacent hostile figure is defending to apply -1 [Block] or -1 [Evade] to the defense results. When a hostile figure voluntarily exits an adjacent space you become Focused. |
| Black Sun Armor | 4 | equipment (+declared) | Traits: Armor. +3 Health. While defending, you may apply +1 [Block] or +1 [Evade] to the defense results. |
| Don't Make Me Hurt You | 4 | declared (+action) | Exhaust this card when you declare an attack to add 1 red die to your attack pool. After you resolve an attack, if the target was defeated, you may suffer 1 ⊠ to ready this card. |

#### Saska Teft

| Card | XP | Shape | Text |
|---|---|---|---|
| Modified Blaster | — | equipment | Attack: green + yellow. Traits: Blaster - Pistol. +1 Accuracy. ⚡: Weaken. ⚡: +1 ⊠. ⚡: Pierce 1. ⚡: +1 Accuracy. |
| Tool Kit | 1 | declared | Exhaust this card while performing a [Tech] test to apply +1 ⚡ to the results. Exhaust this card when a friendly figure performs an attribute test using "Practical Solutions" to apply +1 ⚡ to that figure's test results. |
| Unstable Device | 1 | action | Once during a figure's activation, he may suffer 1 ⊠ and discard 1 device token to choose a space within 3 spaces of his figure and roll 1 yellow die. Each figure and object on or adjacent to that space suffers ⊠ equal to the ⊠ results. |
| Energy Shield | 2 | declared | While defending, a figure may discard 1 device token to apply either +1 [Block] or +1 [Evade] to his defense results. This ability may be used multiple times per attack. |
| Structural Weakness | 2 | declared | Exhaust this card while attacking an object to apply +2 ⊠ to the attack results. Exhaust this card while attacking a DROID or VEHICLE to apply +1 ⊠ to the attack results. |
| Gadgeteer | 3 | passive | "Battle Technician" can be used up to twice per activation. You can attach 1 additional modification to each of your weapons. |
| Power Converter | 3 | declared | Each figure with 1 or more device tokens gains: 1✦: When you declare an attack, if you use "Practical Solutions," you may additionally replace 1 die in your attack pool with a different attack die of your choice. |
| Adrenaline Injector | 4 | action | Each figure with 1 or more device tokens gains: 1✦: When you perform a move, you may discard 1 device token to gain 2 additional movement points and become Focused. |
| Remote Distribution | 4 | passive (+action) | Apply +2 Health and +1 Endurance to your hero. When using "Battle Technician," instead of an adjacent friendly figure, a friendly figure up to 3 spaces away can claim 1 device token. |

#### Shyla Varad

| Card | XP | Shape | Text |
|---|---|---|---|
| Duelist's Blade | — | equipment (+action) | Attack: green + yellow. Traits: Blade. ⚡: +1 ⊠. ⚡: Pierce 1. ⟶: Replace 1 yellow die in your attack pool with 1 red die. Then, perform an attack with this weapon. |
| All-Out Attack | 1 | declared | Exhaust this card while attacking with a [melee] weapon to apply +1 ⊠ and -1 ⚡ to the attack results. |
| Responsiveness | 1 | action | Exhaust this card at the start of your activation to gain 1 movement point. Exhaust this card at the start of your activation to recover 1✦. |
| Proximity Strike | 2 | declared | Exhaust this card while attacking with a [melee] weapon. You may force the defender to reroll 1 defense die of your choice. Then, you may reroll 1 attack die. |
| Smoke Bombs | 2 | equipment (+action) | Traits: Accessory. 1✦: Exhaust this card at the end of your activation and choose a figure within 3 spaces. If that figure is friendly, it becomes Hidden. If not, it becomes Weakened. |
| Remote Detonator | 3 | equipment (+action) | Traits: Accessory. 1✦: Exhaust this card during your activation and choose a hostile figure within 3 spaces. Roll 1 green die. That figure suffers ⊠ equal to the ⊠ results. |
| Swords Dance | 3 | action | 1✦: Exhaust this card after you resolve an attack with a [melee] weapon. Remove 1 die from your attack pool and perform an attack with the same weapon and target. |
| Deadly Grace | 4 | passive (+action) | Apply +1 Endurance to your hero. +1 [Evade]. At the start of your activation, gain 2 movement points. |
| Full Sweep | 4 | declared | Exhaust this card while attacking with a [melee] weapon. The attack gains Cleave 3 ⊠. |

#### Verena Talos

| Card | XP | Shape | Text |
|---|---|---|---|
| Fighting Knife | — | equipment | Attack: red. Traits: Blade. +1 ⊠. ⚡: Pierce 2. When sold, this item is worth 25 credits. |
| Military Blaster | — | equipment | Attack: blue + yellow. Traits: Blaster - Pistol. ⚡⚡: +2 ⊠. ⚡: +1 Accuracy, Pierce 1. When sold, this item is worth 25 credits. |
| Combat Momentum | 1 | action | 1✦: Use when an adjacent hostile figure is defeated to gain 2 movement points. When you use "Close Quarters," you can move up to 1 space before performing the attack. |
| Create Opening | 1 | declared | 1✦: Exhaust this card while a hostile figure adjacent to you is defending to apply -1 [Block] or -1 [Evade] to the defense results. |
| K'tara Maneuver | 2 | action | ⟶: Move up to 2 spaces to a space containing a small hostile figure and push that figure 1 space. Then, perform an attack with a [ranged] weapon. |
| Student of Battle | 2 | declared | When you perform an attack using "Close Quarters," the attack gains: ⚡: Pierce 2. ⚡: Recover 2 ⊠. ⚡: +5 Accuracy. |
| Improvised Cover | 3 | declared | While defending, if you are adjacent to a hostile figure other than the attacker, apply +1 [Block] to your defense results and that hostile figure suffers 1 ⊠. |
| Point Blank Shot | 3 | declared | When you declare an attack with a PISTOL targeting an adjacent figure, you may replace 1 die in the attack pool with a red die. Apply Pierce 1 to the attack results. |
| Combat Mastery | 4 | action | ⟶ 1✦: Perform 2 attacks, 1 with a [melee] weapon and 1 with a [ranged] weapon. Each attack must have a different target. |
| Master Operative | 4 | passive (+declared) | Apply +1 Endurance to your hero. Exhaust this card when you declare an attack using "Close Quarters" to become Focused. |

#### Vinto Hreeda

| Card | XP | Shape | Text |
|---|---|---|---|
| Hair-Trigger Pistol | — | equipment | Attack: blue + yellow [ranged]. Traits: Blaster - Pistol. ⚡: +1⊠. ⚡: +2 Accuracy. While attacking with this weapon, you may reroll all of your attack dice. |
| Pinpoint Shot | 1 | declared | Exhaust this card while attacking with a [ranged] weapon to remove all ⊠, [Block], ⚡, [Evade], and [Dodge] results. Then, apply +1⊠ to the attack results and the attack gains Weaken. No abilities can modify the results further. |
| Shot on the Run | 1 | action (+passive) | Apply +1 Speed to your hero. Exhaust this card if you've performed a move during this activation and choose a hostile figure within 3 spaces and line of sight. Test [Ins]. If you succeed, that figure suffers 1⊠. |
| Battlefield Experience | 2 | declared (+passive) | Apply +1 Endurance to your hero. Exhaust this card while attacking to reroll 1 attack die. |
| Sharpshooter | 2 | passive | +1 Accuracy. "Boltslinger," "Shot on the Run," and "Rapid Fire" can each affect hostile figures within 4 spaces. |
| Dead On | 3 | declared (+action) | Exhaust this card while attacking to apply +1⊠ to the attack results. Exhaust this card when you use "Boltslinger." The chosen hostile figure suffers 1 additional ⊠. Exhaust this card when you use "Pinpoint Shot." The target suffers 1⊠. |
| Off-Hand Blaster | 3 | equipment (+action) | Attack: blue [ranged]. Traits: Blaster - Pistol. Pierce 1. ⚡: +1⊠. 1✦: Exhaust this card during your activation to perform an attack using this weapon. |
| Merciless | 4 | declared | Exhaust this card while attacking a figure who has suffered ⊠. Apply +3⊠ to the attack results. |
| Rapid Fire | 4 | action (+declared) | 1✦: Exhaust this card during your activation. Each hostile figure within 3 spaces and line of sight suffers 1⊠. While attacking with a [ranged] weapon, you may reroll all attack and defense dice. |

### Imperial classes


#### Armored Onslaught

| Card | XP | Shape | Text |
|---|---|---|---|
| Explosive Munitions | — | declared | Exhaust this card when an Imperial figure declares a [ranged] attack. You may replace 1 die in the attack pool with 1 red die and the attack gains Blast 1⊠. |
| Armor Corps | 1 | declared (+passive) | While defending, Imperial Troopers adjacent to a friendly Droid, Heavy Weapon, or Vehicle may reroll 1 defense die. |
| Automated Repairs | 1 | action (+declared) | Attachment. Heavy Weapon, Droid, or Vehicle only. ⚡: Exhaust this card to recover 2⊠. ⟶: Exhaust this card to recover 1⊠. |
| Explosive Entry | 2 | action | Exhaust this card when you deploy a figure to roll 1 green die. Each Rebel figure adjacent to that figure suffers ⊠ equal to the ⊠ results and becomes Weakened. |
| Heavy Firepower | 2 | declared | Exhaust this card when an Imperial figure declares a [ranged] attack. You may remove 1 red die from the attack pool to apply +3⊠ to the attack results. |
| Mortar | 3 | action | Exhaust this card during an Imperial figure's activation. That figure gains: ⟶: Choose a space within 3 spaces and roll 1 red die. Each figure and object on or adjacent to that space suffers ⊠ equal to the ⊠ results. |
| Reactive Armor | 3 | passive (+declared) | Attachment. Droid or Vehicle only. +2 Health. While defending, if you roll an [Evade] result on a black die, apply +2[Block] to the defense results. |
| Power to Shields | 4 | declared | Exhaust this card while an Imperial figure is defending and choose 1 of the following keywords: Pierce, Blast, Cleave, or any Condition keyword. During this attack, the chosen keyword has no effect. Then, you may pay 1◆ to ready this card. |
| Rapid Dominance | 4 | action | 2◆: Exhaust this card during a Heavy Weapon or Vehicle figure's activation. That figure may perform an additional action. 3◆: Deplete this card to ready 1 Heavy Weapon or Vehicle Deployment card. |

#### Hutt Mercenaries

| Card | XP | Shape | Text |
|---|---|---|---|
| Wanted: Dead | — | declared (+action) | When no heroes have a Bounty token, each hero claims a Bounty token. Exhaust this card while a hero with a Bounty token is defending to apply +1 ⊠ or +1 ⚡ to the results. When a hero with a Bounty token is defeated, discard that token. |
| Scouted | 1 | declared (+action) | Exhaust this card while a hero with a Bounty token is attacking to reroll 1 defense die. If you do, convert all [Dodge] results to [Evade] results. While choosing open groups for missions, ignore the "No [Mercenary] figures" restriction. |
| Vendetta | 1 | declared | Exhaust this card while a hero with a Bounty token is defending to reroll 1 attack die. While attacking, an Imperial figure can spend 1 ⚡ to ready this card. |
| Cheap Shot | 2 | action | Exhaust this card during an Imperial figure's activation and choose an adjacent hostile figure. That figure may test [Str]. If it does not pass, it becomes Weakened. If the Imperial figure is a [Mercenary] figure, apply -1 ⚡ to the test results. |
| Savage Motivation | 2 | action | Exhaust this card during an Imperial figure's activation and choose an adjacent Rebel figure. Roll 1 yellow die. That figure suffers ⊠ equal to the ⊠ results. If the Imperial figure is a [Mercenary] figure, roll 1 blue die instead. |
| Nowhere to Hide | 3 | declared | Exhaust this card before an attack targeting a hero with a Bounty token is declared. Figures do not block line of sight for this attack and you add 1 blue die to the attack pool. |
| Nowhere to Run | 3 | declared | Exhaust this card when an attack targeting a hero who has suffered 3 or more ✦ is declared to apply +1 ⊠ to the attack results. If the attacker is a [Mercenary] figure, apply an additional +1 ⊠ to the attack results. |
| Guild Hunters | 4 | passive (+action) | When you deploy a [Mercenary] figure, that figure becomes Hidden. Imperial figures gain: ⚡: +1 ⊠, +2 Accuracy ⚡: Pierce 2 ⚡: Hide |
| Most Wanted | 4 | declared | Exhaust this card while a hero is defending to apply +2 ⊠ to the attack results. If that hero has a Bounty token, apply an additional +1 ⊠ to the attack results. |

#### Imperial Black Ops

| Card | XP | Shape | Text |
|---|---|---|---|
| In the Shadows | — | action | Exhaust this card at the start of an activation and choose an Imperial figure. That figure becomes Hidden. |
| Shadow Corps | 1 | action | Each Hidden Imperial figure gains: ⟶: Choose an adjacent friendly figure. That figure becomes Hidden. |
| Stealth | 1 | passive (+action) | Attachment. [melee] attacks targeting you require 1 or more Accuracy to not miss. Exhaust this card at the end of your activation to become Hidden. |
| Shadow Armor | 2 | declared | Exhaust this card when an attack targeting an Imperial figure is declared to apply -1 ⊠, -1 ⚡, or -2 Accuracy to the attack results. |
| Surprise Attack | 2 | declared | Exhaust this card when an Imperial figure declares an attack. If the target did not have line of sight to the attacker at the start of this activation, apply +2 Accuracy and +1 ⊠ to the attack results. |
| Execution Squad | 3 | passive | Attachment. You gain: Overload: You can trigger the same ⚡ ability up to twice per attack. |
| Strategic Redeployment | 3 | action (+declared) | Exhaust this card while an Imperial figure is attacking to deploy or reinforce a figure, spending ⚡ results instead of ◆. |
| True Shadow | 4 | declared (+passive) | Attachment. When you are deployed, you become Hidden. You cannot discard the Hidden condition. Deplete this card while defending to apply +1 [Dodge] to the defense results. |
| Versatility | 4 | declared (+action) | During its activation, an Imperial figure may discard 1 Beneficial condition to gain 1 Beneficial condition of your choice. Exhaust this card while an Imperial figure is attacking. The attack gains: ⚡: Hide |

#### Inspiring Leadership

| Card | XP | Shape | Text |
|---|---|---|---|
| Field Officer | — | action (+equipment) | Attachment. Guardian, Leader, or Trooper only. Exhaust this card. You gain: ⟶ Order: Choose a friendly figure within 2 spaces. That figure may interrupt to perform a move. |
| Press On | 1 | action | At the end of each round, choose 1 regular Imperial group. Each figure in that group recovers 1⊠. |
| Supervisory Agent | 1 | action | Deplete this card before activating a group. Deploy 1 regular Imperial Officer from your hand without paying its Deployment cost. |
| Noble Sacrifice | 2 | action | Deplete this card when an Imperial Leader or Guardian is defeated. Choose up to 5 Imperial figures that had line of sight to that figure. Each of those figures becomes Focused. |
| Strategic Planning | 2 | action | Exhaust this card and 1 of your Deployment cards before activating a group. Ready another of your Deployment cards of equal or lesser deployment cost. Each figure corresponding to both Deployment cards gains 1 movement point. |
| Field General | 3 | action (+equipment) | Attachment. Guardian, Leader, or Trooper only. Exhaust this card. You gain: ⟶ Executive Order: Choose a friendly figure within 2 spaces. That figure may interrupt to perform a move or attack. |
| Imperial Dedication | 3 | action | 1◆: Exhaust this card when an attack targeting an Imperial figure is declared. Choose an Imperial figure adjacent to the target who could also be the target of that attack. That figure becomes the target of that attack. |
| Lead By Example | 4 | action | After a figure resolves an "Order," it may perform a move. After a figure resolves an "Executive Order," it may perform a move or attack. |
| Optimal Tactics | 4 | declared (+passive) | While attacking, other Imperial figures within 3 spaces of a friendly Leader apply +1⊠ to their attack results and may reroll 1 attack die. |

#### Military Might

| Card | XP | Shape | Text |
|---|---|---|---|
| Show of Force | — | action | Exhaust this card when an Imperial figure declares an attack. That figure becomes Focused. |
| Combat Medic | 1 | action | 1◆: Exhaust this card at the end of a Trooper's activation. That figure and each adjacent Imperial figure recovers 2⊠. |
| Riot Grenades | 1 | action | Attachment. Trooper only. ⟶: Exhaust this card to choose a space within 3 spaces. Each figure on or adjacent to that space tests [Ins]. Each figure who fails suffers 1✦. |
| Assault Armor | 2 | passive (+declared) | Attachment. +2 Health. Exhaust this card while defending to reroll 1 black die. |
| Endless Ranks | 2 | action | When you deploy a Trooper, reduce its deployment cost by 1. |
| Shock Troopers | 3 | declared | While an Imperial Trooper is attacking a figure within 2 spaces, apply +1⚡ to the attack results. |
| Sustained Fire | 3 | action | Exhaust this card after an Imperial figure resolves an attack. That figure performs an additional attack. Then that figure becomes Stunned. |
| Combat Veterans | 4 | passive | Attachment. Trooper only. While defending, apply +1[Block] to the defense results. While attacking, apply +2 Accuracy and +1⊠ to the attack results. |
| Shock and Awe | 4 | declared (+action) | At the end of each round, place 1 strain token on this card. Then you may spend 1◆ to place an additional strain token on this card. When an Imperial figure declares an attack, you may discard 1 strain token from this card to apply +1⊠ to the attack results. Limit once per attack. |

#### Nemeses

| Card | XP | Shape | Text |
|---|---|---|---|
| Inspirational | — | declared | Exhaust this card when a figure declares an attack to choose a villain on the map or reveal a villain in your open or reserved groups. During this attack, non-villain Imperial figures that share a trait with the chosen or revealed villain gain +1 ⚡ and +1 [Evade]. |
| Powerful Foes | — | action | You earn 1 [Imperial] and 1 [Mercenary] villain of your choice. After choosing open groups, add 1 earned villain to your hand of open groups. 1◆: Deplete this card when you deploy a villain to reduce its deployment cost by the threat level. |
| Fearsome Presence | 1 | action | Exhaust this card at the end of your activation. Each Rebel figure adjacent to an Imperial figure with a figure cost equal to or greater than the threat level suffers 1 ✦ for each activation token he has. |
| Prepare the Ambush | 1 | action (+passive) | When it is your turn to activate a group, you may exhaust this card instead of activating a group. At the start of its activation, each figure in the first Imperial group to activate each round gains 2 movement points. |
| I'm on the Leader | 2 | declared | Exhaust this card while an Imperial figure is attacking the healthy hero who has suffered the least ⊠. Apply +2 ⊠ to the attack results. |
| Ringleader | 2 | passive (+action) | Attachment. Villain only. At the start of your activation, you gain 2 movement points. While an adjacent friendly figure is attacking, apply +1 Accuracy and +1 ⊠ to the attack results. |
| Leave Them to Me | 3 | action | After choosing open groups, add 1 earned villain to your hand of open groups. Deplete this card when you deploy a villain to reduce that villain's deployment cost by 5. Exhaust that villain's Deployment card. |
| Punishing Force | 3 | declared | Exhaust this card while an Imperial figure is attacking to reroll any number of attack dice. Ready this card at the end of each Rebel activation. |
| Devastating Legion | 4 | declared | While a Rebel figure within 3 spaces of a villain is defending, you may apply -1 [Block] or -1 [Evade] to the defense results. |
| Indomitable | 4 | declared (+passive) | Villains cannot receive Harmful conditions. Exhaust this card when an attack targeting a villain is declared to add 1 black die to that villain's defense pool. 1◆: Use when an attack targeting a villain is declared to ready this card. |

#### Power of the Dark Side

| Card | XP | Shape | Text |
|---|---|---|---|
| Manifest Aggression | — | action | Exhaust this card at the start or end of a round and choose up to 2 Imperial figures. Each of those figures gains 1 [Power token]. Exhaust this card at the start of an Imperial figure's activation. That figure gains 1 [Power token]. |
| Dark Resurgence | 1 | action | Deplete this card when an Imperial figure would be defeated. Instead, that figure recovers 3 ⊠. |
| Embrace Fear | 1 | action | At the start of the first Rebel activation each round, the activating figure may test [Ins]. If it does not succeed, it suffers 1 ✦. Exhaust this card at the start of an Imperial figure's activation. That figure gains 1 movement point. |
| Embrace Anger | 2 | declared | Exhaust this card when an Imperial figure declares an attack. That figure suffers 1 ⊠. Then, apply +1 ⊠ to the attack results. Ready this card at the end of each Imperial group activation. |
| Supernatural Vigor | 2 | action (+passive) | At the start of each round, choose 1 Imperial figure. That figure gains +3 Health until the end of the round. |
| Embrace Hate | 3 | action | At the start of each Status Phase, choose a Rebel figure. The chosen figure suffers 1 ✦. Then, if the chosen figure is in line of sight of an Imperial figure, that Imperial figure also suffers 1 ⊠ and gains 1 [Power token]. |
| Unnatural Abilities | 3 | passive (+action) | Attachment. Non-Creature only. +1 [Evade] +1 [Block] also if the starting group size is 1. At the end of this group's activation, one figure in this group gains 1 [Power token]. |
| Embrace Suffering | 4 | action | Exhaust this card at the end of a round and choose a Rebel figure. Push that figure up to 2 spaces. 2◆: Exhaust this card at the end of a round and choose a Rebel figure. Perform an attack with that figure. |
| The Power of Passion | 4 | declared (+passive) | When an Imperial figure spends a [Power token], apply +1 ⚡ to the attack results (in addition to the +1 ⊠ for spending the token). Exhaust this card while an Imperial figure is attacking to reroll any number of attack dice. |

#### Precision Training

| Card | XP | Shape | Text |
|---|---|---|---|
| Strike Force | — | declared (+passive) | Attachment. While attacking, you may reroll 1 attack die. |
| Pinpoint Accuracy | 1 | declared | Deplete this card while an Imperial figure is attacking to apply -1[Dodge] to the defense results. |
| Sharpshooters | 1 | passive | While an Imperial figure is attacking, apply +1 Accuracy to the attack results. |
| Knowledge of Attack | 2 | declared | Exhaust this card while an Imperial figure is defending to apply -1⚡ to the attack results. |
| Versatile Attack | 2 | declared | 1◆: Exhaust this card when an Imperial figure declares an attack to add 1 yellow die to the attack pool. The attack gains: ⚡: Weaken. ⚡: +1⊠. ⚡: Pierce 2. |
| Assassins | 3 | declared (+passive) | Attachment. Figures do not block line of sight for your attacks. Exhaust this card while attacking to reroll any number of attack dice. |
| Exacting Strike | 3 | declared | 2◆: Exhaust this card when an Imperial figure declares an attack to remove 1 die from the target's defense pool. |
| Find the Weakness | 4 | passive | While an Imperial figure is attacking, apply Pierce 1 to the attack results. |
| Single Minded | 4 | declared | Exhaust this card when an Imperial figure rerolls an attack die. Instead of rerolling that die, change that die's result to another result of your choice on that die. 1◆: Ready this card. |

#### Reactive Defenses

| Card | XP | Shape | Text |
|---|---|---|---|
| Active Surveillance | — | action | At the start of each mission, deploy 88-Z. Exhaust this card during an optional deployment to deploy 88-Z. 88-Z activates at the start or end of an Imperial activation. |
| Blaster Emplacements | 1 | declared (+action) | At the end of each round, choose a Rebel figure. Then, roll 1 yellow die. That figure suffers ⊠ equal to the ⊠ results. Exhaust this card when an Imperial figure declares an attack. Apply +2 Accuracy to the results. |
| Shielded | 1 | declared (+action) | 88-Z gains ⟶: Place 1 energy shield in an adjacent space. A figure can attack these energy shields (Health: 5, Defense: 1 [Block]). Exhaust this card when an attack targeting an Imperial figure is declared to apply +1 [Block] to the defense results. |
| Mechanical Protocol | 2 | declared (+action) | 88-Z gains ⟶: Up to 2 other figures within 2 spaces of you each gain 1 [surge token]. Exhaust this card while a Droid (including 88-Z) is attacking to apply +1 ⊠ to the attack results. |
| Remote Activator | 2 | action | Attachment. ⟶: 88-Z may interrupt to perform a move, attack, or special action. Limit once per group activation. Exhaust this card during your activation for 88-Z to gain 2 movement points. |
| Electromagnetic Disruptors | 3 | passive (+action) | While a Rebel figure within 3 spaces of 88-Z is attacking, apply -1 Accuracy to the results. Exhaust this card after 88-Z activates. Distribute 2 [Block token] or [Evade token] among figures within 3 spaces. A figure can gain a [Block token] only if it rolls a white die or an [Evade token] only if it rolls a black die. |
| Infrared Scanners | 3 | action (+passive) | 88-Z gains ⟶: Choose a hero in your line of sight. That hero may suffer 1 ✦ to test [Ins]. If it does not succeed, increase ◆ by 1. At the start of each Imperial figure's activation, that figure gains 1 movement point. |
| Overclock | 4 | action (+passive) | Exhaust this card to ready 88-Z. 88-Z gains: ⟶: Gain 1 [Power token]. 88-Z can perform 3 actions each activation. |
| Targeting Sensors | 4 | declared (+passive) | When another Imperial figure within 2 spaces of 88-Z declares an attack, apply +1 ⊠ and +1 Accuracy to the attack results. Exhaust this card while an Imperial figure is attacking to apply +1 ⊠ to the attack results. |

#### Subversive Tactics

| Card | XP | Shape | Text |
|---|---|---|---|
| Prey Upon Doubt | — | declared | Exhaust this card when a Rebel figure declares an attack. The Rebel figure chooses to either suffer 1 ✦, or apply +1 [Evade] to the defense results. |
| Savage Weaponry | 1 | passive | Attachment. Pierce 1 ⚡: Bleed |
| Surgical Strike | 1 | action | Exhaust this card after an Imperial figure resolves an attack. The target suffers 1 ✦ and 1 ⊠. |
| Exploit Weakness | 2 | action | Exhaust this card after a hero rests. An Imperial figure can interrupt to perform a move or perform an attack targeting that hero. |
| Heavy Pressure | 2 | action | Exhaust this card when a hero would suffer ⊠ from an attack. Instead of suffering ⊠, that hero suffers an equal amount of ✦. |
| Executioner | 3 | declared | 1◆: Exhaust this card when an Imperial figure declares an attack targeting a hero. Apply +1 ⊠ for each ✦ the hero has suffered, to a maximum of +3 ⊠. |
| Weary Target | 3 | action | At the end of each round, choose 1 hero who has not suffered ✦ equal to his Endurance. That hero suffers 2 ✦. |
| No Quarter | 4 | passive | When an Imperial figure declares an attack targeting a hero who has suffered 2 or more ✦, apply +1 ⚡ to the attack results. |
| Oppression | 4 | passive | When a hero who has suffered 2 or more ✦ declares an attack, apply +1 [Evade] to the defense results. |

#### Technological Superiority

| Card | XP | Shape | Text |
|---|---|---|---|
| Experimental Arms | — | declared | Attachment. While attacking, you may apply +1 ⚡ to the attack results. Then, after the attack is resolved, you suffer 1 ⊠. |
| Jetpacks | 1 | passive | Attachment. Trooper only. You gain "Mobile." |
| Technical Support | 1 | action (+passive) | Apply +1 Speed to each Imperial Droid. Each of those figures also gains: ⟶: Choose an adjacent friendly figure. That figure may discard all conditions, become Focused, or recover 3 ⊠. |
| Failsafe | 2 | action | 2◆: Exhaust this card when an Imperial figure suffers ⊠ equal to its Health. Instead of being defeated, that figure recovers 1 ⊠ and gains 3 movement points. |
| Hidden Detonators | 2 | action | 1◆: Exhaust this card at the end of a round to choose 1 Imperial figure. Each figure and object adjacent to the Imperial figure suffers 2 ⊠. Then the Imperial figure is defeated. |
| Arc Blasters | 3 | passive (+action) | Attachment. After resolving a [ranged] attack, each figure that suffered 1 or more ⊠ tests [Str]. Each figure that fails is Stunned. If you have the [ranged] attack type, you gain: ⚡: +1 ⊠, Blast 1 ⊠ |
| Cloaking Device | 3 | passive | Attachment. Trooper or Droid only. Add 1 white die to your defense pool. |
| Adaptive Weapons | 4 | declared | While an Imperial figure is attacking, you may replace 1 die in its attack pool with another attack die of your choice. |
| Superior Augments | 4 | passive | If a group has 1 or more attachments, apply +1 Speed to each figure in that group. While a figure in a group with 1 or more attachments is attacking, it applies +1 ⊠ to the attack results. |
