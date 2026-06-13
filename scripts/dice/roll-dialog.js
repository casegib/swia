// SWIA dice roll dialog + chat card (Phase 5, step 19).
// Pool sources by roll type:
//   hero attack      -> equipped weapon attackDice + attached mod bonusDice
//   villain/ally     -> attributes.attack (form-card surge abilities when Shift active)
//   hero attribute   -> attributes.{strength|insight|tech} (wounded variants when wounded)
//   defense          -> actor's own attributes.defense
//   attack target    -> first targeted token's attributes.defense (manual fallback)

import { COLOR_TO_DENOM, totalSymbols, rollFaces } from "./dice-terms.js";

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
  switch (effectType) {
    case "damage":
      return `+${value} ${game.i18n.localize("SWIA.Dice.Damage")}`;
    case "accuracy":
      return `+${value} ${game.i18n.localize("SWIA.Dice.Accuracy")}`;
    case "pierce":
      return `${game.i18n.localize("SWIA.Keywords.Pierce")} ${value}`;
    default:
      return effectText || game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Special");
  }
}

/** Recompute all derived numbers on a roll-card state object. */
export function recomputeCard(state) {
  // Power-token bonuses (combat window); absent on solo-roll cards
  state.bonusBlock ??= 0;
  state.bonusEvade ??= 0;
  state.usableSurge = Math.max(0, state.surge - (state.evade + state.bonusEvade) - state.spentSurge);
  state.pierceTotal = state.basePierce + state.bonusPierce;
  state.effectiveBlock = Math.max(0, state.block + state.bonusBlock - state.pierceTotal);
  state.dodged = state.dodge > 0;
  state.totalDamage = state.damage + state.bonusDamage;
  state.netDamage = state.dodged ? 0 : Math.max(0, state.totalDamage - state.effectiveBlock);
  state.totalAccuracy = state.accuracy + state.weaponAccuracy + state.bonusAccuracy;
  for (const ability of state.surgeAbilities ?? []) {
    ability.affordable = !ability.spent && ability.cost <= state.usableSurge;
  }
  return state;
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
  return (actor?.items ?? []).filter(
    (i) => i.type === "weaponmod" && i.system?.attachedWeaponId === weapon.id
  );
}

/** Default weapon for a hero: first ready weapon, else first weapon. */
export function defaultWeaponId(actor) {
  const weapons = heroWeapons(actor);
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
    const wd = weapon.system?.attackDice ?? {};
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

/** Defense pool {black, white} for an actor. */
export function buildDefensePool(actor) {
  const d = actor?.system?.attributes?.defense ?? {};
  return { black: clampCount(d.black), white: clampCount(d.white) };
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
      label: entry.effectText || game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Special"),
      source,
      spent: false
    });
  };
  const pushStructured = (entry, source) => {
    const type = entry.effectType ?? "special";
    const value = Number(entry.effectValue) || 0;
    out.push({
      cost: Math.max(1, Number(entry.cost) || 1),
      effects: ["damage", "accuracy", "pierce"].includes(type) ? [{ type, value }] : [],
      label: surgeLabel(entry),
      source,
      spent: false
    });
  };
  const pushSpecial = (entry, source) => {
    const cost = Math.max(0, Number(entry.surgeCost) || 0);
    if (!cost) return;
    const name = entry.name ? `<strong>${entry.name}:</strong> ` : "";
    out.push({
      cost,
      effects: parseTextEffects(entry.description),
      label: `${name}${entry.description ?? ""}`,
      source,
      spent: false
    });
  };

  for (const entry of toList(sys.attributes?.surgeAbilities)) pushText(entry, actor.name);
  for (const entry of toList(sys.specialAbilities)) pushSpecial(entry, actor.name);

  if (actor.type === "villain" && sys.hasShift && sys.activeFormId) {
    const formCard = actor.items.get(sys.activeFormId);
    if (formCard) {
      for (const entry of toList(formCard.system?.surgeAbilities)) pushText(entry, formCard.name);
      for (const entry of toList(formCard.system?.specialAbilities)) pushSpecial(entry, formCard.name);
    }
  }

  if (weaponId && actor.type === "hero") {
    const weapon = actor.items.get(weaponId);
    if (weapon) {
      for (const item of [weapon, ...weaponModsFor(actor, weapon)]) {
        for (const entry of toList(item.system?.surgeAbilities)) pushStructured(entry, item.name);
        for (const entry of toList(item.system?.abilities)) {
          const cost = parseLeadingSurgeCost(entry.description);
          if (!cost) continue;
          out.push({
            cost,
            effects: parseTextEffects(entry.description),
            label: entry.description,
            source: item.name,
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
    this.pool = this._buildInitialPool();
  }

  /** Convenience opener used by sheets and portals. */
  static open(config) {
    if (!config?.actor) return null;
    // Phase 6: a targeted attack starts a shared combat instead of the solo
    // dialog (combat-window.js registers the starter at init).
    if (config.rollType === "attack" && combatStarter) {
      const target = [...(game.user?.targets ?? [])][0];
      if (target?.actor) {
        combatStarter(config.actor, target);
        return null;
      }
    }
    const dialog = new SWIARollDialog(config);
    dialog.render(true);
    return dialog;
  }

  get title() {
    const key = {
      attack: "SWIA.Roll.AttackTitle",
      defense: "SWIA.Roll.DefenseTitle",
      test: "SWIA.Roll.TestTitle"
    }[this.rollType] ?? "SWIA.Roll.Title";
    return `${game.i18n.localize(key)}: ${this.actor?.name ?? ""}`;
  }

  get showAttack() {
    return this.rollType === "attack" || this.rollType === "test";
  }

  get showDefense() {
    return this.rollType === "attack" || this.rollType === "defense";
  }

  _heroWeapons() {
    return heroWeapons(this.actor);
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
      return pool;
    }

    // Attack
    if (this.actor?.type === "hero") this.selectedWeaponId = defaultWeaponId(this.actor);
    Object.assign(pool, buildAttackPool(this.actor, this.selectedWeaponId));

    // Defense from the first targeted token
    const target = [...(game.user?.targets ?? [])][0] ?? null;
    if (target?.actor) {
      this.targetActor = target.actor;
      Object.assign(pool, buildDefensePool(target.actor));
    }
    return pool;
  }

  _applyWeaponPool(pool) {
    for (const c of ATTACK_COLORS) pool[c] = 0;
    Object.assign(pool, buildAttackPool(this.actor, this.selectedWeaponId));
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

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const weapons = this.rollType === "attack" && this.actor?.type === "hero" ? this._heroWeapons() : [];

    const diceRow = (color) => ({
      color,
      label: game.i18n.localize(`SWIA.Roll.Die.${color.charAt(0).toUpperCase()}${color.slice(1)}`),
      count: this.pool[color]
    });

    return foundry.utils.mergeObject(context, {
      actorName: this.actor?.name ?? "",
      rollType: this.rollType,
      attributeLabel: this.attribute
        ? game.i18n.localize(`SWIA.Attributes.${this.attribute.charAt(0).toUpperCase()}${this.attribute.slice(1)}`)
        : "",
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

    const attackRoll = attackFormula ? await new Roll(attackFormula).evaluate() : null;
    const defenseRoll = defenseFormula ? await new Roll(defenseFormula).evaluate() : null;

    const attackTotals = totalSymbols(attackRoll);
    const defenseTotals = totalSymbols(defenseRoll);
    const keywords = this.rollType === "attack" && this.actor?.type === "hero"
      ? this._attackKeywords()
      : { pierce: 0, blast: 0, cleave: false, reach: false };

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
        : (this.attribute ? game.i18n.localize(`SWIA.Attributes.${this.attribute.charAt(0).toUpperCase()}${this.attribute.slice(1)}`) : ""),
      targetName: this.targetActor?.name ?? "",
      attackFaces: rollFaces(attackRoll),
      defenseFaces: rollFaces(defenseRoll),
      damage: attackTotals.damage,
      surge: attackTotals.surge,
      accuracy: attackTotals.accuracy,
      block: defenseTotals.block,
      evade: defenseTotals.evade,
      dodge: defenseTotals.dodge,
      weaponAccuracy: this.rollType === "attack" ? this._weaponAccuracy() : 0,
      basePierce: keywords.pierce,
      blast: keywords.blast,
      cleave: keywords.cleave,
      bonusDamage: 0,
      bonusAccuracy: 0,
      bonusPierce: 0,
      spentSurge: 0,
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

    this.close();
  }
}

export const SOCKET_NAME = "system.swia";

/**
 * Apply a surge spend to a roll-card message. Must run on a client with
 * permission to update the message (the GM, or the author when core allows).
 * Returns false when the spend is invalid (already spent / can't afford).
 */
async function applySurgeSpend(message, index) {
  const stored = message.getFlag(CARD_FLAG_SCOPE, CARD_FLAG_KEY);
  if (!stored || Number.isNaN(index)) return false;

  const state = foundry.utils.deepClone(stored);
  const ability = state.surgeAbilities?.[index];
  if (!ability || ability.spent) return false;
  if (ability.cost > state.usableSurge) return false;

  ability.spent = true;
  state.spentSurge += ability.cost;
  // Apply all parsed/structured numeric effects; anything else (conditions,
  // freeform special text) is shown as applied on the card.
  const effects = ability.effects
    ?? (["damage", "accuracy", "pierce"].includes(ability.effectType)
      ? [{ type: ability.effectType, value: Number(ability.effectValue) || 0 }]
      : []);
  for (const fx of effects) {
    if (fx.type === "damage") state.bonusDamage += fx.value;
    else if (fx.type === "accuracy") state.bonusAccuracy += fx.value;
    else if (fx.type === "pierce") state.bonusPierce += fx.value;
  }
  recomputeCard(state);

  const content = await renderTemplateFn(CARD_TEMPLATE, state);
  await message.update({
    content,
    [`flags.${CARD_FLAG_SCOPE}.${CARD_FLAG_KEY}`]: state
  });
  return true;
}

/**
 * Handle surge-spend clicks. Core Foundry restricts which message fields a
 * non-GM author may update, so player spends are relayed to the active GM's
 * client over the system socket when a direct update isn't permitted.
 */
async function onSpendSurge(message, event) {
  event.preventDefault();
  if (!(game.user?.isGM || message.isAuthor)) {
    ui.notifications?.warn(game.i18n.localize("SWIA.Roll.NoPermission"));
    return;
  }

  const index = Number(event.currentTarget.dataset.swiaSurgeIndex);
  const stored = message.getFlag(CARD_FLAG_SCOPE, CARD_FLAG_KEY);
  if (!stored || Number.isNaN(index)) return;

  // Validate locally so the clicking user gets feedback either way.
  const ability = stored.surgeAbilities?.[index];
  if (!ability || ability.spent) return;
  if (ability.cost > stored.usableSurge) {
    ui.notifications?.warn(game.i18n.localize("SWIA.Roll.NotEnoughSurge"));
    return;
  }

  // GM (or an author core permits) updates directly; otherwise relay to the GM.
  if (game.user.isGM) {
    await applySurgeSpend(message, index);
    return;
  }
  try {
    await applySurgeSpend(message, index);
  } catch (err) {
    const gm = game.users?.activeGM;
    if (!gm) {
      ui.notifications?.warn(game.i18n.localize("SWIA.Roll.NoGMForSurge"));
      return;
    }
    game.socket?.emit(SOCKET_NAME, { type: "spendSurge", messageId: message.id, index });
  }
}

/** GM-side socket handler: execute relayed surge spends. */
function onSocketMessage(payload) {
  if (payload?.type !== "spendSurge") return;
  if (game.user !== game.users?.activeGM) return;
  const message = game.messages?.get(payload.messageId);
  if (!message) return;
  applySurgeSpend(message, Number(payload.index));
}

/** Wire surge-spend buttons whenever a roll card renders. Call once at init. */
export function registerRollCardHooks() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const buttons = html.querySelectorAll("[data-swia-surge-index]");
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener("click", (event) => onSpendSurge(message, event));
    });
  });

  // System socket (requires "socket": true in system.json): GM relay for
  // player surge spends that core message-update permissions would reject.
  Hooks.once("ready", () => {
    game.socket?.on?.(SOCKET_NAME, onSocketMessage);
  });
}
