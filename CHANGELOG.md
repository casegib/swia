# Changelog

All notable changes to the SWIA system. Versions match git tags and `system.json`.

## Unreleased — class-card mechanics pass

Class decks carry real gear — Repeating Blaster, Trophy Armor, Vibrobayonet — 22 hero cards are always-on stat bumps ("Apply +2 Health to your hero"), and 93 hero and imperial cards are declared, costed roll effects ("Exhaust this card while attacking to apply +2 Damage"). Stage 1 tags the gear with its deck, stage 2 makes the passives real, stage 3 puts the declared effects on the roll surfaces as buttons.

### Player Guide and GM Guide
- Two guides, written for the system as it stands: `docs/PLAYER_GUIDE.md` (your card, rolling, the Combat Window, power tokens, conditions, class cards, gear, between missions, a one-page reference) and `docs/GM_GUIDE.md` (install, the map of the system, building heroes and items, villains and the Imperial deck, permissions, running a mission, combat from the GM's chair, derived stats, conditions, the tracker, what the engine leaves to the table, troubleshooting, reference).
- They ship as a seventh compendium, **SWIA Guides**, with one journal per guide and a page per section, generated from the markdown by `npm run build:packs` (`scripts/build/md.mjs`).

### Declared effects from a friend's card
- A declared effect now says whose roll it belongs on: the owner's own, a friend's, or either. Called Shot, Wookiee Loyalty, Get Down and Coordinated Attack work on either; Dig In, Professional Aide, Adrenal Vapor, Stay Behind Me, Scouts Guidance, Ringleader and Targeting Sensors' passive clause work on a friend's. Both roll surfaces list a friend's lendable cards beside the acting figure's own, prefixed with the friend's name; the friend's card is what gets exhausted (or strained), and the friend's player can click it themselves in the combat window — they don't need control of the acting figure. Undo and Cancel refund the friend's card the same way.
- "Friend" means the same side: heroes and their companions, or villains (a companion pinned to a villain counts as Imperial). In the solo roll dialog a friend's card is offered only when this client may pay for it — the friend is yours or you're the GM — since there's no relay to the owner's client there.
- The card sheet's declared-effect editor gained the **For** field (own roll / a friend's roll / either).

### Item quality-of-life
- **Reorder your kit.** Rows in every hero-sheet column (Weapons, Armor, Class Cards, Accessories, unattached mods — and the villain Attachments panel) drag within their column; the order is saved on the items and survives reloads. Owners can arrange their own sheet. Class Cards keep their XP-then-name order until you drag one.
- **Give to…** A hand icon on weapon, armor, accessory and mod rows moves the item to another hero. A weapon takes its attached mods along; a lone mod arrives detached; armor arrives unequipped. Handing to another player's hero relays through the GM (one must be online); a chat line records the handover.
- **Weapon exhaust abilities are real.** The weapon sheet gained an Exhaust Abilities editor (trigger + text), and the hero sheet's weapon details show each one with a **Use** button that posts it to chat and exhausts the weapon (disabled unless the weapon is ready).
- **Class cards can cost XP.** New world setting *Class cards cost XP* (off by default): dropping a class card on a hero — sheet or Player Area — spends its printed XP from the hero's unspent XP. A hero who can't afford it is refused with a notice; the GM is asked whether to add it unpaid.
- The Companion and Imperial portals now use the shared card-preview helper instead of their own copies (one preview element, one timing, ~150 lines fewer).

### Imperial attachments and class-wide cards
- The Imperial player's class deck is the list of Imperial class cards in the world (what the Imperial portal shows). A card there is **class-wide**: its always-on effect and its declared effects now apply to every villain — Sharpshooters seeds +1 Accuracy on every Imperial attack, Find the Weakness adds Pierce 1, Shock Troopers offers its +1 Surge button on any villain's attack. Exhausting a class-wide card exhausts it for the whole side, as on the table.
- Cards printed **"Attachment."** (20 of the 100) are flagged as such and don't apply from the deck. Drag one onto a deployment group's villain sheet instead: the new **Attachments** panel on villain sheets lists them with their effect chips and declared-effect summaries, each copy keeps its own exhaust state, and the effects apply to that group alone — Reactive Armor's +2 Health lands on the group's max, Combat Veterans seeds +1 Block on defense and +2 Accuracy / +1 Damage on attack, Cloaking Device adds a white die to the pool. A non-attachment card dropped on a group is marked *Class-wide* on the row as a reminder that it already applies from the deck.
- Declared effects can now cost **threat**: Versatile Attack (1), Exacting Strike (2) and Executioner (1) charge the Campaign Tracker's threat pool when declared and refund it on Undo or Cancel; the button disables when the pool is short.
- Imperial class cards carry `imperialClass`, `classXp` and `attachment` in their data (lifted from flags and text for cards already in a world), and their sheet exposes all three.

### Stage 3 — declared card effects are buttons
- Class cards gained a **declared effects** list: each entry says which roll offers it (attack, defense, attribute test), its printed condition, its cost (exhaust, strain, deplete — any mix), the shifts and dice it applies, and any surge abilities the attack gains. 78 cards ship with theirs filled in from the transcriptions (59 hero, 19 imperial; 96 entries — cards with a "choose one" split into one entry per option, which lock each other out).
- **Combat window.** Each side gets a Class Cards block under its declared bonuses, one button per eligible effect showing the effect glyphs, the cost chips and the printed condition. Clicking pays the cost on the spot — the card flips to exhausted or depleted, strain comes off endurance — and the effect lands: attack shifts on the attacker's row, defense shifts on the defender's, whichever side declared it (Hold Still takes a Block off the defender; Shadow Armor takes a Damage off the attacker, even after the attack has rolled); extra dice join the pool; Pierce joins the keywords line; granted surge abilities appear on the result card with the card's name. Every declared effect has an Undo that refunds exactly what it paid, and Cancel refunds them all. Buttons disable when the card is already exhausted or depleted, endurance is short, or a sibling option is already declared, with the reason in the tooltip. The bonus tooltip gained a **Cards** column.
- **Solo roll dialog.** A Class Cards fieldset lists the same effects for the roll's kind — attribute tests included, so Force Adept's blue die shows up on a Strength test. Toggle to declare; dice move in and out of the pool at once, costs are paid when Roll is clicked (an effect that can no longer be paid is dropped with a notice), and the card lists each declared effect beside the condition notes.
- **Card sheet.** View mode lists the declared effects; edit mode has a row editor per entry (roll kind, cost, condition, choice group, the full modifier grid) with add/remove, so house-ruled cards can carry effects too. Surge grants are shown but edited only through the data files.
- What stays text, on purpose: reroll cards (rerolls are already unlimited until a surge spend), die swaps and result conversions, effects on *another* figure's roll (Called Shot, Dig In, Professional Aide — the button appears on the owner's own rolls with the printed condition; use the manual steppers on the friend's roll), Dodge shifts, and threat costs on imperial cards (noted on the button).


### Stage 2 — class-card passives apply themselves
- Class cards gained an **always-on effect** block: stat bonuses (Health, Endurance, Speed), attack shifts (Damage, Surge, Accuracy, Pierce), defense shifts (Block, Evade) and extra dice. Owning the card is enough — there is no equip toggle, because a purchased class card is always in play.
- **Max Health, max Endurance and Speed are now derived**: printed base + equipped armor + owned class-card passives. The sheet shows the total with a "+N" note (hover for the breakdown); edit mode shows and writes the printed base. Buying Art of Movement ticks Speed from 4 to 5; Rebel Elite adds +3 Health and +1 Endurance the moment it lands on the hero. Remaining health/endurance shift with the max so damage and strain already taken stay put, exactly as armor already did.
- **Attack and defense passives feed the dice**: Bank Shot's +1 Accuracy seeds the attacker's bonus row in the combat window and the solo attack card; Mon Cala Special Forces' +1 Evade seeds the defender's row next to armor; always-on Pierce (Find the Weakness, Savage Weaponry, once those reach an actor) joins the weapon's Pierce; extra dice (Cloaking Device's white die) join the pool. Every seed is a named note on the roll — "Bank Shot (+1 Accuracy)" — beside the condition notes. The combat window's bonus tooltip column reads **Gear** rather than Armor, since it now sums both.
- The 23 hero cards with an unconditional stat clause (plus 8 imperial attachments / class-wide cards, carried in the data for the attachments pass) come pre-filled in the packs; the Class Cards column and the card sheet show the effect as chips.

### Stage 2 — one modifier shape for armor and cards
- Armor's three flat fields (`bonusHealth` / `bonusBlock` / `bonusEvade`) moved onto the same **modifier** schema class cards use. The armor sheet's editor now exposes every slot (stats, attack, defense, dice) for house-ruled pieces; printed cards still only fill Health / Block / Evade. **Existing armor migrates automatically** — in memory on load, and written back once on the GM's first load so the old fields are gone from the world.
- Under the hood, `equipmentEffectsFor(actor)` in `common.js` is the single chokepoint for "what does this figure's gear do", replacing `armorEffectsFor`; the actor models, the pool builders, the combat window / solo dialog seeds and the sheets all read it. Conditions keep their own registry (they also discard); their per-role output already matched this shape.

### Stage 1 — class-deck equipment knows its deck

- Weapons, armor, modifications and equipment gained `heroClass` and `classXp` fields. A tagged item stays in its own column (Weapons / Armor / Accessories) and wears an XP badge there — **Starter** for 0-XP cards — so the Class Cards column lists only feat cards and nothing shows up twice.
- Every row in the Class Cards column now shows an XP badge (or **Starter**), and the column sorts by XP, then name.
- Weapon, armor and mod sheets show a "Deck · N XP" chip in the title strip; the equipment sheet shows it under the name. Edit mode has a Class Deck row (hero class + XP) on all four sheets.
- The pack generator writes the tag into `system` (it was flags-only), so freshly imported class-deck items list correctly. **Items from the 0.1.8 packs are tagged automatically**: anything already in the world on the GM's first load, and anything imported later as it is created — so the old packs keep working until the next rebuild.

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
