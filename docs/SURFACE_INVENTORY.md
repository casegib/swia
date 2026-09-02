<!-- Generated from the code by a read-through of every template and handler (armor-effects / power-token passes, pre-0.1.7.0). Treat as a working reference for the manuals, not as verified documentation: line refs and edge-case claims should be re-checked against the file before they are quoted in a guide. -->

# SWIA Foundry System — User-Facing Surface Inventory

Version 0.1.6.0, Foundry v13.351. Sources: `/tmp/swia/`. Permission vocabulary below: **GM** = `game.user.isGM`; **owner** = `actor.isOwner` (Foundry OWNER); **manage** = `canManageActor()` = GM **or** owner (`/tmp/swia/actor-actions.js:12`).

---

## 1. Actor sheets

`SWIAActorSheet` (`swia-actor-sheet.js`) + `actor-sheet.hbs` serve **hero / villain / ally**. Window 980×700, resizable, `submitOnChange: true`. Title is just the actor name.

### 1.1 Global sheet chrome

| Control | Label / key | Who | Behavior |
|---|---|---|---|
| **Edit Mode** checkbox | `SWIA.EditMode` | Header block wrapped in `{{#if isGM}}`; handler re-forces `checked && game.user.isGM` (`swia-actor-sheet.js:965`) | Turning it **off** runs `_saveFormData()` — a manual DOM scrape (it reads *disabled* inputs too, which FormData skips). Array paths (`surgeAbilities.N.*`, `specialAbilities.N.*`, `heroAbilities.N.*`, `woundedHeroAbilities.N.*`) are stripped from the flat update and re-saved through dedicated array handlers, because Foundry's `expandObject` would turn them into `{"0":{…}}` instead of arrays. Then `render(false)`. |
| **Name** input | placeholder `Name` | `disabled` unless edit mode | `data-action="changeName"` — writes on change; no-ops on blank or unchanged. |
| **Activation token** (clickable image) | `SWIA.ActivationToken.Ready` / `.Activated` | **No permission check in the handler** — any user whose click reaches it; a non-owner's `actor.update` is rejected server-side | Toggles `system.state.activated`. Icon swaps `Token Hero Turn Start.png` ↔ `Token Hero Turn Over.png`. Present on **all three types**. |
| Section collapse toggles | `Stats / Resources`, `SWIA.Inventory.Weapons`, `.Armor`, `.Abilities`, `.Items`, `SWIA.Hero.HeroAbility`, `SWIA.Villain.SurgeAbilities`, `.SpecialAbilities` | Edit mode only (`_onToggleSectionCollapse` returns early if `!this._editMode`) | Pure client-side DOM class toggle, **no re-render**. Defaults (`EDIT_COLLAPSE_DEFAULTS`): everything collapsed except `stats`. Not persisted across sheet close. |

### 1.2 Images & token setup

- **Portrait** and **token** thumbnails; `clickable` + `data-action="editImage"` **only in edit mode**. `_onEditImage` hard-gates `game.user.isGM && this._editMode` (`:922`).
- Non-obvious: picking `img` **or** `prototypeToken.texture.src` writes **both** (portrait and token stay in sync). Only `system.woundedTokenImage` is independent — and if the hero is currently wounded, setting it also pushes to `prototypeToken.texture.src` **and** repaints every placed token via `syncActiveTokenTextures`.
- **Token Setup** `<details>` disclosure (`SWIA.TokenSetup`), edit mode only:
  - **Hero**: Wounded Token Image picker (`SWIA.WoundedTokenImage` / `.Hint`).
  - **Villain/ally**: **Token Footprint** presets `1x1 / 2x1 / 2x2 / 3x2 / 3x3` (`SWIA.TokenFootprint.Preset.*`) — `applyTokenFootprintPreset` is gated **villain-only + GM + edit mode** (`:852`), writes prototypeToken width/height/scaleX/scaleY **and syncs linked placed tokens only** (`linkedOnly = true`). Manual `Width`/`Height`/`Scale X`/`Scale Y` number inputs save through the normal form path and do **not** sync placed tokens.

### 1.3 Header — type-specific

**Villain / ally only** (`villain-image-row`):
- **Deploy cost** chip (`SWIA.Villain.DeployCost`), editable number 0–20 in edit mode.
- **Reinforce cost** chip (`SWIA.Villain.ReinforceCost`) — **only rendered when `groupSize > 1`**.
- **Group size pips** (one `.group-pip` per `groupSize`), plus a numeric input 1–10 in edit mode.
- Unique pip (`SWIA.Villain.IsUnique`), affiliation badge (empire/rebel/mandalorian/user icon).
- Edit-mode flags row: **Elite**, **Unique**, and (villain only) **Shift (Form Cards)** → `data-action="toggleShift"`; unchecking it also clears `system.activeFormId`.
- **Affiliation** select (None/Imperial/Rebel/Mercenary/Civilian).
- **Ally only**: **Companion Of** select (`SWIA.Companion.CompanionOf`) listing every hero and villain, `— Unassigned —` default. Hint text explains the nesting rule. Choices are built in `_prepareContext` only for `type === "ally"`.
- **Traits** free text (`SWIA.Villain.TraitsPlaceholder`), shown as plain text out of edit mode.

**Hero only:**
- **Title** input, **Trait** line (`SWIA.Hero.TraitLabel` + archetype, or `—`).
- Edit-mode selects: **Archetype** (Brawler, Commander, Force Sensitive, Hunter, Medic, Pilot, Smuggler, Soldier, Spy, Technician) and **Affiliation**.
- **State pills** (`SWIA.StateLabel`):
  - `Healthy` ⇄ `Wounded` — `toggleWounded`. **Healthy→Wounded raises a confirm dialog** (`SWIA.State.WoundConfirmTitle` / `.WoundConfirm`: "…switches to the wounded card and resets the wounded health pool to full"). Healing back is **not** confirmed. Both directions reset the newly-active health pool to max, clear `defeated` when healing, swap prototype token art, and repaint every placed token.
  - A second pill `Active` ⇄ `Defeated` appears **only while wounded** — `setDefeatedState` refuses if not wounded.
  - No permission check in the sheet handlers.

**All types — Power Token tray** (rendered only if `powerTokens.length`):
- One chip per token type held; for a **GM**, `powerTokenRows(actor, {editable:true})` returns **all five** types (damage/surge/block/evade/any) so an empty slot can be granted from. Non-GMs see only types with count > 0.
- **− / +** buttons (`adjustPowerToken`) are **GM-only** in both template (`{{#if canEditTokens}}`) and handler (`:1127`). `−` disabled at 0.
- Grants create a **fresh ActiveEffect per token** (they stack; `toggleStatusEffect` would refuse a second).

### 1.4 Villain/ally ability lists (below the portrait)

- **Surge Abilities** (`SWIA.Villain.SurgeAbilities`): view mode renders enriched effect text in a grid (a special 3-across layout at exactly 3 entries). Edit mode gives per-row **cost** (min 1) + **effect text** inputs and a trash button; a **+** header button adds `{cost:1, effectText:""}`.
- **Special Abilities**: name + description textarea + **Surge Cost** number (`SWIA.Villain.SpecialAbilitySurgeCost`, hint: *"If greater than 0, this ability appears in the attack roll's surge panel and costs this many surges to use."*). View mode shows a `N× Surge` badge when `surgeCost > 0`.
- Both lists save via a **DOM scrape on any input change** inside `.surge-ability-entry` / `.special-ability-entry` (`_onChangeForm` intercepts before core form submission). Note: the special-ability scrape (`_onSpecialAbilityChange`, `:1316`) writes only `{name, description}` — **it drops `surgeCost`**; that field survives only through the flat `scalarData` path on edit-mode exit.
- Ability **names** are enriched then run through `sanitizeLabelHTML` (XSS hardening for `{{{ }}}` output); descriptions are enriched only.

### 1.5 Villain Form Cards (Shift)

Rendered only when `type === "villain"` **and** `system.hasShift`.
- Edit mode: a manage list of owned `formcard` items with **open** (pencil) and **delete** (trash, `SWIA.Villain.FormCard.Remove`) per row; empty state `SWIA.Villain.FormCard.NoCards` ("Drop formcard items onto this actor").
- **Form selector** `<select data-action="setActiveForm">` with `— No Form —`; writes `system.activeFormId`.
- With a form active, its **Surge Abilities** and **Special Abilities** are edited *in place on the item* from the villain sheet (`addFormCardSurgeAbility` / `remove…` / `addFormCardSpecialAbility` / `remove…`). These inputs are **unnamed** and saved by DOM scrape (`.form-surge-ability-entry`, `.form-special-ability-entry`). The form-card special-ability scrape also drops `surgeCost`.
- With cards but none selected: `SWIA.Villain.FormCard.SelectPrompt` ("Select a Form above.").

### 1.6 Hero Abilities

- Separate lists for healthy (`heroAbilities`) and wounded (`woundedHeroAbilities`); **which one you see/edit follows the actor's live wounded state**, not the edit-stat tab.
- Edit mode: name input + description textarea per row, trash button, **+ Add Ability**, and a drop hint `SWIA.HeroAbility.DropHint`.
- **Drag-and-drop**: dropping a `heroability` **Item** anywhere on a hero sheet appends `{name, description: abilityText||description, sourceUuid}` to the state-appropriate list (`_interceptHeroAbilityDrop`, `:1221`). This is bound on the root element in `_onRender` with **no edit-mode and no permission check**, and it is a *copy* — the source item is not linked afterwards, only its uuid is recorded.
- View mode renders only rows with a non-empty name.

### 1.7 Stats / Resources

- **Hero edit mode only**: `Editing stats for` **Healthy | Wounded** tabs (`setEditStatTab`). Purely an editor target switch — it does **not** change the actor's wounded state. Triggers a full re-render.
- **Health**: display mode is a **stepper** `− value / max +` (`SWIA.Attributes.HealthMinus` "Take 1 damage" / `.HealthPlus` "Recover 1 health"). Clamped `[0, max]`; a wounded hero's stepper writes `system.woundedAttributes.health`.
  - `health.max` is **derived**: printed base + equipped armor. Display shows `12+2` with tooltip `SWIA.Attributes.HealthFromArmor`. The **edit input writes `_source` base** (`editHealthBaseMax`), or every save would bake the armor bonus in and double-count it.
- **Endurance** (hero only): same stepper pattern.
- **Speed**: number input, disabled outside edit mode.
- **XP** (hero only): plain number input, disabled outside edit mode → effectively GM-only. Same `system.xp` field the Player Area steppers and Campaign Tracker write.
- **Defense** dice: display is a clickable `.dice-display.rollable` → `rollDice` with `data-roll-type="defense"`. Beside it, **armor chips** `+N Block` / `+N Evade` (`SWIA.Portal.FromArmor`) when equipped armor provides them. Edit mode = black/white number inputs.
- **Attack** (villain/ally only): edit mode has a **melee/ranged image toggle** (`setAttackType`, gated to villain+ally) plus red/blue/green/yellow inputs. Display shows the range icon + clickable dice → `rollDice type="attack"`.
- **Strength / Insight / Tech** (hero only): icon + clickable dice → `rollDice type="test" data-attribute=…`. Edit mode = 4 chip-dice inputs each, writing to the tab-selected attribute set.
- **Custom attribute slots** (hero only, `custom1..3`): rendered only when `enabled`. Icon is clickable in edit mode → `editImage` on `system.<set>.<key>.icon` (GM+edit only); falls back to a ★ glyph. Edit mode gives an enable checkbox, a free-text label (`SWIA.Attributes.CustomLabelPlaceholder`), and 4 dice inputs. Display renders clickable dice → `rollDice type="test" data-attribute="custom1"` (the roll dialog resolves the free-text label for the title). **+ Add attribute** tile (`addCustomAttribute`) appears in edit mode when a free slot exists; it flips the next unused slot's `enabled` in the **tab-selected** set.
- **Weapon Attack** gold button (`SWIA.Roll.WeaponAttack`), hero display mode only → `rollDice type="attack"`.
- **Reward** (villain/ally): free text (`SWIA.Villain.RewardPlaceholder` "e.g., 2 Threat"); view mode hides the row when blank.

### 1.8 Inventory sections — **heroes only**

The whole `inventory-sections` block is wrapped in `{{#unless (or ally villain)}}`. Villains and allies **can own items** (drops still work via core `_onDropItem`) but get **no inventory UI on their sheet** — you manage those through the Player Area / Companion columns or the item directory.

**Toolbar: Ready All** (`SWIA.Inventory.ReadyAll`, hint `.ReadyAllHint` "Status phase: ready every exhausted card on this figure"). Readies every `exhausted` item of type weapon/weaponmod/armor/classcard/gear. **Depleted cards are deliberately left alone.** Toast: `{count} card(s) readied.` or `Nothing to ready.`

**Weapons** (`SWIA.Inventory.Weapons`, empty: `SWIA.Inventory.EmptyWeapons` "Drag weapon cards here."). Each row shows:
- Card art thumbnail — `swia-card-preview-trigger` (hover preview) and `openItem`.
- Range icon, then **effective dice**: the weapon's printed dice, then mod-contributed dice marked `.from-mod` (`SWIA.Inventory.FromMod`).
- **Pool substitution note** (`SWIA.Inventory.PoolNote` "Uses your {attr} pool") when `poolAttribute` is set — the displayed base dice are then the hero's live (wounded-aware) Strength/Insight/Tech pool.
- Mod flat-bonus tags `+N DMG (name)` / `+N ACC (name)`; **mod slots badge** `Mods {used}/{total}`, red `.full` when at/over capacity (weapons with `attachmentSlots: 0` are always "full").
- Printed ability rows (enriched).
- **Surge lines**: weapon surges plus attached-mod surges tagged with the mod's name; a ⚡ flag (`SWIA.Combat.ExhaustsSource`) marks `exhaustToUse` entries.
- Controls: **card-state pill** (`cycleItemState`, ready→exhausted→depleted→ready), **💬 send to chat** (`postItemCard`, `SWIA.Inventory.SendToChat`), **🗑 delete** (`deleteItem`) — *edit mode only*, with a confirm dialog "Remove **X** from Y?".
- **Nested attached mods** (`↳`): name (openItem), bonus dice, state pill, 💬, and **× detach** (`SWIA.Inventory.Detach`) which clears `attachedWeaponId`.

**Unattached Mods** block (`SWIA.Inventory.UnattachedMods`) — mods pointing at nothing, or at a weapon the actor no longer owns. Each has a **"Attach to…"** `<select>` (`SWIA.Inventory.AttachTo`) listing every weapon as `Name (used/total)`, with options **disabled** when the weapon is full or melee/ranged-incompatible. The select is bound fresh each render, resets to blank after use, and `_attachMod` **re-validates** both rules server-side (data can change between render and change), warning with `SWIA.Inventory.ModIncompatible` or `SWIA.Inventory.ModSlotsFull`.

**Armor** (`SWIA.Inventory.Armor`, empty `.EmptyArmor`):
- Chips `+N Health` / `+N Block` / `+N Evade`, and an `Equipped` tag.
- **Shield equip toggle** (`toggleEquipArmor`; `SWIA.Inventory.EquipHint` / `.UnequipHint`). Unequipped rows get the `.unequipped` class.
- **Auto-effect (important):** equipping/unequipping/editing/adding/removing armor fires hooks in `actor-actions.js:359-391` that **shift current health by the same delta** so *damage taken stays constant* — 10/12 wearing +2 armor becomes 12/14, not 10/14. Shifts are serialized per actor. Runs only on the client that made the change.
- No state pill on armor rows (only equip + chat + delete).

**Class Cards** (`SWIA.Inventory.Abilities`, empty `.EmptyAbilities`) and **Accessories** (`SWIA.Inventory.Items`, empty `.EmptyItems`): thumbnail + name + state pill + 💬 + (edit mode) delete.

**Dead code:** `toggleInventoryPanel` is registered as an action and `_onToggleInventoryPanel` resizes the window to 900/620px and toggles `.inv-open-*` classes — but **no `data-action="toggleInventoryPanel"` exists in any template**. The side-panel tab UI described in README is not currently reachable.

### 1.9 `character-sheet.hbs` / `SWIACharacterSheet`

Simplified NPC sheet, 600×500. Type `character`.
- **Edit Mode** checkbox — GM only (template `{{#if isGM}}`, handler `if (!game.user?.isGM) return`).
- Portrait + token images, `editImage` GM+edit only (again writes `img` and token src together).
- Name, **Biography** (textarea in edit, raw `{{{ }}}` HTML in view; hint documents inline `<img>` usage).
- **Health** (value/max pair in edit; single disabled value in view), **Speed**.
- **Preferred Disposition** select Friendly/Neutral/Hostile (edit mode).
- **View mode disposition display**: shows `???` (`SWIA.Character.Disposition.Unknown`) unless revealed, plus a **GM-only eye toggle** `data-action="toggleDispositionShown"` (`SWIA.Character.ShowDisposition` / `.HideDisposition`), persisted as the actor flag `swia.dispositionShown`.
- **Affiliation** select (edit mode); view mode shows an icon badge.
- **Auto-effect:** the `preCreateToken` hook in `swia.js:270` applies the character's preferred disposition to **newly created tokens** — but only if `dispositionShown` is true; otherwise the token is forced to **Neutral (0)**. This is the "hidden villain" mechanic.

### 1.10 `object-sheet.hbs` / `SWIAObjectSheet`

Map props / mission tokens, 480×520. Type `object`.
- GM-only Edit Mode toggle + image pickers (same pattern).
- Name, Biography.
- **Object Type** (`e.g., Terminal, Door, Crate`), **Traits** (`e.g., Imperial, Locked`), **State** (`e.g., locked, open, intact, destroyed`) — all free text, disabled outside edit mode.
- **Health** value/max; **Defense** black/white dice — **not clickable/rollable here** (no `rollDice` action on the object sheet).
- **Interactive** checkbox (`SWIA.Object.Interactable`); when on, an **Interaction** rich-text block appears (`SWIA.Object.InteractionTextHint` "What happens on interaction or the test required (e.g., Tech to disable).") — pure text, **no automation**.
- Note: `ObjectData` health defaults to `0/0` and has no endurance/speed.

---

## 2. Portals

All four open from buttons injected into the **Actors sidebar** header (`renderActorDirectory`, `swia.js:292`). See §6.

### 2.1 Player Area (`player-portal.hbs` / `.js`) — 1500×900

**Who appears** (`_getOrderedPlayerActors`, `:221`):
- Types hero/villain/ally only.
- **A player sees only actors they can personally OBSERVE.** The **GM sees the whole player-facing roster** (any actor some non-GM user can observe). Without this, every client would render every hero, because Foundry ships all world actors to all clients.
- **Allies are filtered further**: an ally earns a slot only if it is *owned by a player* or `companionOf` points at an existing hero. Everything else stays in the Companion Area.
- Sort: **your own actors first** (OWNER level), then alphabetical.
- **Companion nesting**: an ally whose `companionOf` resolves to a hero **in this user's built list** is removed from the top level and rendered as a small card under that hero. An ally pinned to a figure you can't see stays a top-level card.
- Empty state: `SWIA.Portal.Empty` "No player actors were found. Assign actor ownership to a player and refresh."

**Per-card controls:**

| Control | Who | Notes |
|---|---|---|
| Actor name button (`openActor`) | anyone | `SWIA.Portal.OpenSheet` |
| Activation token image (`toggleActivated`) | GM **or** owner (`:486`) | `.is-clickable` class only when manageable |
| **Healthy/Wounded** pill, **Active/Defeated** pill | manage (`_manageableActor`); `disabled` in template otherwise | Same confirm-on-wound dialog as the sheet — **this puts a destructive reset one click from every player** (the code comments say so explicitly) |
| Power-token tray `− +` | **GM only** (template + handler) | Same grant/remove helpers |
| **Unspent XP** `− value +` | **GM only** (`_onAdjustXp`, `:559`: *"XP is spent between missions under GM supervision; players see it but do not edit it here"*) | Label `SWIA.Portal.UnspentXp`, tooltip "shared with the Campaign Tracker" |
| Health / Endurance steppers | manage | Same clamping + armor-aware max display |
| Speed | read-only |  |
| Hero abilities block | read-only | enriched, live wounded/healthy switch |
| Defense / Strength / Insight / Tech dice (`rollDice`) | anyone can click | Armor Block/Evade chips beside Defense |
| **Weapon Attack** button | anyone | `rollDice type="attack"` |
| **Ready All** | manage; `disabled` unless `hasReadyableCards` | Also on companion sub-cards (icon-only) |

**Non-hero cards** (allies/villains that made it in) show Defense + Attack dice rows and a Ready All row instead of the four hero dice lines.

**Companion sub-cards**: portrait, name link, `Companion` tag, health stepper (manage-gated), Speed, icon Ready All, defense dice, armor chips.

**Inventory columns** (per actor, four `portal-drop-zone`s): **Weapons / Armor / Class Cards / Accessories**, each with a count.
- Each card: art button (`openItem`, hover preview), **state pill** (`cycleItemState`, GM-or-owner in both template `disabled` and handler), **💬 send to chat** (`postItemCard`, no gate), and for armor an extra **shield equip toggle** (manage-gated).
- Weapon cards carry **mod chips** (mod name + its bonus dice) below.
- Armor cards carry `+N Health/Block/Evade` chips and get `.is-unequipped`.
- **Drag-and-drop: GM only.** `_onPortalDragOver`/`_onPortalDrop` both `return` for non-GMs (so a player's drop isn't even `preventDefault`ed). Dropping a mismatched type warns `SWIA.Portal.DropWrongType` — "That card does not match this column. Drop a card of type: {expected}." The item is **copied** (`toObject()`, `_id` deleted) onto the actor.
- The `.can-drop` visual class is applied on `actor.canManage`, but the actual drop is GM-only — a **cosmetic/permission mismatch** an owner-player will notice.

**Live sync**: hooks on create/update/delete Actor, create/update/delete Item (weapon/classcard/gear/armor/weaponmod on portal actors), all three ActiveEffect hooks (for power tokens), `updateUser` (ownership changes), and `updateSetting` for `swia.campaignResources`. All debounced 75 ms.

**Unused strings** (nothing in the template renders them): `SWIA.Portal.Subtitle`, `SWIA.Portal.SharedResources`, `SWIA.Portal.MyCharacter`.

### 2.2 Imperial Area (`imperial-portal.hbs` / `.js`) — 1500×900

**GM-only, hard-blocked**: `render()` refuses for non-GMs with `ui.notifications.warn("Only the GM can open the Imperial Portal.")` and `_prepareContext` throws via `_assertGmAccess()`.

- Lists **every villain** (alphabetical), regardless of ownership.
- Per card: portrait, name (**not** a link — `<h2>`, no `openActor`), **activation token** (`toggleActivated`, GM-checked), Wounded chip.
- Stat block: Speed + inline **Defense** dice (Block icon) + **Attack** dice with a melee/ranged icon. **All read-only — no `rollDice` anywhere in this portal.**
- **Scene token health list**: one row per placed token of that villain on the **active scene** — mini token art, token name (or `Name N`), `value/max`, and a **health bar** with `.is-defeated` styling at 0 HP. Refreshed on create/update/deleteToken and `canvasReady`.
- Enriched **biography** block when present.
- **Companions nested**: allies whose `companionOf` matches a villain render as sub-cards (portrait, name link → `openActor`, `Companion` tag, ♥ health, Speed, defense dice). Read-only, no steppers.

**Imperial Cards section** (world-level items, not owned by an actor):
- Two columns: **Agenda Cards** (`agendacard`) and **Imperial Class Cards** (`imperialclasscard`), alphabetical, with counts and empty states `SWIA.Portal.Imperial.EmptyAgendaCards` / `.EmptyClassCards`.
- Per card: art (`openItem` → world item sheet), **state pill** (`cycleItemState`, GM), **🗑 remove** (`removeImperialCard`) with a **confirm dialog** (`SWIA.Portal.Imperial.RemoveCardTitle` / `.RemoveCardPrompt` "Remove **{name}** from the Imperial Area?") that **deletes the world Item outright**.
- Drop zones use `data-world-item-type`; a matching drop calls `Item.create(...)` — creating a **new world item copy**, not attaching to an actor.
- This portal carries its **own private copy** of the hover-preview code (BACKLOG notes it should migrate to `item-cards.js`), bound to `.portal-item-open` only, with a 120 ms delay.

### 2.3 Companion Area (`companion-portal.hbs` / `.js`) — 1500×900

Open to **everyone** (button is unconditional).
- Shows **allies only**, and only those **not** assigned via `companionOf` to an existing actor — it is explicitly the "staging area" for unpinned allies.
- Visibility: GM sees all; a player sees only allies they can **OBSERVE** — *"an ally the GM has not yet revealed (a mission reward, say) stays hidden until they grant permission."*
- Per card: portrait, name (`<h2>`, no link), **activation token** (`toggleActivated`, GM-or-owner), Wounded chip.
- **Scene token health list** (same mini-bars as the Imperial portal).
- Stat boxes: Health value (no stepper, no max), Speed. Enriched biography.
- **Dice rows are clickable** here: **Defense** and **Attack** both `rollDice` (allies are non-hero so they take the `{{else}}` branch). No Ready All, no inventory columns, no item cards, no drop zones rendered — the drop wiring exists in JS but there are no `.portal-drop-zone` elements in the template.
- Also carries its own duplicated hover-preview implementation.

### 2.4 GM Area (`gm-portal.hbs` / `.js`) — 1500×900

**GM-only, hard-blocked** (same `render()` refusal + `_assertGmAccess`).

**Round tracker header:**
- `Round {n}`, phase label (`Activation Phase` / `Status Phase` — **hardcoded English**, not localized), **Threat Level** and **Threat** read out from `swia.campaignResources`.
- Four buttons (GM-checked in every handler):
  - **Toggle Phase** — flips `activation` ⇄ `status`.
  - **Reset Activations** — clears `system.state.activated` on **every** hero/villain/ally in the world and empties `activationQueue`. **No confirm.**
  - **Reset Round** — **confirm dialog** ("Reset the round counter to 1 and clear all activations?"), then round = 1, phase = activation, queue cleared, all activations cleared.
  - **End Round** — clears all activations, `round + 1`, phase → activation. **No confirm.**

**Three sections**: **Players**, **Imperials**, **Companions**.
- *Players* = any hero/villain/ally observable by some non-GM user. *Imperials* = all villains. *Companions* = all allies. **These overlap deliberately** — a player-owned ally appears in both Players and Companions.
- Within each section, cards sort **unactivated first**, then by name.
- Card: token art (wounded art when wounded), **name link** (`openActor`), type label, **activation token** (`toggleActivated`, GM), and a **health bar** `value / max` with percentage width. Wounded heroes read from the wounded pool.
- Imperial cards additionally show `On Map: {placed} / {groupSize}` (`SWIA.Imperial.TokenCount`) and the per-token health list.
- No dice, no items, no steppers — this is a status board plus round control.

---

## 3. Campaign Tracker (`campaign-tracker.hbs` / `.js`)

520×560. Button visible to **everyone**; window opens for everyone but is **read-only for non-GMs**.

- Title/subtitle: `SWIA.CampaignTracker.Title` / `.Subtitle` ("Shared team resources for the current campaign.").
- **Seven world resources** stored in the `swia.campaignResources` setting, all non-negative integers (`normalizeResourceValue` floors and clamps at 0):
  **Credits**, **Campaign XP**, **Requisition Points**, **Imperial XP**, **Imperial Influence**, **Threat Level**, **Threat**.
- **Hero XP** grid: one input per hero actor (`heroXp.<actorId>`), alphabetical. Empty state `SWIA.CampaignTracker.HeroXPNone`. **This is the same `system.xp` field** the hero sheet's XP input and the Player Area's XP steppers write.
- **Missions** list: per row a **name** input, **Type** select (Story/Side), **Outcome** select (Pending/Rebels/Imperials — the select carries an `outcome-{value}` class for coloring), and an **Ally Unlocked** text field. **+ Add Mission** and per-row **🗑 Remove Mission**, both GM-only.
  - Non-obvious: Add/Remove **scrape the currently rendered rows first** so unsaved edits in other rows survive the operation, then write the whole missions array to the setting immediately (missions save independently of the Save button).
- **Save** button (GM only). Non-GMs instead see `SWIA.CampaignTracker.ReadOnly` "Only the GM can edit campaign resources."
  - Save merges into the existing setting (unknown fields preserved), writes changed hero XP as individual actor updates, and reports `SWIA.CampaignTracker.Saved` — or, if any hero update rejected, `SWIA.CampaignTracker.SavedWithHeroErrors` "{count} hero XP update(s) failed."
- Re-renders (50 ms debounce) on `updateSetting` for its own key and on **any** actor create/update/delete.

---

## 4. Dice

### 4.1 `dice-terms.js` — die faces & symbols

Six dice registered into `CONFIG.Dice.terms` with denominations **r**(red) **n**(blue) **g**(green) **y**(yellow) **b**(black) **w**(white) — the denominations match the legacy `swia-dice` module so old macros and chat history still parse. Symbol keys: `damage, surge, accuracy, block, evade, dodge`.

| Die | Faces |
|---|---|
| **Red** (attack) | 1 dmg · 2 dmg · 2 dmg · 2 dmg+surge · 3 dmg · 3 dmg |
| **Blue** | 1d/2acc · 1d/5acc · 1d/surge/3acc · 2d/3acc · 2d/4acc · surge/2acc |
| **Green** | 2d/1acc · 2d/2acc · 2d/3acc · surge/1acc · surge/1d/1acc · surge/1d/2acc |
| **Yellow** | 1d/2acc · 1d/surge/1acc · 2d/1acc · 1d/2surge · surge · surge/2acc |
| **Black** (defense) | 1 block · 2 block · 3 block · evade · 1 block · 2 block |
| **White** | blank · block · block+evade · block+evade · **dodge** · evade |

- Face results render as **face images** with a localized alt/tooltip (`symbolsLabel` → "2 Damage, Surge", or "Blank").
- **Chat styling for bare `/roll 2dr + 1dy`**: `registerChatRenderHooks` replaces the numeric dice-total with the pipe-joined face labels.
- **Dice So Nice**: registers a `swia` system and six presets inside `diceSoNiceReady` — no static import, so the system runs fine without DSN.
- **Legacy module warning**: on ready, if `swia-dice` module is active and the user is GM, a **permanent** warning notification fires (`SWIA.Dice.LegacyModuleWarning`).
- Implementation note worth knowing: each die class is given a unique `name` because *Foundry resolves dice term classes by name* — identically named classes would all collapse to the first registered one (everything would roll red).

### 4.2 Solo roll dialog (`roll-dialog.hbs` / `SWIARollDialog`) — 400×auto

`SWIARollDialog.open()` routing (`:365`):
1. `rollType === "attack"` **and** the user has a **target** set → **starts the shared Combat Window instead**; no dialog.
2. Attack with **no target** → **Pick a Target prompt** (below).
3. `test` / `defense` → the dialog opens directly.

**Pick a Target prompt** (`SWIA.Roll.PickTargetTitle`, hint: *"{name} has no target. Choose who to attack — or hover an enemy token and press T before attacking to skip this prompt."*): a `<select>` of every visible token on the canvas except the attacker.
- **Attack** → `token.setTarget(true, {releaseOthers:true})` (the reticle appears on the map) and starts combat.
- **Roll Without Target** → falls back to the solo dialog.
- **Closing the prompt cancels the attack entirely.**
- If the scene has no other visible tokens, it silently opens the solo dialog.

**Dialog contents:**
- Header: actor name, attribute label (custom slots use their free-text label), `Target: X` when one is set.
- **Weapon select** (`SWIA.Roll.Weapon`) — heroes on attack rolls only. **Depleted weapons are excluded from the list entirely** (`usableHeroWeapons`); exhausted ones show ` (exhausted)` after the name. Changing it rebuilds the attack pool. Default = first *ready* usable weapon, else first usable.
- `Accuracy: N` line when the weapon has any.
- **Attack Pool** and/or **Defense Pool** fieldsets, one row per color: a color chip, `−`, count, `+` (`adjustDie`). **Clamped 0–9 per color.** Which fieldsets show: attack→both, test→attack only, defense→defense only.
- **Roll** button. Empty pool → warn `SWIA.Roll.EmptyPool` "Add at least one die to the pool."

**Pool sources**: hero attack = selected weapon's `attackDice` (or, with `poolAttribute` set, the hero's live wounded-aware Strength/Insight/Tech pool) **plus** attached non-depleted mods' `bonusDice`. Villain/ally = `attributes.attack`. Test = the named attribute. Defense = the actor's own `attributes.defense`. On an attack, the **defense half is pre-seeded from the first targeted token's** defense. Armor never adds dice.

**Non-obvious:** there is **no power-token declaration step** in the solo dialog (BACKLOG confirms — tokens can only be declared in the combat window), and **no reroll and no surge-undo** on solo cards.

### 4.3 Roll chat card (`roll-card.hbs`)

Posted by the solo dialog, with the full state stored in the message flag `swia.rollCard`.
- Header: title, subtitle (weapon name for attacks, attribute label otherwise), `Target: X`.
- Attack face images row, then defense face images row.
- **Test cards** show only `Surges Rolled: N`.
- **Attack/defense cards** show `Damage / Surge / Accuracy` and, when defense dice were rolled **or armor contributed**, `Block` and `Evade` with a breakdown: `effectiveBlock (raw+bonus−pierce)`, tooltip crediting `SWIA.Roll.FromArmor` "+{count} from equipped armor".
- `Net Damage: N`, or **`Dodged — attack misses!`** when any dodge symbol appears.
- Keyword hints: `Blast N — apply damage to each figure adjacent to the target`, `Cleave — excess damage may be applied to another adjacent figure`. **Both are text-only reminders; nothing is applied.**
- `Declared tokens:` line when the state carries token bonuses (only from the combat-window summary path).
- **Surge Abilities buttons** — clickable, one per gathered ability, showing `N×` cost, the label, and a ⚡ flag for exhaust-to-use. Disabled when unaffordable; spent buttons go `.spent` + ✔ and stay disabled (**no undo on chat cards**).

**Who may click a surge button** (`onSpendSurge`, `:726`): **the GM or the message author.** Anyone else gets `SWIA.Roll.NoPermission` "Only the roller or a GM can spend surges." Unaffordable clicks warn `SWIA.Roll.NotEnoughSurge`.
- A player author tries the update directly; if core rejects it, the spend is **relayed over the `system.swia` socket to the active GM**. With no GM connected: `SWIA.Roll.NoGMForSurge` "A GM must be connected to spend surges on this roll."
- The GM-side socket handler **rejects any relayed spend whose claimed user is missing, is a GM, or is not the card's author** — a deliberate anti-spoofing guard, since Foundry exposes no verified socket sender.
- **Auto-effect:** spending an `exhaustToUse` surge flips its **source weapon/mod card to `exhausted`** — but only *after* the message update lands, and only if the card is currently `ready` (idempotent under relay).

**Surge gathering** (`gatherSurgeAbilities`, `:249`) pulls from: the actor's own `attributes.surgeAbilities`; `specialAbilities` with `surgeCost > 0`; the **active form card** (villain + Shift) surge and special abilities; and, for heroes with a weapon selected, the weapon and its non-depleted mods' structured surges **plus legacy icon-led freeform ability rows** (a row whose text starts with one or more surge `<img>` tags followed by `:` is parsed as a surge, cost = number of icons). Numeric effects are parsed out of freeform text by regex for `+N Damage`, `+N Accuracy`, `Pierce N` (matching both plain words and inline icon images); **anything unrecognized is a display-only spend**.
- **Exhaust-to-use surges are hidden while their card is not `ready`**; passive stats still apply (exhausted ≠ unusable). Depleted items contribute **nothing**.

### 4.4 Combat Window (`combat-window.hbs` / `SWIACombatWindow`) — 720×auto

Shared attacker-vs-defender resolution. State lives in the **world setting `swia.activeCombat`**; every client re-renders from the `updateSetting` hook. **The window auto-opens for every connected user** when a combat starts, and **auto-closes for everyone** when it ends.

**Architecture / permission model:**
- Every mutation is an **intent** dispatched to the **active GM's client** over `system.swia`. A GM executes locally; a player relays. No GM connected → `SWIA.Combat.NoGM` "A GM must be connected to run combat."
- `canControl(user, combat, side)` = **GM, or OWNER of that side's actor**. Note it resolves ownership against `game.actors.get(actorId)` (the base actor), while the combat's *data* resolves through the recorded **token uuid** — so unlinked figures read/spend their own tokens correctly.
- The GM socket handler **rejects relayed intents claiming a GM user** (same spoofing guard as surges).
- **Spectators get a fully rendered, view-only window** — every button is `disabled` per-user in the template and re-checked in `execIntent`.

**Starting:** target a token and attack. If a combat is already active, `startCombat` **reopens the in-progress window** and warns `SWIA.Combat.ActiveExists` "A combat is already in progress — resolve or cancel it first." Empty state otherwise: `SWIA.Combat.NoActive` "No active combat. Target a token and attack to start one."

**Header:** attacker portrait + name, `vs`, defender name + portrait. Window title becomes `Combat: A vs B`.

#### Phase `setup`

*Attacker panel:*
- **Weapon** select (heroes; depleted weapons excluded), disabled unless you control the attacker **and** the phase is setup. Changing it rebuilds pool, keywords, and accuracy.
- `Accuracy: N` and a **keywords line** (`Pierce N · Blast N · Cleave · Reach`).
- **Attack pool** `− count +` per color (`combatAdjustDie`, clamp 0–9), attacker-controller only.
- **Declared Bonuses** (`SWIA.Combat.PreRollBonus`) — one row per stat. Attacker stats: **Damage, Surge, Accuracy**.

*Defender panel:*
- A **Power Tokens** read-out line: `Block N · Evade N · Any N`.
- **Defense pool** `− count +` (black/white), defender-controller only.
- **Declared Bonuses** rows: **Block, Evade** — pre-seeded with `armorBonus` from equipped armor.

*Bonus row anatomy (both sides):*
- Label, plus a `■N` armor hint chip (`SWIA.Roll.FromArmor`) when armor seeded it.
- **Manual `− +` steppers** on the *total*. The floor is `-(armor + token)` — you can pull manual negative to cancel an armor seed that doesn't apply (e.g. "+1 Block against Ranged"), but the **total can never go below 0**.
- Tooltip everywhere: `SWIA.Combat.BonusBreakdown` → `Manual {m} · Armor {a} · Tokens {t}` — the three sources are tracked separately so each undoes on its own.
- **Power-token declare buttons** on token-eligible stats only (attacker: Damage/Surge; defender: Block/Evade):
  - **Typed token** button showing the icon and `×held`, disabled at 0 or outside the window (`SWIA.Combat.SpendTokenHint` "Declare a {label} token (spent before the roll)").
  - **Any token** button, shown only when the figure holds one (`SWIA.Combat.SpendAnyTokenHint` "Declare an Any token as {label}") — converts at spend time.
  - **Undo** button with the spent count (`SWIA.Combat.UnspendTokenHint` "Undo the last declared token (returns it to the figure)").
  - **Declaration windows:** attacker **during setup only**; defender **through setup *and* attackRolled** (i.e. right up until its defense roll).
  - **Mechanically:** declaring **deletes the ActiveEffect from the figure** and stashes its full effect data on the combat so Undo restores it **exactly** (falling back to a fresh id if the same-id restore collides). Undo restores the effect *first*, then pops the log — a failed restore must not lose the token from both places.
  - Token trays repaint live when a GM grants/removes tokens mid-setup (ActiveEffect hooks in `registerCombatHooks`).
- Footer: **Roll Attack** (attacker-controller) and **Cancel Combat** (GM or attacker-controller).

#### Phase `attackRolled`

- Attack roll is posted to chat with flavor `{attacker} attacks {defender}!` and the dice sound.
- Attack faces render with a **`↺` reroll button per die** (`SWIA.Combat.Reroll`) for the attacker-controller.
- Totals: `Damage / Surge / Accuracy` (surge already includes any declared Surge tokens).
- **Defender's bonus rows and token controls stay live here.** Defender dice pool steppers do **not** (setup only).
- Footer: **Roll Defense** (defender-controller), **Cancel Combat**.

#### Phase `rolled`

- Defense roll posted to chat (`{defender} defends!`); defense faces get their own `↺` buttons for the defender-controller.
- Each reroll posts its own chat message (`{name} rerolls a die`), replaces just that face, marks it `.rerolled`, and **recomputes the side's totals from all current faces**.
- **Reroll rule: unlimited, until a surge ability is spent.** `rerollLocked` is set by a surge spend and cleared again if you **undo** the spend (`hasCommittedSpends`). Declared power tokens never lock rerolls (they precede the roll).
- Totals row: `Damage(total) / Surge(usable) / Accuracy / Block / Evade / Dodge!`, with breakdowns `effectiveBlock (raw+bonus−pierce)`.
- `Declared tokens:` summary line.
- `Net Damage: N` or `Dodged — attack misses!`. Blast/Cleave reminder lines.
- **Surge Abilities column** (attacker-controller only):
  - Unspent → `combatSpendSurge`, disabled when unaffordable. `usableSurge = surge − totalEvade − spentSurge` (evade eats surges).
  - Spent → the same button becomes **`combatUnspendSurge`** with an ↺ icon (`SWIA.Combat.UnspendHint` "Undo this surge spend"), refunding the cost, reversing the numeric effects, and **re-readying any card the spend exhausted**.
  - ⚡ flag + source-item name shown per row.
- Footer: **Apply Damage (N)** (attacker-controller) and **Cancel Combat**.

**Apply Damage** → `DialogV2.confirm` "Apply {damage} damage to {name}?" → subtracts `netDamage` from the defender's **wounded-aware** health path (clamped at 0) → posts a **read-only summary card** to chat (title `Combat: A vs B`, all surge buttons de-affordanced, **no flags** so nothing is clickable) → toast `{damage} damage applied to {name}.` → **clears the combat**, closing the window on every client.

**Cancel Combat** → **refunds every declared power token on both sides** back onto its figure, then clears the combat. **No confirm dialog.**

**Legacy state:** a combat saved by an older build (no per-source bonus layers) is treated as finished and dropped at load rather than mis-scored.

---

## 5. Item sheets

One class, `SWIAItemSheet`, 420×580, `submitOnChange: false`. `_renderHTML` picks the template by item type, and **`agendacard` and `imperialclasscard` both map to `classcard-sheet.hbs`** (`mapItemSheetType`).

### 5.1 Shared patterns

- **Edit Mode toggle** — rendered `{{#if isGM}}` in weapon / weaponmod / armor / gear / classcard / heroability sheets, so **only a GM sees the toggle**. Caveat: `#onToggleEdit` itself has **no GM check** (unlike the actor sheet), and `formcard-sheet.hbs` and `ability-sheet.hbs` have **no toolbar at all** — the formcard sheet is permanently in edit layout with a bare Save button.
- **Save** button appears next to the toggle in edit mode; `saveItem` scrapes the form and reports `SWIA.Item.Saved` / `SWIA.Item.NoChangesToSave` / `SWIA.Item.SaveFailed`. **Nothing autosaves** on these sheets — this is the one place in the system where you must press Save.
- **Card image**: `item.img` **is the card scan**. Click it (or the `SWIA.Item.ClickToUploadCard` placeholder) → FilePicker. `#onEditImage` has **no GM/edit gate at all**, though on weapon/armor the `data-action` is only emitted in edit mode; on classcard/gear/weaponmod/formcard/ability it is emitted **always**.
- **Card state pill/button** (`cycleCardState`): `Ready → Exhausted → Depleted → Ready`. **No permission check.** Present on every item sheet including `ability-sheet.hbs` (which is *only* an image + state button).
- Description/ability text is enriched (`@UUID` links, inline rolls) for view mode.

### 5.2 Weapon (`weapon-sheet.hbs`)

Card-frame layout: title strip (name / state pill / `N Credits` cost chip), framed art with pan/zoom applied via inline `object-position` + `transform: scale()`, and an **ATTACK badge** (melee/ranged icon, dice pips, accuracy).
- **Pool substitution display**: when `poolAttribute` is set, the badge shows three **`?` pips** (`SWIA.Item.Weapon.PoolAttributeVariable` "Variable — uses the wielder's attribute pool") instead of printed dice.
- View mode subtitle row: traits, `WeaponClass - Subtype`, keywords line.
- Edit fields: **Traits**, **Range** (Melee/Ranged), **Weapon Class** (Blaster / Disrupter / Blade / Fist / Staff), **Weapon Subtype** (options are **filtered by the chosen class** — e.g. Blaster→Pistol/Rifle/Heavy, Blade→Energy/Fist/Staff), **Attack Dice** ×4, **Attack Pool Source** (Weapon dice (printed) / Strength / Insight / Tech), **Attachment Slots** (0–5), **Accuracy**, **Cost**, **Keywords** (Pierce N, Blast N, Cleave ✓, Reach ✓).
- **Image Framing** `<details>` (shown only when a real image exists): three range sliders — `Image: Left ↔ Right`, `Image: Top ↕ Bottom` (0–100), `Image: Zoom` (0.25–3, step 0.05).
- **Abilities** section: free-text rows (`+ Add Ability` / trash). Placeholder `e.g., +2 Damage, +1 Accuracy, Pierce 2`. Empty: `No abilities.`
- **Surge Abilities** editor: per row **Cost** (min 1), **Effect Type** (Damage / Accuracy / Pierce / Condition / Special), **Value**, free-text effect, and an **Exhaust to use** checkbox (`SWIA.Item.Weapon.ExhaustToUseHint` "Spending this surge exhausts the card; readying it (or undoing the spend) restores it"). View mode renders `N× Surge — effect` plus a ⚡ tag.
- **Flavor Text** textarea → `system.description`.
- Footer: attachment slot pips (view mode).
- **Save mechanics worth knowing:** surge rows and ability rows have **unnamed inputs** and are saved by DOM scrape (`_collectWeaponSurgeUpdate`, `_collectAbilityRowsUpdate`). Both scrapes **bail out if the edit-mode list isn't rendered**, so a view-mode save can't wipe the arrays. The ability scrape **carries the stored `prefix` through** because nothing edits it — indexed named paths used to re-default it on every save.

### 5.3 Weapon Mod (`weaponmod-sheet.hbs`)

Card frame with a **Bonus Dice** badge.
- **Compatibility** select (Melee/Ranged) — this is what the actor sheet's attach validation checks against the weapon's range.
- **Mod Subtype** select, **options filtered by compatibility**: melee → Balance / Energy / Sights / Impact; ranged → Ammunition / Barrel / Sights / Energy.
- **Attached Weapon**: view mode resolves and shows the weapon's **name** (or `No weapon attached`); edit mode exposes the **raw `attachedWeaponId` string in a text input** — a rough edge; the friendly way to attach is the actor sheet's "Attach to…" select.
- Bonus Dice ×4, **Bonus Damage**, **Bonus Accuracy**, Keywords (Pierce/Blast/Cleave/Reach).
- **Surge Abilities** here use a *different, older* editor from the weapon sheet: rows are **named** (`system.surgeAbilities.N.*`), always visible (not edit-gated at the section level), with the value/text input swapping based on effect type. Note the mismatch — `_collectWeaponSurgeUpdate` looks for `.weapon-surge-list.edit-list`, which this template never renders, so mod surges save through the named-path route instead.
- Description textarea; footer cost badge in credits.

### 5.4 Armor (`armor-sheet.hbs`)

Same frame as the weapon sheet, with an **EFFECTS badge** instead of ATTACK: `+N Health` / `+N Block` / `+N Evade` chips, or `None` (`SWIA.Item.Armor.NoEffects`).
- Subtitle row: traits, weight-class line, and an **Equipped / Not Equipped pill** (view) or an **Equipped checkbox** (edit) — tooltip `SWIA.Item.Armor.EquippedHint` "Equipped armor adds its Health to the wearer's max and its Block/Evade to their defense results."
- Edit fields: **Bonus Health** (hint: "Printed +N Health. Added to the wearer's max health while equipped."), **Bonus Block** / **Bonus Evade** (hints: "Applied to every defense roll while equipped (pre-seeds the … bonus in the combat window)"), **Cost**, **Weight Class** (None/Light/Medium/Heavy — explicitly a house-rule convenience, not printed on real cards).
- Same **Image Framing** sliders.
- **Abilities** rows for conditional printed text (`e.g., While defending, apply +1 Block`) — **read by a human, not the engine**.
- **No surge editor** — the code notes it was added and then removed: *"defenders don't spend surges."*
- **No attack dice, ever** — `ArmorData.migrateData` actively **deletes** legacy `defenseDice` and `surgeAbilities` so a stale sheet or import can't resurrect them.

### 5.5 Class Card (also Agenda Card & Imperial Class Card)

- Card image container + state button.
- Edit mode: **Name**, and — **only when `item.type === "classcard"`** — **XP Cost**, **Hero Class** (`e.g., Smuggler, Warrior`), and an **Ability Text** textarea. Agenda cards and Imperial class cards therefore get **name + art + state only**, even though `AgendacardData` defines `influenceCost`, `agendaType`, and `missionEffect` (and en.json has labels for all three). **Those fields are unreachable from any UI.**
- View mode: a details block with class name, `N XP` badge, and enriched ability text — rendered only if any of those exist.

### 5.6 Hero Ability (`heroability-sheet.hbs`)

Plain sheet, no card art. GM-only **Edit Mode** checkbox in the header, name input, **Ability Text** textarea (10 rows), **Save Changes** button. View mode shows enriched text or `No ability text defined.` These items are the drag source for the hero sheet's Hero Abilities list.

### 5.7 Form Card (`formcard-sheet.hbs`)

**No edit-mode toggle** — always editable to whoever can open it.
- Card image + state button, **Form Name** input.
- **Surge Abilities**: cost + effect text rows, `+` / trash.
- **Special Abilities**: name + description + **Surge Cost** rows, `+` / trash.
- **Save** button. `_collectFormcardArrayUpdate` scrapes both lists (this path *does* preserve `surgeCost`) to work around the `expandObject` array bug.

### 5.8 `ability-sheet.hbs`

A 16-line vestigial template (card image + state button only) for the **legacy `ability` item type**, which is migrated away at world load. Not registered as a sheet type; effectively dead.

---

## 6. Global

### 6.1 Actors sidebar buttons (`swia.js:292`)

Injected into `.header-actions` (falling back to `.directory-footer`, then prepend), in this order:

| Button | Icon | Who sees it |
|---|---|---|
| **GM Area** (`SWIA.Portal.GM.Button`) | `fa-user-shield` | **GM only** |
| **Player Area** (`SWIA.Portal.Button`) | `fa-rebel` | everyone |
| **Companion Area** (`SWIA.Portal.Companion.Button`) | `fa-robot-astromech` | everyone |
| **Imperial Area** (`SWIA.Portal.Imperial.Button`) | `fa-empire` | **GM only** |
| **Campaign Tracker** (`SWIA.CampaignTracker.Button`) | `fa-coins` | everyone (read-only for players) |
| **Combat Window** (`SWIA.Combat.Button`) | `fa-crosshairs` | everyone |

Guarded against double-injection on re-render.

### 6.2 Status effects (`CONFIG.statusEffects`, applied at **both** `init` and `setup` so no module can clobber it)

**Conditions (9):** Weakened, Stunned, Bleeding, Focused, Hidden, Blind, Scanned, Recon, Wanted.
**Power tokens (5):** Block, Damage, Evade, Surge, **Any**.

All are ordinary togglable status effects in the token HUD. **Conditions carry no mechanical effect anywhere in the code** — they are markers only.

### 6.3 Power token map badge (`token-badge.js`)

- Installs an `SWIAActor` subclass whose `temporaryEffects` **filters out power tokens**, so the stock status strip never draws them (three Block tokens would otherwise be three identical unreadable icons). `actor.statuses`, the token HUD, and the effects themselves are untouched.
- Draws a PIXI badge **bottom-left inside the token bounds**: a dark rounded backing plate, then one 18px icon per **type held** with a bold white **count** label.
- Redraws on `drawToken` and on any power-token ActiveEffect create/update/delete; repositions on `refreshToken`. Sizing reads the **token document**, never the PIXI container (which would include the badge itself). Refreshes **unlinked placeables too**, since a token granted on a base actor is inherited by them.

### 6.4 Item cards (`item-cards.js`)

- **Hover preview**: one floating element on `<body>` (so it escapes sheet overflow), shared by every surface, 120 ms delay, follows the pointer, flips/clamps to stay on screen. Triggers on `mouseenter` **and `focusin`** (keyboard-accessible); hides on leave/blur **and on any scroll** of `.portal-drop-zone`, `.collapsible-content`, or `.item-list`. Bound to `.swia-card-preview-trigger` in the actor sheet and Player Area. (The Imperial and Companion portals still use their own duplicated copies bound to `.portal-item-open`.)
- **Send to chat** (`postItemCard`): if the item has real card art (`hasCardArt` — anything not blank, not under `icons/svg/`, not `mystery-man`), the **scan itself** is posted. Otherwise a **generated text card** (`item-chat-card.hbs`) is built from item data: subtitle (traits / weapon class / subtype / armor weight class / accessory subtype / mod subtype), dice pips, `+N Damage` / `+N Accuracy`, keyword chips, `+N Health/Block/Evade`, printed ability lines, surge rows (with ⚡ flags), enriched description, and a footer showing the **card state** plus an `Equipped` chip for armor.
- Security: broadcast HTML is enriched then **sanitized** (`sanitizeRichHTML` strips script-ish tags, every `on*` handler, and `javascript:`/non-image `data:` URLs) — a chat card persists and renders on every client, unlike a sheet.
- **Speaker rule:** the card speaks as the actor **only if the user is GM or owns it**; otherwise it posts **unattributed rather than spoofing another player's figure.**

### 6.5 Settings (all `scope: "world"`, `config: false` — none appear in Foundry's Settings UI)

- `swia.schemaMigration` — migration version marker.
- `swia.roundState` — `{round, phase, activationQueue}`; driven by the GM Area.
- `swia.campaignResources` — the seven resources + `missions[]`.
- `swia.activeCombat` — the live combat state (registered in `registerCombatHooks`).

`"socket": true` in system.json enables the `system.swia` relay used by surge spends and combat intents.

### 6.6 Migrations & startup

- **`ability` → `classcard`** migration runs once on `ready`, **GM only**, across every actor: re-creates each legacy item as a `classcard` (defaulting `cooldown` to 0) and deletes the original. Reports `SWIA migrated N legacy class card item(s).`; failure surfaces an error toast.
- Data-model `migrateData` coercions: legacy `{"0":{…}}` pseudo-arrays are coerced back to real arrays for hero abilities, surge abilities, special abilities, weapon abilities, and exhaust abilities. Armor drops `defenseDice`/`surgeAbilities`.
- Handlebars helpers registered for templates: `capitalize`, `range`, `eq`, `or`, `gt`.
- `primaryTokenAttribute: "attributes.health"` — Foundry's token bars read health, and since `health.max` is **derived**, token bars show the armor-inclusive max.

---

## 7. Other user-facing things worth noting

- **Three places write hero XP** (`system.xp`): the hero sheet's XP input (edit mode → GM), the Player Area stepper (GM only), the Campaign Tracker Hero XP grid (GM only). All the same number.
- **Three places cycle card state**: item sheets (ungated), actor sheet rows, portal item cards (GM-or-owner). Same `ready→exhausted→depleted→ready` cycle everywhere.
- **Depleted vs exhausted semantics** (matters at the table): *exhausted* cards keep passive stats but withhold `exhaustToUse` surges, and **Ready All** restores them. *Depleted* weapons **drop out of the attack dropdowns entirely**, depleted mods contribute **nothing** (dice, keywords, accuracy, surges), and **Ready All deliberately skips them** — a depleted card needs a deliberate manual readying.
- **Confirm dialogs in the system** (complete list): Healthy→Wounded (sheet **and** portal); delete an owned item from the actor sheet; remove an Imperial/Agenda card; GM Area "Reset Round"; Combat "Apply Damage". Notably **no confirm** on: Cancel Combat, End Round, Reset Activations, or Campaign Tracker mission removal.
- **Wounding is destructive**: it resets the wounded health pool to full, overwrites `prototypeToken.texture.src`, and repaints every placed token in every scene.
- The character-sheet **Biography** hint explicitly documents inline `<img>` usage — biography fields are raw HTML by design.

---

## 8. What you handle by hand — not automated

Drawn from code comments, unrendered fields, and `BACKLOG.md`.

**Explicitly manual / GM-adjudicated in the code:**
1. **Power tokens are granted by hand.** Comment: *"tokens come from card text the GM adjudicates"* — nothing awards them automatically. GM uses the ± trays on the hero sheet or portal.
2. **Conditional armor text is a manual stepper bump.** "+1 Block against Ranged attacks" seeds unconditionally; the defender (or GM) pulls the manual bonus back down in the combat window. BACKLOG: *"a typed 'vs melee/ranged' field could auto-apply it."*
3. **Blast and Cleave are reminder text only.** The cards print `Blast N — apply damage to each figure adjacent to the target` and `Cleave — excess damage may be applied to another adjacent figure`. No adjacent figure is found, no damage is split.
4. **All nine conditions are inert markers.** Weakened / Stunned / Bleeding / Focused / Hidden / Blind / Scanned / Recon / Wanted apply no mechanical effect.
5. **Unrecognized surge text is a display-only spend.** Only `+N Damage`, `+N Accuracy`, and `Pierce N` are parsed out of freeform text; conditions and special effects are marked spent on the card but applied by humans.
6. **Object interaction text is prose.** "Tech to disable" is not wired to a test.
7. **Accuracy is computed but never checked against range.** Totals are shown; whether the attack reaches is a table call.
8. **Round/phase/activation are bookkeeping only.** No turn order is enforced, no activation is required before acting; the activation queue field is written but never populated with anything but `[]`.
9. **Movement, line of sight, adjacency, and deployment costs** have no automation at all — `deployCost`, `reinforceCost`, `groupSize`, `threat`, and `reward` are all display/tracking fields.
10. **XP is never deducted on purchase.** BACKLOG: *"Class card XP badges; optional XP deduction on purchase with GM override."* `xpCost` is stored and shown, never spent.

**Fields that exist but no UI reaches:**
11. **Weapon `exhaustAbilities`** — the schema has it, `SWIA.Item.Weapon.AddExhaustAbility` / `ExhaustTrigger.{Action,Reaction,Free}` are localized, and `#onAddExhaustAbility` / `#onRemoveExhaustAbility` are registered as actions — but **no template renders them**. BACKLOG: *"clickable on sheet: posts chat card + exhausts the item (schema field exists, currently unrendered)."*
12. **Agenda card `influenceCost`, `agendaType`, `missionEffect`** — in the data model and localized, but the shared classcard sheet gates those fields to `type === "classcard"`.
13. **Hero `attributes.surge` and `attributes.threat`** — in `HeroData`, rendered nowhere.
14. **Class card `cooldown`** (and agenda/imperial-class-card cooldown) — stored, never shown or ticked.
15. **`toggleInventoryPanel`** — a full side-panel implementation with window resizing, unreachable (no `data-action` in any template).

**Known issues / rough edges (BACKLOG "Known issues" + code comments):**
16. **Wound/heal destroys custom token art.** `getHealthyTokenSrc` deliberately falls back to `actor.img`, because wounding overwrites `prototypeToken.texture.src`. **A GM who set token art distinct from the portrait loses it after the first wound/heal cycle.** The code carries a "do NOT 'fix' this by reading prototypeToken first" warning — that would make healing restore the wounded art.
17. **Portal defense dice over-draw above 9.** `buildDefensePool` clamps at 9; the raw portal render does not.
18. **Solo roll dialog has no token declaration step**, no reroll, and no surge undo — those exist only in the combat window. BACKLOG: *"Mirror unlimited rerolls + surge undo into the solo roll dialog and chat cards."*
19. **In-flight combats saved before this build are dropped at load** (the state shape predates the declared-bonus layers).
20. **Duplicating a damaged hero wearing +N armor is untested** — if Foundry fires `createItem` for items carried in `Actor.create` data, the copy silently heals by N.
21. **Special-ability `surgeCost` is dropped by the actor-sheet change scrape** (`_onSpecialAbilityChange` writes only name/description) — it survives only via the edit-mode-exit path.
22. **Player Area drop zones show `.can-drop` to owners but only the GM can actually drop.**
23. **Item sheets do not autosave** — everywhere else in the system does, so this asymmetry will bite players.

**Planned, not built** (BACKLOG "Planned"): "Give to…" item trading between heroes for the between-mission phase; migrating the Companion and Imperial portals onto the shared `item-cards.js` preview; collapse-per-weapon surge lists; one-mod-per-subtype validation (no double barrels) as a table-rules toggle.