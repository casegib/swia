// SWIA dice roll dialog + chat card (Phase 5, step 19).
// Pool sources by roll type:
//   hero attack      -> equipped weapon attackDice + attached mod bonusDice
//   villain/ally     -> attributes.attack (form-card surge abilities when Shift active)
//   hero attribute   -> attributes.{strength|insight|tech} (wounded variants when wounded)
//   defense          -> actor's own attributes.defense (armor never adds dice;
//                       equipped armor seeds flat Block/Evade bonuses instead)
//   attack target    -> first targeted token's attributes.defense (manual fallback)

import {
  COLOR_TO_DENOM, totalSymbols, rollFaces, faceData, SWIA_DICE, symbolsLabel, dieImgPath
} from "./dice-terms.js";
import { escapeHTML, sanitizeLabelHTML, equippedArmorFor, armorEffectsFor } from "../data/common.js";
import { countPowerTokens, POWER_TOKEN_STATUS } from "../actor-actions.js";
import { conditionEffectsFor, discardConditions, conditionLabel, getCondition } from "../conditions.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApplication = HandlebarsApplicationMixin(ApplicationV2);

const ATTACK_COLORS = ["red", "blue", "green", "yellow"];
const DEFENSE_COLORS = ["black", "white"];
export const CARD_TEMPLATE = "systems/swia/templates/dice/roll-card.hbs";
const CARD_FLAG_SCOPE = "swia";
const CARD_FLAG_KEY = "rollCard";
const MAX_DICE_PER_COLOR = 9;

export function renderTemplateFn(...args) {
  const fn = foundry.applications?.handlebars?.renderTemplate ?? renderTemplate;
  return fn(...args);
}

export function clampCount(value) {
  const n = Math.floor(Number(value) || 0);
  return Math.min(Math.max(n, 0), MAX_DICE_PER_COLOR);
}

/**
 * Parse numeric effects out of freeform surge/ability text. Recognizes plain
 * words ("+2 Damage", "Pierce 2", "+1 Accuracy") and the inline icon images
 * used in effect text (e.g. "+1<img src='.../Damage.png'>").
 * Unrecognized text simply yields no effects (display-only spend).
 */
const TEXT_EFFECT_PATTERNS = [
  { type: "pierce", re: /pierce\s*\+?\s*(\d+)/i },
  { type: "damage", re: /\+\s*(\d+)\s*(?:<img[^>]*damage[^>]*>|damage\b)/i },
  { type: "accuracy", re: /\+\s*(\d+)\s*(?:<img[^>]*accuracy[^>]*>|accuracy\b)/i }
];

export function parseTextEffects(text) {
  const effects = [];
  if (!text) return effects;
  for (const { type, re } of TEXT_EFFECT_PATTERNS) {
    const match = String(text).match(re);
    if (match) effects.push({ type, value: Number(match[1]) || 0 });
  }
  return effects;
}

/**
 * Detect freeform weapon ability rows that are surge abilities: text leading
 * with one or more surge icon images followed by a colon, e.g.
 * "<img ...Surge.png>: +2 <img ...Damage.png>". Returns the surge cost
 * (number of leading icons) or 0 when the row isn't surge-led.
 */
export function parseLeadingSurgeCost(text) {
  if (!text) return 0;
  const match = String(text).match(/^\s*((?:<img[^>]*surge[^>]*>\s*)+):/i);
  if (!match) return 0;
  return (match[1].match(/<img/gi) ?? []).length;
}

/** Build a localized label for a structured surge effect. */
function surgeLabel({ effectType, effectValue, effectText }) {
  const value = Number(effectValue) || 0;
  const text = (effectText ?? "").trim();
  let base = "";
  switch (effectType) {
    case "damage":
      base = `+${value} ${game.i18n.localize("SWIA.Dice.Damage")}`; break;
    case "accuracy":
      base = `+${value} ${game.i18n.localize("SWIA.Dice.Accuracy")}`; break;
    case "pierce":
      base = `${game.i18n.localize("SWIA.Keywords.Pierce")} ${value}`; break;
    default:
      return text || game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Special");
  }
  // Keep any accompanying text (matches _surgeEntryLabel on the actor sheet,
  // so the sheet and the roll card describe the ability identically).
  return text ? `${base}, ${text}` : base;
}

/** Recompute all derived numbers on a roll-card state object. */
export function recomputeCard(state) {
  // Power-token bonuses (combat window); absent on solo-roll cards
  state.bonusBlock ??= 0;
  state.bonusEvade ??= 0;
  // Bonuses may be negative (Weakened: -1 Evade); totals never are.
  state.totalEvade = Math.max(0, state.evade + state.bonusEvade);
  // Defense totals are worth showing when dice were rolled OR armor added
  // flat results to a diceless defender.
  state.showDefenseTotals = (state.defenseFaces?.length ?? 0) > 0
    || state.bonusBlock > 0 || state.bonusEvade > 0;
  state.hasDeclaredTokens = (state.tokenDamage ?? 0) + (state.tokenSurge ?? 0)
    + (state.tokenBlock ?? 0) + (state.tokenEvade ?? 0) > 0;
  // Solo chat cards: per-die reroll buttons show until a surge spend locks
  // them; a read-only summary (combat window's apply) never offers them.
  state.canReroll = !state.rerollLocked && !state.readOnly;
  state.usableSurge = Math.max(0, state.surge - state.totalEvade - state.spentSurge);
  state.pierceTotal = state.basePierce + state.bonusPierce;
  state.effectiveBlock = Math.max(0, state.block + state.bonusBlock - state.pierceTotal);
  state.dodged = state.dodge > 0;
  state.totalDamage = Math.max(0, state.damage + state.bonusDamage);
  state.netDamage = state.dodged ? 0 : Math.max(0, state.totalDamage - state.effectiveBlock);
  state.totalAccuracy = Math.max(0, state.accuracy + state.weaponAccuracy + state.bonusAccuracy);
  state.hasConditionNotes = (state.conditionNotes?.length ?? 0) > 0;
  for (const ability of state.surgeAbilities ?? []) {
    ability.affordable = !ability.spent && ability.cost <= state.usableSurge;
  }
  return state;
}

/* ------------------------------------------------------------------ */
/* Shared result-state mutations (solo chat cards AND combat window)   */
/* ------------------------------------------------------------------ */

/**
 * Replace one rolled face in a face list with a fresh result of the same die.
 * Returns the new face entry, or null when the index/denomination is invalid.
 */
export function replaceFace(faces, index, newResult) {
  const face = faces?.[index];
  if (!face?.denom) return null;
  const newFace = faceData(face.denom, newResult);
  if (!newFace) return null;
  faces[index] = {
    img: dieImgPath(newFace.img),
    label: symbolsLabel(newFace.symbols),
    color: SWIA_DICE[face.denom].color,
    denom: face.denom,
    resultNum: newResult,
    rerolled: true
  };
  return faces[index];
}

/** Sum the symbols currently showing on a face list. */
function sumFaces(faces) {
  const totals = { damage: 0, surge: 0, accuracy: 0, block: 0, evade: 0, dodge: 0 };
  for (const f of faces ?? []) {
    if (!f.denom || f.resultNum == null) continue;
    const fd = faceData(f.denom, f.resultNum);
    if (!fd) continue;
    for (const key of Object.keys(totals)) totals[key] += fd.symbols[key] ?? 0;
  }
  return totals;
}

/**
 * Recompute the raw dice totals of a result state from its current faces
 * (after a reroll). Pre-roll bonuses (declared tokens, manual, armor) are
 * kept: attack surge re-adds `preBonusSurge`; Block/Evade bonuses live in
 * `bonusBlock`/`bonusEvade` and are untouched. `side` limits the recompute
 * to "attack" or "defense"; omit for both.
 */
export function recomputeFaceTotals(state, side = null) {
  if (side !== "defense") {
    const a = sumFaces(state.attackFaces);
    state.damage = a.damage;
    // preBonusSurge may be negative (Weakened); raw surge never is.
    state.surge = Math.max(0, a.surge + (state.preBonusSurge ?? 0));
    state.accuracy = a.accuracy;
  }
  if (side !== "attack") {
    const d = sumFaces(state.defenseFaces);
    state.block = d.block;
    state.evade = d.evade;
    state.dodge = d.dodge;
  }
  return recomputeCard(state);
}

/** Numeric effects of a surge ability (structured or parsed). */
function abilityEffects(ability) {
  return ability.effects
    ?? (["damage", "accuracy", "pierce"].includes(ability.effectType)
      ? [{ type: ability.effectType, value: Number(ability.effectValue) || 0 }]
      : []);
}

/**
 * Mark a surge ability spent on a result state and apply its numeric
 * effects. Locks rerolls (a spend is the one thing a reroll can't undo).
 * Returns false when the spend is invalid. Does NOT touch items.
 */
export function applySurgeToState(state, index) {
  const ability = state?.surgeAbilities?.[Number(index)];
  if (!ability || ability.spent || ability.cost > state.usableSurge) return false;
  ability.spent = true;
  state.spentSurge += ability.cost;
  state.rerollLocked = true;
  for (const fx of abilityEffects(ability)) {
    if (fx.type === "damage") state.bonusDamage += fx.value;
    else if (fx.type === "accuracy") state.bonusAccuracy += fx.value;
    else if (fx.type === "pierce") state.bonusPierce += fx.value;
  }
  recomputeCard(state);
  return true;
}

/** True while any surge ability on the state is spent. */
export function hasCommittedSpends(state) {
  return (state?.surgeAbilities ?? []).some((a) => a.spent);
}

/**
 * Reverse a surge spend on a result state. Rerolls unlock again once no
 * spend remains. Returns false when the ability wasn't spent.
 */
export function revertSurgeOnState(state, index) {
  const ability = state?.surgeAbilities?.[Number(index)];
  if (!ability?.spent) return false;
  ability.spent = false;
  state.spentSurge = Math.max(0, state.spentSurge - ability.cost);
  for (const fx of abilityEffects(ability)) {
    if (fx.type === "damage") state.bonusDamage = Math.max(0, state.bonusDamage - fx.value);
    else if (fx.type === "accuracy") state.bonusAccuracy = Math.max(0, state.bonusAccuracy - fx.value);
    else if (fx.type === "pierce") state.bonusPierce = Math.max(0, state.bonusPierce - fx.value);
  }
  state.rerollLocked = hasCommittedSpends(state);
  recomputeCard(state);
  return true;
}

/**
 * Exhaust-to-use: flip the ability's source card once its spend has landed.
 * Records the exhausted item id on the ability so the undo can ready it
 * back. Idempotent via the "ready" guard.
 */
export async function exhaustSurgeSource(actor, ability) {
  if (!ability?.exhaustToUse || !ability.sourceItemId) return;
  const sourceItem = actor?.items?.get(ability.sourceItemId);
  if (!sourceItem || (sourceItem.system?.cardState ?? "ready") !== "ready") return;
  try {
    await sourceItem.update({ "system.cardState": "exhausted" });
    ability.exhaustedItemId = sourceItem.id;
  } catch (err) {
    console.warn("SWIA | could not exhaust surge source", err);
  }
}

/** Undo the auto-exhaust a surge spend caused (if any). */
export async function readySurgeSource(actor, ability) {
  if (!ability?.exhaustedItemId) return;
  const sourceItem = actor?.items?.get(ability.exhaustedItemId);
  if (sourceItem && sourceItem.system?.cardState === "exhausted") {
    try { await sourceItem.update({ "system.cardState": "ready" }); }
    catch (err) { console.warn("SWIA | could not ready surge source", err); }
  }
  ability.exhaustedItemId = null;
}

/**
 * Roll one replacement die for a face and post it to chat (so Dice So Nice
 * and the log both see it). Returns the new face result number.
 */
export async function rollReplacementDie(face, actor, name) {
  const roll = await new Roll(`1d${face.denom}`).evaluate();
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll],
    flavor: game.i18n.format("SWIA.Combat.RerollFlavor", { name: escapeHTML(name) }),
    sound: CONFIG.sounds.dice
  });
  return roll.dice[0].results[0].result;
}

/* ------------------------------------------------------------------ */
/* Power-token declaration (solo dialog; the combat window keeps its   */
/* own per-source layers but consumes tokens the same way)             */
/* ------------------------------------------------------------------ */

/** Token types each roll type may declare, and the stat each feeds. */
export const ROLL_TOKEN_STATS = {
  attack: ["damage", "surge"],
  defense: ["block", "evade"],
  test: []
};

/**
 * Consume declared power tokens from an actor. `declared` is
 * { [stat]: { typed, any } }. Typed tokens of `stat` go first, then Any
 * tokens converted to `stat`. Returns the count actually consumed per stat
 * (never more than the figure holds — the tray may have changed since the
 * dialog rendered).
 */
export async function consumeDeclaredTokens(actor, declared) {
  const consumed = {};
  if (!actor) return consumed;
  const take = async (status, n) => {
    let taken = 0;
    for (let i = 0; i < n; i++) {
      const held = (actor.effects ?? []).filter((e) => e.statuses?.has?.(status));
      const effect = held[held.length - 1];
      if (!effect) break;
      await effect.delete();
      taken += 1;
    }
    return taken;
  };
  for (const [stat, counts] of Object.entries(declared ?? {})) {
    const status = POWER_TOKEN_STATUS[stat];
    if (!status) continue;
    let n = 0;
    n += await take(status, Math.max(0, Number(counts?.typed) || 0));
    n += await take(POWER_TOKEN_STATUS.any, Math.max(0, Number(counts?.any) || 0));
    consumed[stat] = n;
  }
  return consumed;
}

/* ------------------------------------------------------------------ */
/* Shared pool / surge helpers (used by the solo dialog AND Phase 6   */
/* combat window)                                                      */
/* ------------------------------------------------------------------ */

export const ATTACK_POOL_COLORS = ["red", "blue", "green", "yellow"];
export const DEFENSE_POOL_COLORS = ["black", "white"];

/** Phase 6 hook: combat-window.js registers a starter so targeted attacks
 *  open the shared combat instead of the solo dialog (avoids import cycle). */
let combatStarter = null;
export function setCombatStarter(fn) {
  combatStarter = fn;
}

const toList = (value) => (Array.isArray(value) ? value : Object.values(value ?? {}));

export function heroWeapons(actor) {
  return (actor?.items ?? []).filter((i) => i.type === "weapon");
}

export function weaponModsFor(actor, weapon) {
  if (!weapon) return [];
  // Depleted mods contribute nothing at all (dice, keywords, accuracy,
  // surges) until readied; exhausted mods keep their passive stats.
  return (actor?.items ?? []).filter(
    (i) => i.type === "weaponmod"
      && i.system?.attachedWeaponId === weapon.id
      && (i.system?.cardState ?? "ready") !== "depleted"
  );
}

/** Hero weapons that can currently attack (depleted weapons are out). */
export function usableHeroWeapons(actor) {
  return heroWeapons(actor).filter((w) => (w.system?.cardState ?? "ready") !== "depleted");
}

/** Default weapon for a hero: first ready usable weapon, else first usable. */
export function defaultWeaponId(actor) {
  const weapons = usableHeroWeapons(actor);
  const ready = weapons.find((w) => w.system?.cardState === "ready") ?? weapons[0] ?? null;
  return ready?.id ?? null;
}

/** Attack pool {red, blue, green, yellow} for an actor (hero: weapon + mods). */
export function buildAttackPool(actor, weaponId = null) {
  const pool = { red: 0, blue: 0, green: 0, yellow: 0 };
  if (!actor) return pool;
  if (actor.type === "hero") {
    const weapon = weaponId ? actor.items.get(weaponId) : null;
    if (!weapon) return pool;
    // Pool substitution ("your attack pool with this weapon is your X pool"):
    // a weapon with poolAttribute set draws its base dice from that hero
    // attribute (wounded-aware) instead of its printed dice. Mods still add.
    const poolAttr = weapon.system?.poolAttribute;
    let wd;
    if (["strength", "insight", "tech"].includes(poolAttr)) {
      const sys = actor.system ?? {};
      const attrs = sys.state?.wounded ? (sys.woundedAttributes ?? sys.attributes) : sys.attributes;
      wd = attrs?.[poolAttr] ?? {};
    } else {
      wd = weapon.system?.attackDice ?? {};
    }
    for (const c of ATTACK_POOL_COLORS) pool[c] += clampCount(wd[c]);
    for (const mod of weaponModsFor(actor, weapon)) {
      const bd = mod.system?.bonusDice ?? {};
      for (const c of ATTACK_POOL_COLORS) pool[c] = clampCount(pool[c] + clampCount(bd[c]));
    }
    return pool;
  }
  const dice = actor.system?.attributes?.attack ?? {};
  for (const c of ATTACK_POOL_COLORS) pool[c] = clampCount(dice[c]);
  return pool;
}

// Re-exported for callers that historically imported these from here.
export { equippedArmorFor, armorEffectsFor };

/**
 * Defense pool {black, white} for an actor: the actor's own defense attribute.
 * Armor contributes no dice in Imperial Assault; its printed Block/Evade are
 * flat results, seeded via armorDefenseBonusFor().
 *
 * Single chokepoint — the combat window's defender panel, the solo defense
 * roll and the targeted-defense path all resolve their pool through here.
 */
export function buildDefensePool(actor) {
  const d = actor?.system?.attributes?.defense ?? {};
  return { black: clampCount(d.black), white: clampCount(d.white) };
}

/**
 * Flat {block, evade} a defender starts with from equipped armor. Seeds the
 * combat window's defender bonus row (still adjustable for conditional card
 * text) and the solo defense card.
 */
export function armorDefenseBonusFor(actor) {
  const fx = armorEffectsFor(actor);
  return { block: fx.block, evade: fx.evade };
}

/** Accumulated keyword block: weapon + attached mods (heroes only). */
export function attackKeywordsFor(actor, weaponId = null) {
  const out = { pierce: 0, blast: 0, cleave: false, reach: false };
  if (actor?.type !== "hero") return out;
  const weapon = weaponId ? actor.items.get(weaponId) : null;
  if (!weapon) return out;
  for (const item of [weapon, ...weaponModsFor(actor, weapon)]) {
    const kw = item.system?.keywords ?? {};
    out.pierce += Number(kw.pierce) || 0;
    out.blast += Number(kw.blast) || 0;
    out.cleave = out.cleave || Boolean(kw.cleave);
    out.reach = out.reach || Boolean(kw.reach);
  }
  return out;
}

/** Weapon printed accuracy + mod bonus accuracy (heroes only). */
export function weaponAccuracyFor(actor, weaponId = null) {
  if (actor?.type !== "hero") return 0;
  const weapon = weaponId ? actor.items.get(weaponId) : null;
  if (!weapon) return 0;
  let total = Number(weapon.system?.accuracy) || 0;
  for (const mod of weaponModsFor(actor, weapon)) {
    total += Number(mod.system?.bonusAccuracy) || 0;
  }
  return total;
}

/**
 * Eligible surge abilities for an actor, normalized to
 * { cost, effects, label, source, spent }. Includes: innate surge abilities,
 * surge-costed special abilities, active form card (Shift), and — when
 * weaponId is given — weapon/mod structured surges plus legacy icon-led
 * freeform ability rows.
 */
export function gatherSurgeAbilities(actor, weaponId = null) {
  const out = [];
  if (!actor) return out;
  const sys = actor.system ?? {};

  const pushText = (entry, source) => {
    out.push({
      cost: Math.max(1, Number(entry.cost) || 1),
      effects: parseTextEffects(entry.effectText),
      label: sanitizeLabelHTML(entry.effectText || game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Special")),
      source,
      spent: false
    });
  };
  const pushStructured = (entry, source, sourceItemId = null) => {
    const type = entry.effectType ?? "special";
    const value = Number(entry.effectValue) || 0;
    out.push({
      cost: Math.max(1, Number(entry.cost) || 1),
      effects: ["damage", "accuracy", "pierce"].includes(type) ? [{ type, value }] : [],
      label: sanitizeLabelHTML(surgeLabel(entry)),
      source,
      sourceItemId,
      exhaustToUse: !!entry.exhaustToUse,
      spent: false
    });
  };
  const pushSpecial = (entry, source) => {
    const cost = Math.max(0, Number(entry.surgeCost) || 0);
    if (!cost) return;
    const name = entry.name ? `<strong>${escapeHTML(entry.name)}:</strong> ` : "";
    out.push({
      cost,
      effects: parseTextEffects(entry.description),
      label: sanitizeLabelHTML(`${name}${entry.description ?? ""}`),
      source,
      spent: false
    });
  };

  for (const entry of toList(sys.attributes?.surgeAbilities)) pushText(entry, escapeHTML(actor.name));
  for (const entry of toList(sys.specialAbilities)) pushSpecial(entry, escapeHTML(actor.name));

  if (actor.type === "villain" && sys.hasShift && sys.activeFormId) {
    const formCard = actor.items.get(sys.activeFormId);
    if (formCard) {
      for (const entry of toList(formCard.system?.surgeAbilities)) pushText(entry, escapeHTML(formCard.name));
      for (const entry of toList(formCard.system?.specialAbilities)) pushSpecial(entry, escapeHTML(formCard.name));
    }
  }

  if (weaponId && actor.type === "hero") {
    const weapon = actor.items.get(weaponId);
    if (weapon) {
      for (const item of [weapon, ...weaponModsFor(actor, weapon)]) {
        const itemState = item.system?.cardState ?? "ready";
        if (itemState === "depleted") continue;
        for (const entry of toList(item.system?.surgeAbilities)) {
          // Exhaust-to-use surges are only offered while their card is ready;
          // passive stats stay regardless (exhausted != unusable).
          if (entry.exhaustToUse && itemState !== "ready") continue;
          pushStructured(entry, escapeHTML(item.name), item.id);
        }
        for (const entry of toList(item.system?.abilities)) {
          const cost = parseLeadingSurgeCost(entry.description);
          if (!cost) continue;
          out.push({
            cost,
            effects: parseTextEffects(entry.description),
            label: sanitizeLabelHTML(entry.description),
            source: escapeHTML(item.name),
            spent: false
          });
        }
      }
    }
  }
  return out;
}

export class SWIARollDialog extends BaseApplication {
  static DEFAULT_OPTIONS = {
    id: "swia-roll-dialog",
    classes: ["swia-roll-dialog"],
    tag: "section",
    position: { width: 400, height: "auto" },
    window: { title: "SWIA.Roll.Title", icon: "fas fa-dice" },
    actions: {
      adjustDie: SWIARollDialog.prototype._onAdjustDie,
      adjustToken: SWIARollDialog.prototype._onAdjustToken,
      executeRoll: SWIARollDialog.prototype._onExecuteRoll
    }
  };

  static PARTS = {
    main: {
      template: "systems/swia/templates/dice/roll-dialog.hbs"
    }
  };

  /**
   * @param {object} config
   * @param {Actor} config.actor      The rolling actor.
   * @param {string} config.rollType  "attack" | "test" | "defense"
   * @param {string} [config.attribute] Hero attribute for tests: strength | insight | tech
   */
  constructor({ actor, rollType = "attack", attribute = null } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.rollType = rollType;
    this.attribute = attribute;
    this.selectedWeaponId = null;
    this.targetActor = null;
    // Condition rules for this roll's role (Focused dice, Hidden/Weakened
    // shifts, what to discard afterwards). Read once at open.
    this.conditionFx = conditionEffectsFor(actor, rollType === "defense" ? "defense" : rollType === "test" ? "test" : "attack");
    this.pool = this._buildInitialPool();
    // Power tokens declared for this roll: { [stat]: { typed, any } }.
    // Nothing is consumed until Roll is clicked; closing spends nothing.
    this.declared = Object.fromEntries(
      (ROLL_TOKEN_STATS[this.rollType] ?? []).map((stat) => [stat, { typed: 0, any: 0 }])
    );
  }

  /**
   * A condition that forbids attacking (Stunned) stops the attack here, at
   * the single entry point for both the solo dialog and the combat window.
   * The GM may override (card text sometimes says otherwise); players can't.
   * Returns true when the attack may proceed.
   */
  static async _checkCanAttack(actor) {
    const fx = conditionEffectsFor(actor, "attack");
    if (!fx.cannotAttack) return true;
    if (!game.user?.isGM) {
      ui.notifications?.warn(game.i18n.format("SWIA.Conditions.CannotAttackWarn", { name: actor.name }));
      return false;
    }
    return foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SWIA.Conditions.CannotAttackTitle") },
      content: `<p>${game.i18n.format("SWIA.Conditions.CannotAttackOverride", { name: escapeHTML(actor.name) })}</p>`,
      rejectClose: false
    });
  }

  /** Convenience opener used by sheets and portals. */
  static open(config) {
    if (!config?.actor) return null;
    if (config.rollType === "attack") {
      SWIARollDialog._checkCanAttack(config.actor).then((ok) => {
        if (ok) SWIARollDialog._openChecked(config);
      });
      return null;
    }
    return SWIARollDialog._openChecked(config);
  }

  static _openChecked(config) {
    // Phase 6: a targeted attack starts a shared combat instead of the solo
    // dialog (combat-window.js registers the starter at init).
    if (config.rollType === "attack" && combatStarter) {
      const target = [...(game.user?.targets ?? [])][0];
      if (target?.actor) {
        combatStarter(config.actor, target);
        return null;
      }
      // No target set: prompt to pick one before falling back to a solo roll.
      SWIARollDialog._promptForTarget(config);
      return null;
    }
    const dialog = new SWIARollDialog(config);
    dialog.render(true);
    return dialog;
  }

  /**
   * Attack started with no targeted token: offer the visible tokens on the
   * current scene as targets. Picking one marks it as the user's target and
   * starts shared combat; "Roll Without Target" opens the solo dialog;
   * closing the prompt cancels the attack entirely.
   */
  static async _promptForTarget(config) {
    const candidates = (canvas?.tokens?.placeables ?? [])
      .filter((t) => t.actor && t.visible && t.actor.id !== config.actor.id)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Empty scene (or only the attacker) — nothing to pick, roll solo.
    if (!candidates.length) {
      new SWIARollDialog(config).render(true);
      return;
    }

    const options = candidates
      .map((t, i) => `<option value="${t.id}"${i === 0 ? " selected" : ""}>${escapeHTML(t.name)}</option>`)
      .join("");
    const content = `
      <p>${game.i18n.format("SWIA.Roll.PickTargetHint", { name: escapeHTML(config.actor.name) })}</p>
      <div class="form-group">
        <select name="swiaTarget" style="width: 100%;">${options}</select>
      </div>`;

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("SWIA.Roll.PickTargetTitle"), icon: "fas fa-crosshairs" },
      content,
      buttons: [
        {
          action: "attack",
          label: game.i18n.localize("SWIA.Roll.PickTargetAttack"),
          icon: "fas fa-crosshairs",
          default: true,
          callback: (event, button) => button.form.elements.swiaTarget.value
        },
        {
          action: "solo",
          label: game.i18n.localize("SWIA.Roll.PickTargetSolo"),
          icon: "fas fa-dice"
        }
      ],
      rejectClose: false
    });

    if (!choice) return;
    if (choice === "solo") {
      new SWIARollDialog(config).render(true);
      return;
    }
    const token = canvas?.tokens?.get(choice);
    if (!token?.actor) return;
    // Mark it as the user's target too, so the reticle shows on the map.
    token.setTarget(true, { releaseOthers: true });
    combatStarter(config.actor, token);
  }

  get title() {
    const key = {
      attack: "SWIA.Roll.AttackTitle",
      defense: "SWIA.Roll.DefenseTitle",
      test: "SWIA.Roll.TestTitle"
    }[this.rollType] ?? "SWIA.Roll.Title";
    return `${game.i18n.localize(key)}: ${this.actor?.name ?? ""}`;
  }

  /**
   * Display label for the rolled attribute. Custom slots use their free-text
   * label; built-in attributes use their localized name.
   */
  get attributeLabel() {
    if (!this.attribute) return "";
    if (this.attribute.startsWith("custom")) {
      const sys = this.actor?.system ?? {};
      const wounded = sys.state?.wounded ?? false;
      const attrs = wounded ? (sys.woundedAttributes ?? sys.attributes) : sys.attributes;
      const label = attrs?.[this.attribute]?.label;
      return label || game.i18n.localize("SWIA.Attributes.CustomSlot");
    }
    return game.i18n.localize(`SWIA.Attributes.${this.attribute.charAt(0).toUpperCase()}${this.attribute.slice(1)}`);
  }

  get showAttack() {
    return this.rollType === "attack" || this.rollType === "test";
  }

  get showDefense() {
    return this.rollType === "attack" || this.rollType === "defense";
  }

  _heroWeapons() {
    return usableHeroWeapons(this.actor);
  }

  get selectedWeapon() {
    return this.selectedWeaponId ? this.actor?.items?.get(this.selectedWeaponId) ?? null : null;
  }

  _buildInitialPool() {
    const pool = { red: 0, blue: 0, green: 0, yellow: 0, black: 0, white: 0 };
    const sys = this.actor?.system ?? {};

    if (this.rollType === "defense") {
      return { ...pool, ...buildDefensePool(this.actor) };
    }

    if (this.rollType === "test") {
      const wounded = this.actor?.type === "hero" && sys.state?.wounded;
      const attrs = wounded ? (sys.woundedAttributes ?? sys.attributes) : sys.attributes;
      const dice = attrs?.[this.attribute] ?? {};
      for (const c of ATTACK_COLORS) pool[c] = clampCount(dice[c]);
      this._addConditionDice(pool);
      return pool;
    }

    // Attack
    if (this.actor?.type === "hero") this.selectedWeaponId = defaultWeaponId(this.actor);
    Object.assign(pool, buildAttackPool(this.actor, this.selectedWeaponId));
    this._addConditionDice(pool);

    // Defense from the first targeted token
    const target = [...(game.user?.targets ?? [])][0] ?? null;
    if (target?.actor) {
      this.targetActor = target.actor;
      Object.assign(pool, buildDefensePool(target.actor));
    }
    return pool;
  }

  /** Focused and friends: condition dice ride on top of the printed pool. */
  _addConditionDice(pool) {
    for (const c of ATTACK_COLORS) pool[c] = clampCount(pool[c] + (this.conditionFx?.dice?.[c] ?? 0));
    return pool;
  }

  _applyWeaponPool(pool) {
    for (const c of ATTACK_COLORS) pool[c] = 0;
    Object.assign(pool, buildAttackPool(this.actor, this.selectedWeaponId));
    this._addConditionDice(pool);
  }

  _attackKeywords() {
    return attackKeywordsFor(this.actor, this.selectedWeaponId);
  }

  _weaponAccuracy() {
    return weaponAccuracyFor(this.actor, this.selectedWeaponId);
  }

  /** Eligible surge abilities (delegates to the shared gatherer). */
  _surgeAbilities() {
    const weaponId = this.rollType === "attack" && this.actor?.type === "hero"
      ? this.selectedWeaponId
      : null;
    return gatherSurgeAbilities(this.actor, weaponId);
  }

  /** Any tokens declared across every stat (they share one pool). */
  _anyDeclared() {
    return Object.values(this.declared).reduce((n, d) => n + (d.any ?? 0), 0);
  }

  /**
   * Token rows for the dialog: one per stat this roll type can feed, with
   * the figure's live counts. Empty when the figure holds nothing usable,
   * so the section stays hidden for the common case.
   */
  _tokenRows() {
    const stats = ROLL_TOKEN_STATS[this.rollType] ?? [];
    if (!stats.length) return [];
    const held = countPowerTokens(this.actor);
    const anyLeft = (held.any ?? 0) - this._anyDeclared();
    const rows = stats.map((stat) => {
      const d = this.declared[stat] ?? { typed: 0, any: 0 };
      const cap = stat.charAt(0).toUpperCase() + stat.slice(1);
      return {
        stat,
        label: game.i18n.localize(`SWIA.Dice.${cap}`),
        icon: `systems/swia/icons/Power ${cap} Token.png`,
        anyIcon: "systems/swia/icons/Power Any Token.png",
        typedHeld: held[stat] ?? 0,
        anyHeld: held.any ?? 0,
        typed: d.typed,
        any: d.any,
        canAddTyped: d.typed < (held[stat] ?? 0),
        canAddAny: anyLeft > 0,
        declared: d.typed + d.any
      };
    });
    const usable = rows.some((r) => r.typedHeld > 0) || (held.any ?? 0) > 0;
    return usable ? rows : [];
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const weapons = this.rollType === "attack" && this.actor?.type === "hero" ? this._heroWeapons() : [];

    const diceRow = (color) => ({
      color,
      label: game.i18n.localize(`SWIA.Roll.Die.${color.charAt(0).toUpperCase()}${color.slice(1)}`),
      count: this.pool[color]
    });

    const tokenRows = this._tokenRows();

    // Defender-side conditions on a targeted solo attack (rare — targeted
    // attacks normally go to the combat window) shift the attacker's accuracy.
    const targetFx = this.rollType === "attack" && this.targetActor
      ? conditionEffectsFor(this.targetActor, "defense") : null;
    const conditionNotes = [
      ...(this.conditionFx?.notes ?? []),
      ...(targetFx?.notes ?? [])
    ];

    return foundry.utils.mergeObject(context, {
      conditionNotes,
      showConditions: conditionNotes.length > 0,
      tokenRows,
      showTokens: tokenRows.length > 0,
      anyHeld: countPowerTokens(this.actor).any ?? 0,
      actorName: this.actor?.name ?? "",
      rollType: this.rollType,
      attributeLabel: this.attributeLabel,
      showAttack: this.showAttack,
      showDefense: this.showDefense,
      showWeaponSelect: weapons.length > 0,
      weapons: weapons.map((w) => ({
        id: w.id,
        name: w.name,
        selected: w.id === this.selectedWeaponId,
        cardState: w.system?.cardState ?? "ready"
      })),
      targetName: this.targetActor?.name ?? "",
      attackRows: ATTACK_COLORS.map(diceRow),
      defenseRows: DEFENSE_COLORS.map(diceRow),
      weaponAccuracy: this._weaponAccuracy(),
      keywords: this._attackKeywords()
    });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const select = this.element?.querySelector?.(".roll-weapon-select");
    if (select) {
      select.addEventListener("change", (event) => {
        this.selectedWeaponId = event.currentTarget.value || null;
        this._applyWeaponPool(this.pool);
        this.render();
      });
    }
  }

  async _onAdjustDie(event, target) {
    event.preventDefault();
    const color = target?.dataset?.color;
    const delta = Number(target?.dataset?.delta) || 0;
    if (!(color in this.pool)) return;
    this.pool[color] = clampCount(this.pool[color] + delta);
    this.render();
  }

  /** Step a declared token count (typed or Any) for a stat, bounded by what the figure holds. */
  async _onAdjustToken(event, target) {
    event.preventDefault();
    const stat = target?.dataset?.stat;
    const kind = target?.dataset?.kind === "any" ? "any" : "typed";
    const delta = Number(target?.dataset?.delta) || 0;
    const d = this.declared[stat];
    if (!d) return;
    const held = countPowerTokens(this.actor);
    const max = kind === "any"
      ? (held.any ?? 0) - (this._anyDeclared() - d.any)
      : (held[stat] ?? 0);
    d[kind] = Math.min(Math.max(d[kind] + delta, 0), Math.max(max, 0));
    this.render();
  }

  _poolFormula(colors) {
    const parts = [];
    for (const color of colors) {
      const count = this.pool[color];
      if (count > 0) parts.push(`${count}d${COLOR_TO_DENOM[color]}`);
    }
    return parts.join(" + ");
  }

  async _onExecuteRoll(event, target) {
    event.preventDefault();

    const attackFormula = this.showAttack ? this._poolFormula(ATTACK_COLORS) : "";
    const defenseFormula = this.showDefense ? this._poolFormula(DEFENSE_COLORS) : "";
    if (!attackFormula && !defenseFormula) {
      ui.notifications?.warn(game.i18n.localize("SWIA.Roll.EmptyPool"));
      return;
    }

    // Declared power tokens are spent now — before the dice — matching the
    // table rule and the combat window's declaration window. Counts come
    // back from what was actually removed from the figure.
    const consumed = await consumeDeclaredTokens(this.actor, this.declared);
    const tok = (stat) => consumed[stat] ?? 0;

    // Condition shifts: the roller's own (attack or defense role) plus, on a
    // targeted solo attack, the defender's shift on the attacker's accuracy.
    const fx = this.conditionFx ?? conditionEffectsFor(this.actor, "attack");
    const targetFx = this.rollType === "attack" && this.targetActor
      ? conditionEffectsFor(this.targetActor, "defense")
      : { block: 0, evade: 0, attackerAccuracy: 0, notes: [] };
    const condAttack = this.rollType === "attack" ? fx : { damage: 0, surge: 0, accuracy: 0 };
    const condDefense = this.rollType === "defense" ? fx : targetFx;
    const conditionNotes = [...(fx.notes ?? []), ...(targetFx.notes ?? [])];

    const attackRoll = attackFormula ? await new Roll(attackFormula).evaluate() : null;
    const defenseRoll = defenseFormula ? await new Roll(defenseFormula).evaluate() : null;

    const attackTotals = totalSymbols(attackRoll);
    const defenseTotals = totalSymbols(defenseRoll);
    const keywords = this.rollType === "attack" && this.actor?.type === "hero"
      ? this._attackKeywords()
      : { pierce: 0, blast: 0, cleave: false, reach: false };

    // Armor Block/Evade apply even when the defender rolls no dice at all.
    const defendingActor = this.rollType === "defense"
      ? this.actor
      : (this.rollType === "attack" ? this.targetActor : null);
    const armorBonus = defendingActor ? armorDefenseBonusFor(defendingActor) : { block: 0, evade: 0 };

    const state = recomputeCard({
      actorName: this.actor?.name ?? "",
      actorId: this.actor?.id ?? "",
      rollType: this.rollType,
      isTest: this.rollType === "test",
      isAttack: this.rollType === "attack",
      isDefense: this.rollType === "defense",
      title: this.title,
      subtitle: this.rollType === "attack"
        ? (this.selectedWeapon?.name ?? "")
        : this.attributeLabel,
      targetName: this.targetActor?.name ?? "",
      attackFaces: rollFaces(attackRoll),
      defenseFaces: rollFaces(defenseRoll),
      damage: attackTotals.damage,
      // Declared Surge tokens ride on the raw surge count (as in the combat
      // window); preBonusSurge keeps them through rerolls.
      surge: Math.max(0, attackTotals.surge + tok("surge") + condAttack.surge),
      preBonusSurge: tok("surge") + condAttack.surge,
      accuracy: attackTotals.accuracy,
      block: defenseTotals.block,
      evade: defenseTotals.evade,
      dodge: defenseTotals.dodge,
      // Equipped armor's printed Block/Evade apply on top of whatever the
      // defender rolled (own defense roll, or the targeted actor on an attack),
      // plus any Block/Evade tokens the defender declared, plus condition
      // shifts (Weakened -1 Evade).
      bonusBlock: armorBonus.block + tok("block") + (condDefense.block ?? 0),
      bonusEvade: armorBonus.evade + tok("evade") + (condDefense.evade ?? 0),
      armorBlock: armorBonus.block,
      armorEvade: armorBonus.evade,
      tokenDamage: tok("damage"),
      tokenSurge: tok("surge"),
      tokenBlock: tok("block"),
      tokenEvade: tok("evade"),
      conditionNotes,
      weaponAccuracy: this.rollType === "attack" ? this._weaponAccuracy() : 0,
      basePierce: keywords.pierce,
      blast: keywords.blast,
      cleave: keywords.cleave,
      bonusDamage: tok("damage") + condAttack.damage,
      bonusAccuracy: this.rollType === "attack" ? condAttack.accuracy + (targetFx.attackerAccuracy ?? 0) : 0,
      bonusPierce: 0,
      spentSurge: 0,
      // Rerolls stay open until a surge is spent (parity with the combat window).
      rerollLocked: false,
      surgeAbilities: this.rollType === "defense" ? [] : this._surgeAbilities()
    });

    const content = await renderTemplateFn(CARD_TEMPLATE, state);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      rolls: [attackRoll, defenseRoll].filter(Boolean),
      content,
      sound: CONFIG.sounds.dice,
      flags: { [CARD_FLAG_SCOPE]: { [CARD_FLAG_KEY]: state } }
    });

    // The roll has resolved: Focused/Hidden-style conditions come off now.
    if (fx.discardIds?.length) {
      const removed = await discardConditions(this.actor, fx.discardIds);
      if (removed.length) {
        ui.notifications?.info(game.i18n.format("SWIA.Conditions.Discarded", {
          name: this.actor.name,
          list: removed.map((id) => conditionLabel(getCondition(id))).join(", ")
        }));
      }
    }

    this.close();
  }
}

export const SOCKET_NAME = "system.swia";

/* ------------------------------------------------------------------ */
/* Solo roll-card actions: spend / unspend surge, reroll a die          */
/* ------------------------------------------------------------------ */

const CARD_ACTIONS = new Set(["spendSurge", "unspendSurge", "rerollDie"]);

/** The actor a roll card speaks for (token-aware, so unlinked figures resolve). */
function cardActor(message) {
  return ChatMessage.getSpeakerActor?.(message.speaker) ?? game.actors?.get(message.speaker?.actor) ?? null;
}

/** Persist a mutated state back onto its card. */
async function saveCardState(message, state) {
  const content = await renderTemplateFn(CARD_TEMPLATE, state);
  await message.update({
    content,
    [`flags.${CARD_FLAG_SCOPE}.${CARD_FLAG_KEY}`]: state
  });
}

/**
 * Apply one card action to a roll-card message. Must run on a client with
 * permission to update the message (the GM, or the author when core allows).
 * Returns false when the action is invalid for the card's current state.
 *
 * Item side effects (exhaust / ready) run only after the message update has
 * landed, so a failed or relayed update never strands an exhausted item.
 */
async function applyCardAction(message, action, payload = {}) {
  const stored = message.getFlag(CARD_FLAG_SCOPE, CARD_FLAG_KEY);
  if (!stored || stored.readOnly) return false;
  const state = foundry.utils.deepClone(stored);
  const index = Number(payload.index);
  if (Number.isNaN(index)) return false;
  const actor = cardActor(message);

  switch (action) {
    case "spendSurge": {
      if (!applySurgeToState(state, index)) return false;
      await saveCardState(message, state);
      const ability = state.surgeAbilities[index];
      await exhaustSurgeSource(actor, ability);
      // exhaustedItemId is set by the exhaust; store it so Undo can ready the card.
      if (ability.exhaustedItemId) await saveCardState(message, state);
      return true;
    }
    case "unspendSurge": {
      const ability = state.surgeAbilities?.[index];
      if (!revertSurgeOnState(state, index)) return false;
      await saveCardState(message, state);
      await readySurgeSource(actor, ability);
      return true;
    }
    case "rerollDie": {
      if (state.rerollLocked) return false;
      const side = payload.side === "defense" ? "defense" : "attack";
      const faces = side === "defense" ? state.defenseFaces : state.attackFaces;
      const face = faces?.[index];
      if (!face?.denom) return false;
      const newResult = await rollReplacementDie(face, actor, state.actorName || actor?.name || "");
      if (!replaceFace(faces, index, newResult)) return false;
      recomputeFaceTotals(state, side);
      await saveCardState(message, state);
      return true;
    }
  }
  return false;
}

/**
 * Handle a card-action click. Core Foundry restricts which message fields a
 * non-GM author may update, so player actions are relayed to the active GM's
 * client over the system socket when a direct update isn't permitted.
 */
async function onCardAction(message, action, payload, event) {
  event.preventDefault();
  if (!(game.user?.isGM || message.isAuthor)) {
    ui.notifications?.warn(game.i18n.localize("SWIA.Roll.NoPermission"));
    return;
  }
  const stored = message.getFlag(CARD_FLAG_SCOPE, CARD_FLAG_KEY);
  if (!stored || stored.readOnly) return;

  // Validate locally so the clicking user gets feedback either way.
  const index = Number(payload.index);
  if (action === "spendSurge") {
    const ability = stored.surgeAbilities?.[index];
    if (!ability || ability.spent) return;
    if (ability.cost > stored.usableSurge) {
      ui.notifications?.warn(game.i18n.localize("SWIA.Roll.NotEnoughSurge"));
      return;
    }
  } else if (action === "unspendSurge") {
    if (!stored.surgeAbilities?.[index]?.spent) return;
  } else if (action === "rerollDie") {
    if (stored.rerollLocked) {
      ui.notifications?.warn(game.i18n.localize("SWIA.Roll.RerollLocked"));
      return;
    }
  }

  // The GM applies directly. A player relays to the active GM whenever one is
  // connected: a reroll posts a die before the message update, so "try locally,
  // relay on failure" would roll twice. With no GM online, try locally anyway
  // (core may permit the author's update) and say so if it doesn't.
  if (game.user.isGM) {
    await applyCardAction(message, action, payload);
    return;
  }
  if (game.users?.activeGM) {
    game.socket?.emit(SOCKET_NAME, {
      type: "cardAction", action, messageId: message.id, payload, userId: game.user.id
    });
    return;
  }
  try {
    await applyCardAction(message, action, payload);
  } catch (err) {
    console.warn("SWIA | roll-card action failed without a GM", err);
    ui.notifications?.warn(game.i18n.localize("SWIA.Roll.NoGMForSurge"));
  }
}

/** GM-side socket handler: execute relayed card actions. */
function onSocketMessage(data) {
  // "spendSurge" is the pre-parity wire shape; keep accepting it.
  const isLegacy = data?.type === "spendSurge";
  if (!isLegacy && data?.type !== "cardAction") return;
  if (game.user !== game.users?.activeGM) return;
  const action = isLegacy ? "spendSurge" : data.action;
  if (!CARD_ACTIONS.has(action)) return;
  const message = game.messages?.get(data.messageId);
  if (!message) return;
  // The acting id is self-asserted — Foundry exposes no verified socket sender
  // on the client. The local GM applies actions directly and never relays, and
  // the click handler only relays for a card's own author, so a legitimate
  // relayed action always comes from the message author. Require exactly that:
  // reject any action whose claimed user is missing, a GM, or not this card's
  // author, so a client can't drive actions on cards it doesn't own.
  const user = game.users?.get(data.userId);
  if (!user || user.isGM || message.author?.id !== user.id) return;
  const payload = isLegacy ? { index: data.index } : (data.payload ?? {});
  applyCardAction(message, action, payload);
}

/** Wire roll-card buttons whenever a card renders. Call once at init. */
export function registerRollCardHooks() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    html.querySelectorAll("[data-swia-surge-index]").forEach((btn) => {
      btn.addEventListener("click", (event) =>
        onCardAction(message, "spendSurge", { index: Number(btn.dataset.swiaSurgeIndex) }, event));
    });
    html.querySelectorAll("[data-swia-unspend-index]").forEach((btn) => {
      btn.addEventListener("click", (event) =>
        onCardAction(message, "unspendSurge", { index: Number(btn.dataset.swiaUnspendIndex) }, event));
    });
    html.querySelectorAll("[data-swia-reroll-index]").forEach((btn) => {
      btn.addEventListener("click", (event) =>
        onCardAction(message, "rerollDie", {
          index: Number(btn.dataset.swiaRerollIndex),
          side: btn.dataset.swiaRerollSide
        }, event));
    });
  });

  // System socket (requires "socket": true in system.json): GM relay for
  // player surge spends that core message-update permissions would reject.
  Hooks.once("ready", () => {
    game.socket?.on?.(SOCKET_NAME, onSocketMessage);
  });
}
