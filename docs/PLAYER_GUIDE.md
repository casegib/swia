# SWIA Player Guide

This is the player's side of the Star Wars: Imperial Assault system for Foundry VTT. It covers what you can click, what happens when you do, and the handful of things the system leaves to the table. The GM Guide covers setup, permissions and the Imperial side.

## 1. Your first session in five minutes

Everything starts from the **Player Area** button at the top of the Actors sidebar. It opens a board with a card for every hero you can see, and your own character sheet is one click away from your card's name. Most of a session is two gestures: click dice to roll, click a pill or button to change a state. If the GM has just updated the system and something looks off, reload your browser (F5) — new features and fixes only arrive after a reload, and the GM has to restart the world first.

If you want to attack something, hover the enemy token and press **T** to target it before you press **Weapon Attack**. That one habit skips a prompt every time.

## 2. Your card in the Player Area

Your card shows your portrait, your activation token, a Healthy/Wounded pill, your unspent XP, Health and Endurance steppers, Speed, your hero abilities, your dice rows, and four inventory columns.

The **activation token** flips when you click it, so mark yourself activated when your turn ends; the GM resets everyone at the end of the round. Flipping it also discards any of your conditions that end with your activation (Weakened, for one).

**Health and Endurance** have − and + steppers. Damage taken is the gap between the number and the max; strain is the same for endurance. Both are clamped to their max. A small **+N** beside the max means your gear is adding to it — hover it for the breakdown of printed base plus armor plus class-card passives. Speed shows the same note when a card raises it.

The **Healthy** pill turns you **Wounded** after a confirmation, because it flips your card to the wounded side and resets that side's health to full. While wounded, a second pill lets you go **Defeated**. Healing back is one click with no confirmation.

If you have a **companion**, it nests under your card with its own health stepper, defense dice and a Ready All button.

Things you will see but cannot change here: your unspent XP (the GM edits it), power tokens (the GM grants and removes them), and drops onto the columns (the GM does those — or you drop onto your own sheet, which works the same way).

## 3. Rolling dice

Click **Strength, Insight or Tech** (or a custom attribute the GM added) on your card or sheet for an attribute test. A dialog shows your pool; adjust it with − and + if a card says to, declare anything you want to declare (see below), then **Roll**. The chat card shows the faces and the surge total, and every die has a **↺ reroll** button you can use as often as you like until you spend a surge.

Click your **Defense** dice for a defense roll. Your armor's Block and Evade and any always-on card bonuses are added on top of what you roll and shown in the breakdown, so a figure with no defense dice at all can still block.

Attacking is its own thing — the next section.

Reading a chat card: face images along the top, then Damage / Surge / Accuracy for attacks and Block / Evade for defense, then Net Damage or "Dodged". Blast and Cleave lines are reminders, not automation — apply them by hand. Below the totals sit your **surge abilities** as buttons. Only you or the GM can press them; unaffordable ones are greyed. A spent surge turns into an **Undo** that refunds it and reverses its effect; spending locks your rerolls, undoing unlocks them. Spending an "exhaust to use" surge exhausts the card that granted it, and undoing readies it again.

The dialog has two more fieldsets when they apply. **Power Tokens** lets you declare Damage or Surge tokens on an attack, or Block or Evade on defense — nothing is spent until you press Roll, so closing the dialog costs you nothing. **Class Cards** lists your declared card effects for this kind of roll (Section 7).

## 4. Attacking: the Combat Window

Target first (hover, **T**), then press the gold **Weapon Attack** button. Without a target you get a **Pick a Target** prompt: pick one and attack, choose **Roll Without Target** for a plain solo roll, or close the prompt to cancel.

The Combat Window opens for **everyone** at the table. Only the attacker, the defender and the GM can press anything; everyone else watches it happen.

During **setup** the attacker picks a weapon (depleted weapons don't appear; exhausted ones are marked), checks the pool, and declares what applies before rolling: manual steppers in the **Declared Bonuses** rows for anything the table adjudicates, **power tokens** (Section 5), and **class-card effects** (Section 7). Rows already carry what the engine knows — armor and passives under Gear, conditions under Conditions — and the tooltip on each row breaks the number down by source. Then **Roll Attack**.

After the attack roll, every attack die has a **↺** — reroll freely until a surge is spent. The defender can still declare Block and Evade tokens, defensive card effects and manual bonuses right up to **Roll Defense**. Then the results: totals with their breakdown (rolled + bonus − pierce), and Net Damage or Dodged.

**Surge abilities** work as on chat cards: click to spend, click Undo to take it back. Evade results eat surges before you can spend them. Surge abilities granted by a declared card (Student of Battle, say) appear here under the card's name.

**Apply Damage** (attacker) asks for confirmation, lands the damage on the defender, posts a summary card and closes the window for everyone. It also discards conditions that end with an attack, like Focused or Hidden. **Cancel Combat** hands back every declared token and refunds every declared card effect. If you close the window by accident, attacking again reopens the combat in progress.

## 5. Power tokens

Tokens you hold show as chips on your card and as a small badge with a count on your map token. Only the GM grants or removes them.

The rule is **declare before you roll**. In the Combat Window the attacker declares Damage and Surge tokens during setup and the defender declares Block and Evade tokens any time before the defense roll; the buttons show how many you hold and an **Any** token converts to whichever stat you pick. **Undo** returns the last one. In the solo dialog you set counts with steppers and they are spent when you press Roll. Tokens are consumed when declared; Undo and Cancel put them back, but a declared Block token does not come back just because the attack missed.

## 6. Conditions

Conditions come from the token HUD or from the tray on your card, and five of them carry their printed rules. **Focused** adds a green die to your attacks and attribute tests and is discarded after the roll. **Hidden** gives you +1 Surge when attacking and −2 Accuracy to whoever attacks you, and is discarded after you attack. **Weakened** takes 1 Surge off your attacks and 1 Evade off your defense until the end of your activation. **Stunned** blocks the Attack button — you'll see a warning; the GM can override. **Bleeding** has a **Suffer** button on your card for the strain each action costs (damage once your endurance is at 0).

The tray on your card lets you discard a condition, **Spend Action** to shed Bleeding or Stunned, **Suffer** for Bleeding, and **End Activation**. The roll dialog, the Combat Window and every chat card carry a Conditions line naming what was applied. The GM may add custom conditions; they show up in the same places and work the same way.

## 7. Class cards

Your class cards live in the **Class Cards** column, sorted by XP with a badge on each (Starter for the 0-XP cards). Starting weapons, armor and modifications from your class deck stay in their own columns but wear the same badge.

Some cards are **always on**. "Apply +2 Health to your hero", "+1 Accuracy", "+1 Evade" — those show as chips on the card's row and apply themselves the moment the card is on your sheet: max Health, Endurance and Speed rise (with the +N note), attack and defense shifts seed the bonus rows on every roll with the card's name in the notes.

Other cards are **declared**. Anything printed as "exhaust this card while attacking to…", "1 strain: use while defending to…" and the like appears as a button in the **Class Cards** block of the Combat Window (on whichever side you're on) and the roll dialog. The button shows the effect, the cost as chips, and the printed condition in italics — the condition is a reminder for you and the GM, never enforced. Pressing it pays the cost right then (the card flips to exhausted or depleted, strain comes off your endurance) and applies the effect: shifts land where they belong, even on the other side (Hold Still takes a Block off your target), extra dice join the pool, granted surge abilities appear on the result. Every declared effect has an **Undo** that refunds exactly what it paid; Cancel refunds them all. A button greys out, with the reason in its tooltip, when the card isn't ready, you can't afford the strain, or you already picked the other option on a choose-one card. In the solo dialog you toggle effects on and off and they are paid when you press Roll.

Cards that help a **friend** — Called Shot, Dig In, Professional Aide, Stay Behind Me and their kind — appear on the friend's roll, prefixed with your name. You can press your own card on a friend's attack in the Combat Window without controlling their figure; it exhausts or strains *you*. In the solo dialog a friend's card is offered only when you own that friend or you're the GM.

Reroll cards need no button: rerolls are already free until you spend a surge. Cards that swap dice, convert results, or do things outside a roll are text — play them by hand and use the manual steppers if a number changes.

## 8. Your gear

Hover any item for a full-size preview of the card; the 💬 button posts it to chat for the table.

Every card has a **state pill**: Ready → Exhausted → Depleted → Ready. Exhausted cards keep their printed stats but withhold exhaust-to-use surges and declared effects until readied; **depleted weapons disappear from the attack list** and depleted mods contribute nothing at all. **Ready All** is the status-phase button: it readies everything exhausted and deliberately leaves depleted cards alone.

**Weapons** are one line each — art, name, range and dice (mod dice ringed), a surge count chip, mod slots, state. The chevron opens the details: surge text, printed abilities, any **exhaust abilities** with a **Use** button that posts the ability and exhausts the weapon, and the attached mods with a detach ×. A weapon that draws its pool from an attribute says so. **Attaching a mod** happens from the Unattached Mods block: pick the weapon from "Attach to…" — greyed options mean the weapon is full or the wrong range.

**Armor** rows show chips for what the piece does; the shield toggle equips and unequips it. Equipping changes your max health, and your current health moves with it so the damage you've taken stays the same.

**Reorder** any column by dragging rows within it; the order is saved. The hand icon on weapon, armor, accessory and mod rows is **Give to…**: pick another hero and the item moves there (a weapon takes its mods along; armor arrives unequipped). Giving to someone else's hero goes through the GM, who must be online; a chat line records the handover.

## 9. Your character sheet

The sheet is the same information with more room. In display mode you can do everything the Player Area allows: steppers, state pills, rolls, card states, mod attach and detach, armor equip, send to chat, reorder, give, use exhaust abilities, declare and discard conditions. The stats block stays pinned at the top while the rest scrolls. Hero Abilities sit behind a disclosure with a count badge. **Edit mode** is the GM's.

Your sheet has a healthy side and a wounded side; the abilities and attributes you see follow your current state. If the GM enabled custom attributes, they appear as extra dice rows and roll like the printed ones.

## 10. Between missions

Your unspent XP is the same number the GM sees in the Campaign Tracker. You see it; the GM changes it — unless the table has turned on **Class cards cost XP**, in which case dropping a class card onto your sheet spends its printed XP automatically and refuses you if you can't afford it (the GM can override).

The **Campaign Tracker** (read-only for players) shows credits, campaign XP, requisition, the Imperial side's numbers and the mission log. Trading gear is the Give to… button from Section 8. Healing between missions is the Healthy pill: it resets your health to full and swaps your token art back.

## 11. Quick reference

| Die | Faces |
|---|---|
| Red | 1 dmg · 2 dmg · 2 dmg · 2 dmg + surge · 3 dmg · 3 dmg |
| Blue | 1 dmg/2 acc · 1 dmg/5 acc · 1 dmg/surge/3 acc · 2 dmg/3 acc · 2 dmg/4 acc · surge/2 acc |
| Green | 2 dmg/1 acc · 2 dmg/2 acc · 2 dmg/3 acc · surge/1 acc · surge/1 dmg/1 acc · surge/1 dmg/2 acc |
| Yellow | 1 dmg/2 acc · 1 dmg/surge/1 acc · 2 dmg/1 acc · 1 dmg/2 surge · surge · surge/2 acc |
| Black | 1 block · 2 block · 3 block · evade · 1 block · 2 block |
| White | blank · block · block + evade · block + evade · dodge · evade |

**Card states.** Exhausted: stats stay, exhaust-to-use surges and declared effects are withheld, Ready All fixes it. Depleted: weapon vanishes from the attack list, mod contributes nothing, Ready All skips it.

**Confirmations you will meet.** Healthy → Wounded. Apply Damage. Deleting an item from your sheet.

**Keys.** **T** targets the hovered token. **F5** reloads after a system update.

**Who can press what.** State pills, steppers, card states, rolls, declared effects, reorder and give: you, on your own figure (and the GM on anyone). Power tokens, XP, and edit mode: the GM. Combat Window buttons: the attacker's owner for the attacker's side, the defender's owner for the defender's, the GM for either — plus the owner of any card being lent.
