# SWIA GM Guide

The GM's side of the Star Wars: Imperial Assault system for Foundry VTT: install, build, permissions, running a mission, and what the engine does versus what it leaves to you. Players have their own guide; its sections on rolling, combat, tokens, conditions and class cards apply to you unchanged, so this guide doesn't repeat them except where the GM's view differs.

## 1. Install and update

The system requires Foundry VTT v13. Install from the manifest or copy the folder into `Data/systems/swia`. After every update **restart the world** — data models, hooks and the language file load at world start, and a reloaded browser on an un-restarted world shows the old system. Then tell players to reload.

Migrations run on the GM's first load of each version and report in the console (and, when they change something, as a notification): legacy `ability` items become class cards; class-deck equipment and Imperial class cards imported from older packs get their deck tags lifted from flags into their data; armor's old three-field effects fold into the shared modifier. None of them need anything from you.

The system ships six compendiums under one "Imperial Assault" folder plus this guide and the Player Guide as journals. Card art is not shipped: see the README for the two-step install from the `imperial-assault-data` scans into `assets/cards/`. Without it, items show a placeholder and send-to-chat posts a generated text card instead of the scan.

Two settings live in Foundry's Settings menu: **Class cards cost XP** (Section 13) and **Configure Conditions** (Section 12). Everything else the system stores — round state, campaign resources, the active combat, migration markers — is a hidden world setting by design.

## 2. The GM's map of the system

Six buttons sit at the top of the Actors sidebar. **GM Area** (GM only) is the round tracker and status board. **Player Area** (everyone) is the players' home. **Companion Area** (everyone) stages unassigned allies. **Imperial Area** (GM only) is your deployment groups and the Imperial deck. **Campaign Tracker** (everyone, GM edits) holds resources, hero XP and the mission log. **Combat Window** (everyone) reopens the combat in progress.

One actor sheet serves heroes, villains and allies with type-specific sections. Characters are simplified NPCs with a hidden disposition; objects are map props with health, defense dice and prose interactions. Items are weapons, weapon mods, armor, gear (accessories), class cards, Imperial class cards, agenda cards, form cards and hero abilities.

Where state lives: figures and their gear are actors and embedded items; the Imperial deck is world-level items; power tokens and conditions are status effects on the actor; round state, campaign resources and the live combat are world settings.

## 3. Building a hero

Fastest path: drag the hero from the **Heroes** compendium. It arrives with both sides filled, its abilities, its attribute pools and its starting class-deck equipment already on the sheet. Then drop class cards on it from **Class Cards (Hero)** as they're bought.

Building by hand: create the actor, set the portrait (portrait and token art are set together; **wounded token art** is separate, under Token Setup in edit mode). Edit mode is GM-only, toggled in the sheet header, and saves when you turn it off. The Healthy | Wounded stat tabs edit both attribute sets without changing the hero's state.

Enter **printed** values for Health, Endurance and Speed. Gear is added on top automatically and shown beside the input as +N; the display side shows the total with a breakdown on hover. Never type the armor bonus into the base — it would be counted twice.

Attributes are dice chips. Custom attribute slots (enable, label, icon, dice) roll like the printed ones. Hero abilities can be typed in or dropped on as **Hero Ability** items — the text is copied, and the healthy or wounded list is chosen by the hero's current state.

## 4. Items from cards

Use the compendiums first. **Class Cards (Hero)** is one folder per hero with the equipment cards as real weapon, armor and mod items; **Items, Supply & Rewards** is the item deck by tier; **Deployment Groups** are ready villain and ally actors. Everything in them carries the transcribed text with inline icons, structured surges that become spend buttons, and the mechanics below already filled in.

Item sheets do **not** autosave: press **Save**. Edit toggle is GM-only. The card image is the scan — click to upload, and the framing sliders pan and zoom it.

**Weapons** carry range, class and subtype, attack dice (or an **Attack Pool Source** — Strength, Insight or Tech — for weapons that use the wielder's pool), accuracy, attachment slots, keywords (Pierce, Blast, Cleave, Reach), printed ability rows, structured surge rows with an **exhaust to use** flag, and **exhaust abilities** (trigger + text; the hero sheet gives each a Use button). The engine reads dice, accuracy, pierce, surges and exhaust flags; the rest is display for the table.

**Weapon mods** carry melee/ranged compatibility (drives the subtype list and attach validation), bonus dice, damage, accuracy, keywords and surge rows. Attach them from the hero sheet's Unattached Mods block, not by typing the weapon id.

**Armor** carries an **Effects** editor on the shared modifier grid: Health (adds to the wearer's max while equipped), Block and Evade (pre-seed every defense roll), and, for house-ruled pieces, the other slots too. Conditional text like "+1 Block against Ranged" goes in a printed ability row and is a manual stepper bump in combat. Weight class is a table convenience with no rules attached.

**Class cards** carry XP cost, hero class, ability text, an **always-on effect** (the same modifier grid: stats, attack shifts, defense shifts, dice) and a list of **declared effects**, each with the roll it belongs on, whose roll offers it (own, a friend's, either), cost (exhaust, strain, deplete, threat), a printed condition shown on the button, a choice group for choose-one cards, the modifier, and any surge abilities the attack gains. The pack cards come filled in — 23 hero cards with passives, 78 cards with declared effects — and the editor lets you build a house-ruled card the same way. Surge grants on a use are shown on the sheet but edited only in the data files.

Weapons, armor, mods and gear that belong to a class deck carry a **Class Deck** row (hero class + XP). Set it and the item wears a Starter or N XP badge in its column.

**Form cards** (villain Shift) and **Hero Ability** items work as before. Sending any item to chat posts the scan when there is one, otherwise a generated text card.

## 5. Villains, allies, NPCs, objects

The villain and ally sheet has deploy and reinforce cost, group size pips, elite and unique flags, affiliation, traits, attack dice with a melee/ranged toggle, surge abilities, special abilities (a surge cost above 0 puts one in the attack's surge panel), reward, and **token footprint** presets for massive figures. **Shift**: enable it, drop form cards, pick the active form; its abilities feed the surge panel.

Villains have no weapon or armor columns. What they do have is an **Attachments** panel (Section 6). Allies use **Companion Of** to nest under a hero (Player Area) or a villain (Imperial Area); unassigned allies live in the Companion Area. A companion pinned to a villain counts as Imperial for card purposes.

**Characters** have a preferred disposition and an eye toggle that reveals it; until revealed, new tokens are placed Neutral — the hidden-villain trick. **Objects** have type, traits, state, health and defense dice (not rollable from the sheet) and prose interaction text.

## 6. The Imperial deck

The Imperial player's purchased class deck is the list of **Imperial Class Cards in the world** — what the Imperial Area shows in its class card column. Drag cards there from **Class Cards (Imperial)**. A card in the deck is **class-wide**: its always-on effect and its declared effects apply to every villain. Sharpshooters seeds +1 Accuracy on every Imperial attack, Find the Weakness adds Pierce 1, Shock Troopers offers its +1 Surge button on any villain's attack. Exhausting a class-wide card exhausts it for the whole side, as on the table, and readying it in the Imperial Area readies it for everyone.

Cards printed **"Attachment."** (20 of the 100) don't apply from the deck. Drag one onto a deployment group's villain sheet instead: the **Attachments** panel lists it with its effect chips and declared-effect summaries, each copy keeps its own exhaust state, and the effects apply to that group alone — Reactive Armor's +2 Health lands on the group's max, Combat Veterans seeds both sides of its rolls, Cloaking Device adds a white die to the pool. "Trooper only" and the like are printed, not enforced on drop. A non-attachment card dropped on a group is marked *Class-wide* on its row as a reminder that it already applies from the deck; leave those in the deck.

Some declared effects cost **threat** (Versatile Attack 1, Exacting Strike 2, Executioner 1). They charge the Campaign Tracker's Threat when declared, refund on Undo or Cancel, and grey out when the pool is short. Other threat costs printed on cards are noted on the button, not charged.

Villains re-prepare whenever the deck changes, so the sheet numbers follow a card being added or removed.

## 7. Permissions and what players see

OBSERVER makes an actor appear in a player's Player Area; OWNER lets them act on it. You see the whole player-facing roster. Withhold OBSERVER on an ally until its reveal.

Who can press what: state pills, steppers, card states, rolls, declared effects, reorder and Give to… — the owner or you. XP, drops onto Player Area columns, power-token grants, edit mode — you. Combat Window: the owner of that side or you; plus, for a lent card, the owner of the lending figure. Surge spends and rerolls on chat cards: the roller or you. Players' actions on chat cards and in combat relay through your client, so a **GM must be connected** for players to act.

Owners can drop items on their own sheet (the Player Area drop zones are yours). A player's Give to… that lands on someone else's hero relays through you.

## 8. Running a mission

The **GM Area** header carries the round counter, the Activation/Status phase toggle, Threat Level and Threat, and the round buttons: **Reset Activations** and **End Round** (no confirmation), **Reset Round** (confirmed). Every card on every board has an activation token; flipping a figure to activated also discards its end-of-activation conditions.

**Status phase**: Ready All per figure, on the portal or the sheet. Depleted cards need a deliberate manual ready. Threat accrual per round is yours to do in the Campaign Tracker; the GM Area only displays it. Deploy and reinforce costs and group size are tracking fields; the Imperial Area shows On Map counts and per-token health bars for reading.

Damage outside combat: the health steppers on any card. Conditions: from the token HUD or the tray on the sheet and Player Area cards; five carry rules (Section 12). Power tokens: the ± trays on the hero sheet header and Player Area cards, or the token HUD.

## 9. Combat, the GM's view

The window opens on every client and you can act for either side. Each **Declared Bonuses** row is a stack of layers — Manual, Gear, Tokens, Conditions, Cards — summed on the row with the breakdown in its tooltip. Gear is what the engine already knows (armor, class-card passives, attachments, class-wide cards); Conditions is Hidden, Weakened and friends; Cards is whatever has been declared from the Class Cards block; Tokens are declared power tokens; Manual is your stepper, which can be pulled negative to cancel a seed that doesn't apply this time ("+1 Block against Ranged" on a melee attack).

The **Class Cards** block on each side lists the acting figure's own declared effects and any a friendly figure can lend, with the friend's name prefixed. Declaring pays on the spot and applies to whichever side the modifier belongs to, even after the attack has rolled — a defender declaring Shadow Armor takes a Damage off the attacker's result. Undo refunds; Cancel refunds everything, tokens included.

The rules the engine applies: rerolls are free until a surge is spent and unlock when the spend is undone; Evade results eat surges; Pierce subtracts from Block; a Dodge result zeroes the damage. **Apply Damage** is wounded-aware, clamps at 0, posts a summary card, discards the attacker's after-attack conditions and closes the window. **Cancel Combat** has no confirmation.

Solo rolls (untargeted attacks, tests, defense rolls) have the same rerolls, surge undo, token declaration and card declaration as the window, minus post-roll undo of tokens and cards. A combat saved before a system update is discarded at load; if the window says a combat is already in progress, resolve or cancel it from the window.

## 10. Power tokens

Tokens are status effects, one per token so they stack. Grant them from the trays or the token HUD; nothing grants them automatically — card text is yours to adjudicate. The map badge replaces the stock status icons with one icon and count per type held.

Declaration is the rule: attacker tokens during setup, defender tokens until the defense roll, solo tokens at Roll. Tokens are consumed when declared; Undo and Cancel restore them; a miss does not refund a declared Block token.

## 11. Health, endurance, speed and gear

Max Health, max Endurance and Speed are **derived**: printed base plus equipped armor plus class-card passives plus, for villains, attachments and class-wide cards. The sheet's edit inputs read and write the base. When a max moves — armor equipped or unequipped, a card added, removed or edited — the current value moves with it so damage and strain taken stay constant: 10/12 wearing +2 armor is 12/14, not 10/14. Both hero sides get the bonus; the wounded side's own printed numbers are the base there.

Armor and passive Block and Evade seed the defender's rows; passive Accuracy, Damage and Surge seed the attacker's; passive Pierce joins the weapon's; extra dice join the pool. Every seed is a named note beside the conditions. Multiple equipped armor pieces stack — if your table plays otherwise, unequip.

## 12. Conditions

Built-ins with rules: **Focused** (+1 green on attacks and tests, discarded after the roll), **Hidden** (+1 Surge attacking, −2 Accuracy to attackers, discarded after attacking), **Weakened** (−1 Surge attacking, −1 Evade defending, discarded at end of activation), **Stunned** (attack refused; players get a warning, you get an override), **Bleeding** (Suffer button: 1 strain per action, damage once endurance is 0). Movement restrictions and per-action counting are not tracked.

**Settings → Configure Conditions** defines custom ones: name, icon, extra dice, result shifts, discard triggers, cannot-attack, strain per action. They appear in the token HUD and the trays and run through the same pipeline. Built-in rules can't be edited there; house-rule a variant as a custom condition with a different id. The old icon-only Blind, Scanned, Recon and Wanted statuses were removed; their icons remain in `icons/` for recreating any of them as a marker.

## 13. Between missions

The **Campaign Tracker** holds seven resources (Credits, Campaign XP, Requisition, Imperial XP, Imperial Influence, Threat Level, Threat), a hero XP grid, and the mission log (name, type, outcome, ally unlocked). Add and remove missions save immediately; everything else on Save. Hero XP is the same field the sheet and the Player Area show.

**Class cards cost XP** (Settings) makes a class card drop — sheet or Player Area — spend its printed XP from the hero's unspent XP. A hero who can't afford it is refused; you get an "add it unpaid?" prompt. Off by default, so XP is spent under your supervision.

Trading is the players' Give to… button (Section 8 of the Player Guide); you can give from any sheet. Healing is the Healthy pill.

## 14. What the system does not do

Blast, Cleave, adjacency, line of sight, movement, range versus accuracy: reminders on the card, adjudicated by eye. Printed conditions on declared effects ("within 3 spaces", "Trooper only") are shown, never enforced. Reroll cards have no button because rerolls are already free; die swaps and result conversions are text. Threat accrual, deployment and activation order are bookkeeping. Strain beyond endurance is refused on a declared effect rather than converted to damage. Dodge shifts from cards have no layer. Agenda card fields (influence, type, mission effect) exist in data but the sheet does not expose them.

## 15. Troubleshooting

Nothing changed after the update — restart the world, then reload. Every label shows as a raw `SWIA.…` key — the language file failed to load; run `npm run check:lang` (a key that is also a prefix of another key breaks the whole file). Combat window empty or can't attack — an old combat is active; cancel it. A player can't see their hero — OBSERVER; can't act on it — OWNER. "A GM must be connected" — the relay needs an active GM. Item edits vanished — item sheets need Save. A compendium shows up empty after an update — its compiled folder is missing from the install.

## 16. Reference

**Sidebar buttons.** GM Area (GM), Player Area (all), Companion Area (all), Imperial Area (GM), Campaign Tracker (all; GM edits), Combat Window (all).

**Status effects.** Conditions: Focused, Hidden, Weakened, Stunned, Bleeding, plus any custom. Power tokens: Damage, Surge, Block, Evade, Any.

**Confirmations.** Healthy → Wounded (sheet and Player Area); delete an owned item; remove an Imperial or Agenda card; Reset Round; Apply Damage; add a class card the hero can't afford (GM override).

**What the engine reads.** Weapons: dice or pool attribute, accuracy, keywords (pierce), surge rows, exhaust flags, exhaust abilities. Mods: dice, damage, accuracy, keywords, surges, compatibility. Armor: the modifier (health, block, evade, and any other slot), equipped. Class cards and Imperial class cards: passive modifier, declared effects (when, scope, cost, modifier, surges, choice), attachment flag, XP. Actors: attributes, defense dice, state, companionOf, special-ability surge costs, form cards.

**Bonus layers in combat.** Manual · Gear · Tokens · Conditions · Cards, per stat, per side; the row shows the sum, the tooltip the parts.

**Scripts.** `npm run build:packs` regenerates the compendiums from `docs/class-cards.json` and `docs/cards/*.json` (Foundry closed); `npm run uses` rebuilds the declared-effect lists from the card models; `npm run check:lang` validates the language file.
