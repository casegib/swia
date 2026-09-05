# SWIA User Manual — Outline

> Historical. The guides were written from this outline (updated for everything through the class-card, imperial and item-QoL passes) and live in `PLAYER_GUIDE.md` and `GM_GUIDE.md`; `npm run build:packs` turns them into the "SWIA Guides" journal compendium. Edit the guides, not this file.

Two guides, one source. Derived from the code as of the armor-effects / power-token passes (pre-0.1.7.0). Each bullet is something the code actually does; the parenthetical names the surface it lives on. Items marked **[decide]** need a table-rules call from the GM before they're written up.

Companion file: `SURFACE_INVENTORY.md` is the raw, control-by-control inventory these outlines were cut from.

---

## Player Guide (target: 3–4 pages, task-first)

### 1. Your first session in five minutes
- Where everything is: the **Player Area** button in the Actors sidebar is home; your character sheet is one click away from it. (Player Area)
- The two things you'll do most: click dice to roll, click a state pill to change state.
- Reload after the GM updates the system — new features don't appear until you do.

### 2. Your card in the Player Area
- What the card shows: portrait, activation token, Healthy/Wounded pill, Unspent XP, Health and Endurance steppers, Speed, hero abilities, dice rows, inventory columns.
- **Activation token** — click to mark yourself activated; the GM resets these each round. (Player Area, sheet)
- **Health and Endurance** `− / +` — take damage, recover, spend endurance. Clamped to max. The small red `+N` next to your max is armor. (Player Area, sheet)
- **Healthy → Wounded** — click the pill; you'll be asked to confirm because it flips your card and resets your wounded health to full. **Active → Defeated** appears only while wounded. (Player Area, sheet)
- Your **companion** (if any) nests under your card with its own health stepper and Ready All. (Player Area)
- What you *can't* do here: edit XP (GM), drag items onto your card (GM), grant power tokens (GM).

### 3. Rolling dice
- **Attribute tests** — click Strength / Insight / Tech (or a custom attribute) on your card or sheet; adjust the pool with `− +` if a card says to, then Roll. The chat card shows faces and total surges. (Roll dialog)
- **Defense rolls** — click your Defense dice. Armor's printed Block/Evade are added automatically and shown in the breakdown. (Roll dialog, roll card)
- **Attacking** — see §4. The gold **Weapon Attack** button is the entry point.
- Reading a chat card: face images, `Damage / Surge / Accuracy`, `Block / Evade`, Net Damage, "Dodged". Blast and Cleave lines are reminders — apply them by hand.
- **Surge abilities on chat cards** — buttons under the card; only you or the GM can click them; unaffordable ones are greyed; a spent one stays spent (no undo on chat cards). Spending an "exhaust to use" surge exhausts the card. (Roll card)

### 4. Attacking: the Combat Window
- **Target first.** Hover an enemy token and press **T**, then Weapon Attack. If you forget, a **Pick a Target** prompt appears; closing it cancels the attack; "Roll Without Target" gives you a plain dice roll instead.
- The window opens for **everyone** at the table. Only the attacker and defender (and the GM) can press buttons; everyone else watches.
- **Setup** (attacker): choose weapon (depleted weapons don't appear; exhausted ones are marked), check the pool, use the **Declared Bonuses** rows for anything a card grants before you roll, **declare power tokens** (see §5), then **Roll Attack**.
- **After the attack roll**: you can **reroll any die** with ↺, as many times as you like, until you spend a surge. The defender can still declare Block/Evade tokens and bonuses now.
- **Roll Defense** (defender), then the results: totals, breakdown `(rolled + bonus − pierce)`, Net Damage or Dodged.
- **Surge abilities** — click to spend; the button turns into an undo, which refunds the surge and un-exhausts the card. Spending locks rerolls; undoing unlocks them. Evade results eat surges.
- **Apply Damage** (attacker) — confirm, damage lands on the defender, a summary card posts to chat, the window closes for everyone.
- **Cancel Combat** — declared tokens go back to their figures.
- If you close the window by accident, attacking again reopens it.

### 5. Power tokens
- What you hold shows as chips on your card and as a count badge on your map token.
- **Declare before you roll**: attacker declares Damage/Surge tokens during setup; defender declares Block/Evade tokens any time before the defense roll. The buttons show how many you hold; **Any** tokens convert to whichever stat you pick. **Undo** returns the last one.
- Tokens are spent when declared. **[decide]** does a declared Block token come back if the attack misses or is dodged? (Currently: no.)
- Only the GM can grant or remove tokens.

### 6. Your gear
- **Card art**: hover any item for a full-size preview; the 💬 button posts the card to chat for the table.
- **Card state pill** — Ready → Exhausted → Depleted → Ready. Exhausted cards keep their stats but withhold exhaust-to-use surges; **depleted weapons disappear from the attack list** and depleted mods contribute nothing.
- **Ready All** — status-phase button; readies exhausted cards, deliberately leaves depleted ones alone.
- **Weapons** on the sheet: effective dice (mod dice highlighted gold), "Uses your Strength pool" note for pool-substitution weapons, mod slot count, surge lines, attached mods nested underneath with a detach ×.
- **Attaching a mod**: from the sheet's Unattached Mods block, "Attach to…" — greyed options mean the weapon is full or the wrong range.
- **Armor**: chips show what it does; the shield toggle equips/unequips. Equipping changes your max health and your current health moves with it so your damage taken stays the same.
- **Class cards and accessories**: art, state, chat — that's it; play them by hand.

### 7. Your character sheet
- Display mode vs the GM's edit mode: what you can do without edit mode (steppers, state pills, rolls, card states, mod attach/detach, armor equip, send to chat).
- Healthy and wounded sides: which abilities and attributes you see follow your state.
- Custom attributes (if the GM added any).

### 8. Between missions
- Unspent XP is the same number the GM sees in the Campaign Tracker; you see it, the GM changes it. **[decide]** XP deduction on purchase is not automated — describe the table procedure.
- The Campaign Tracker (read-only for players): credits, campaign XP, requisition, mission log.
- **[not built]** Giving an item to another hero — currently the GM moves it.

### 9. Quick reference (one page)
- Die faces table (red/blue/green/yellow, black/white).
- Card state cheat: exhausted vs depleted.
- Confirm dialogs you'll meet: wounding, Apply Damage.
- Keyboard: **T** to target.

---

## GM Guide (target: 8–10 pages, setup then play)

### 1. Install and update
- System requirements (Foundry v13), install from manifest, updating, **restart the world after every update** (data models and hooks load at world start). Legacy `swia-dice` module warning.
- Settings you won't find in the Settings menu: everything is world-setting driven and invisible by design (round state, campaign resources, active combat).
- Migrations that run on load: legacy `ability` → `classcard`; armor dice/surges dropped.

### 2. The GM's map of the system
- Sidebar buttons and who sees them: GM Area (GM), Player Area (all), Companion Area (all), Imperial Area (GM), Campaign Tracker (all, GM edits), Combat Window (all).
- Sheets: hero, villain, ally (one sheet, type-specific sections); character (NPC with hidden disposition); object (map props).
- Where state lives: actor data, item data, status effects (power tokens and conditions), world settings.

### 3. Building a hero
- Create the actor, set portrait (portrait and token art are set together; **wounded token art** is separate under Token Setup).
- Edit mode toggle (GM-only), autosave on exit. The Healthy | Wounded stat tabs edit both attribute sets without changing the hero's state.
- Health max: enter the **printed** value; armor is added on top automatically and shown as `+N`.
- Attributes and dice chips; custom attribute slots (enable, label, icon, dice).
- Hero abilities: type them in, or **drag a Hero Ability item** onto the sheet (copies the text; healthy vs wounded list follows current state).
- Archetype, affiliation, title, trait line.

### 4. Building items from cards
- General: item sheets **do not autosave** — press Save. Edit toggle is GM-only. Card image = the scan; click to upload; Image Framing sliders. Card state pill.
- **Weapons**: range, class → subtype (filtered), attack dice or **Attack Pool Source** (Strength/Insight/Tech for variable-pool weapons), accuracy, attachment slots, keywords, printed ability rows, structured surge rows with **exhaust to use**, flavor text. What the engine reads vs what's display text.
- **Weapon mods**: compatibility (melee/ranged) drives the subtype list and the attach validation; bonus dice/damage/accuracy/keywords; surge rows. Attach from the hero sheet, not the mod's raw ID field.
- **Armor**: Health / Block / Evade numbers (these are what the engine uses), Weight Class **[decide — house rule; what does light/medium/heavy mean at your table?]**, printed ability rows for conditional text, Equipped default.
- **Class cards**: XP cost, hero class, ability text. **[gap]** Agenda card fields (influence, type, mission effect) exist in data but the sheet doesn't expose them.
- **Form cards** (villain Shift), **Hero Ability** items.
- Sending cards to chat: scan if present, generated text card if not.

### 5. Villains, allies, NPCs, objects
- Villain/ally sheet: deploy and reinforce cost, group size pips, elite/unique, affiliation, traits, attack (melee/ranged toggle), surge abilities, special abilities with **surge cost** (>0 puts it in the attack surge panel), reward.
- **Token footprint** presets for massive figures (syncs linked tokens only).
- **Shift / form cards**: enable on the villain, drop form-card items, pick the active form; its abilities feed the attack surge panel.
- Villains and allies have **no inventory UI on the sheet**; manage their items from the Player Area columns (if visible there) or the item directory.
- **Allies and companions**: `Companion Of` pins an ally under a hero or villain; unassigned allies live in the Companion Area; player-owned allies appear in the Player Area. Ownership vs companionOf.
- **Characters**: preferred disposition, the eye toggle that reveals it, and the rule that new tokens are Neutral until revealed.
- **Objects**: type/traits/state, health and defense (not rollable), interaction text is prose.

### 6. Permissions and what players see
- OBSERVER makes an actor appear in a player's Player Area; OWNER lets them act on it. GM sees the whole player-facing roster.
- Who can press what: state pills, steppers, card states (GM or owner); XP, drag-drop, power-token grants (GM); combat window (owner of that side or GM); surge spends on chat cards (roller or GM).
- Hidden allies as mission rewards: withhold OBSERVER until revealed.
- **[gap]** Drop zones highlight for owners but only the GM's drop works.

### 7. Running a mission
- **Round tracking** (GM Area): round counter, Activation/Status phase toggle, Reset Activations, End Round (no confirm), Reset Round (confirm). Activation tokens on every card.
- **Status phase**: Ready All per figure (portal or sheet) — depleted cards need a deliberate reset.
- **Threat**: Threat Level and Threat live in the Campaign Tracker; the GM Area displays them. **[decide]** Threat accrual per round is manual.
- **Deployment**: deploy/reinforce costs and group size are tracking fields; the Imperial Area shows On Map counts and per-token health bars.
- **Damage outside combat**: health steppers on any card, the Imperial/Companion per-token bars for reading only.
- **Conditions**: nine status effects, all markers with no mechanics — apply from the token HUD.

### 8. Combat, GM's view
- The window opens for every client; the GM can act for either side. Every action routes through the GM's client, so **a GM must be connected**.
- Adjudicating with the **Declared Bonuses** rows: manual steppers on the total, the armor seed (`■N`), tokens — and pulling the manual stepper negative to cancel an armor seed that doesn't apply ("+1 Block against Ranged").
- Reroll rule, surge lock/unlock, evade eating surges, pierce vs block, dodge.
- Apply Damage: wounded-aware, clamps at 0, summary card, window closes. Cancel: refunds tokens, no confirm.
- Solo rolls vs combat rolls: what the solo path lacks (no token declaration, no reroll, no surge undo) **[until the parity pass]**.
- Stuck combat: "already in progress" — resolve or cancel from the window; a combat saved before an update is discarded at load.

### 9. Power tokens
- They are status effects: grant from the trays on the hero sheet or portal (`+`/`−`), or the token HUD. One effect per token so they stack.
- Map badge replaces the stock status icons: icon + count, bottom-left.
- The five types and where each is usable; **Any**.
- The declaration rule and its consequences: tokens are consumed at declaration; undo and cancel restore them; **[decide]** refund on miss.
- Nothing grants tokens automatically — card text is yours to adjudicate.

### 10. Armor and health
- Max health = printed + equipped armor; the sheet's edit input is the printed base.
- Equip/unequip shifts current health so damage taken is constant; worked example (10/12 + 2 → 12/14).
- Block/Evade seed the combat window; conditional text is a manual stepper bump.
- Stacking across multiple equipped pieces **[decide — house rule; the code stacks]**.

### 11. Between missions
- Campaign Tracker: the seven resources, hero XP grid (same field as sheet and portal), mission log (name/type/outcome/ally unlocked; add/remove save immediately, everything else on Save).
- XP: three places write it; none deduct on purchase **[decide]**.
- Item trading **[not built]** — move items via the GM drag-drop in the Player Area.
- Healing between missions: the Healthy pill resets health to full; wounded heroes' art swaps back.

### 12. Things the system does not do (read this before the first session)
- Blast/Cleave, adjacency, line of sight, movement, range vs accuracy: reminders or tracking only.
- Conditions are inert. Object interactions are prose. Unrecognized surge text is a display-only spend.
- Threat accrual, deployment, activation order: bookkeeping, not enforced.
- Power tokens are never auto-granted; conditional armor text is manual.
- Weapon exhaust abilities: stored but not shown **[until built]**.
- Agenda card fields not editable **[gap]**.

### 13. Troubleshooting
- "Nothing changed after the update" → restart the world.
- "Combat window is empty / can't attack" → an old combat is active; cancel it.
- "Player can't see their hero in the Player Area" → OBSERVER permission.
- "Player can't act on it" → OWNER.
- "Surge button says a GM must be connected" → relay needs an active GM.
- "Wounding lost my custom token art" → known issue; set token art again **[until the token-art fix]**.
- "Item edits vanished" → item sheets need Save.
- "Defense dice look wrong on the portal above 9" → known over-draw.

### 14. Reference
- Die faces. Status effect list. Card-state semantics. Confirm-dialog list. Sidebar buttons and permissions matrix. Data fields the engine reads vs display-only (per item type).

---

## Publishing plan

- Source: `docs/player-guide.md` and `docs/gm-guide.md` in the repo, edited with each pass (BACKLOG "Done" entries are the changelog feed).
- In-Foundry: a journal compendium (`packs/guides`) built from the same markdown, so a player opens "SWIA Player Guide" from the compendium sidebar. One-time build script; re-run on release.
- Screenshots: one per major surface, captured from Casey's world after each polish pass; keep them in `docs/img/`.
- Order of writing: Player Guide first (smaller, and the GM Guide's play chapters reuse it), after the solo-roll parity pass lands so §3/§4 don't need a rewrite.

## Open decisions for the GM (collected from the [decide] tags)
1. Refund a declared defender token if the attack misses or is dodged?
2. What light/medium/heavy weight class means at the table, if anything.
3. Does armor Health/Block/Evade stack when more than one piece is equipped?
4. XP spending procedure until deduction is built.
5. Threat accrual procedure per round.
