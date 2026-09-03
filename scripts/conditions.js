// Conditions — the registry behind CONFIG.statusEffects, with the rules
// each condition carries so the dice pipeline and the sheets can act on it.
//
// A condition is a data record (see normalizeCondition). Built-ins ship
// with their printed rules; a GM can add custom conditions in the same
// shape through the settings menu (world setting "customConditions"),
// and the token HUD, sheets, roll dialog and combat window treat them
// identically. Power tokens are NOT conditions (see actor-actions.js) but
// are appended to the status list here so there is one place that owns it.

import { escapeHTML, statGlyphHTML, dieSwatchHTML } from "./data/common.js";

export const CUSTOM_CONDITIONS_KEY = "customConditions";
export const CONDITION_KINDS = ["beneficial", "harmful", "neutral"];
export const ATTACK_DICE = ["red", "blue", "green", "yellow"];

const ICON_DIR = "systems/swia/icons";

/** Power-token status entries (owned by actor-actions.js semantically). */
const POWER_TOKEN_STATUS_EFFECTS = [
  { id: "power-block",  name: "SWIA.PowerTokens.BlockToken",  img: `${ICON_DIR}/Power Block Token.png` },
  { id: "power-damage", name: "SWIA.PowerTokens.DamageToken", img: `${ICON_DIR}/Power Damage Token.png` },
  { id: "power-evade",  name: "SWIA.PowerTokens.EvadeToken",  img: `${ICON_DIR}/Power Evade Token.png` },
  { id: "power-surge",  name: "SWIA.PowerTokens.SurgeToken",  img: `${ICON_DIR}/Power Surge Token.png` },
  { id: "power-any",    name: "SWIA.PowerTokens.AnyToken",    img: `${ICON_DIR}/Power Any Token.png` }
];

/**
 * Built-in conditions. `name` is an i18n key; custom conditions carry a
 * literal name (see normalizeCondition / conditionLabel).
 *
 * Rule fields:
 *   attackDice / testDice   dice added to the pool when attacking / testing
 *   attack.{damage,surge,accuracy}   flat shifts on the attacker's own result
 *   defense.{block,evade}            flat shifts on the defender's result
 *   defense.accuracy                 shift applied to the ATTACKER's accuracy
 *                                    when this figure defends (Hidden: -2)
 *   discard.{afterAttack,afterTest,endOfActivation,spendAction}
 *   cannotAttack             refuses the attack button (GM may override)
 *   actionStrain             strain suffered per action (damage at max strain)
 */
const BUILTIN_CONDITIONS = [
  {
    id: "focused", name: "SWIA.Conditions.Focused", img: `${ICON_DIR}/Focused.png`, kind: "beneficial",
    attackDice: { green: 1 }, testDice: { green: 1 },
    discard: { afterAttack: true, afterTest: true },
    description: "SWIA.Conditions.FocusedText"
  },
  {
    id: "hidden", name: "SWIA.Conditions.Hidden", img: `${ICON_DIR}/Hidden.png`, kind: "beneficial",
    attack: { surge: 1 }, defense: { accuracy: -2 },
    discard: { afterAttack: true },
    description: "SWIA.Conditions.HiddenText"
  },
  {
    id: "bleeding", name: "SWIA.Conditions.Bleeding", img: `${ICON_DIR}/Bleeding.png`, kind: "harmful",
    actionStrain: 1,
    discard: { spendAction: true },
    description: "SWIA.Conditions.BleedingText"
  },
  {
    id: "stunned", name: "SWIA.Conditions.Stunned", img: `${ICON_DIR}/Stunned.png`, kind: "harmful",
    cannotAttack: true,
    discard: { spendAction: true },
    description: "SWIA.Conditions.StunnedText"
  },
  {
    id: "weakened", name: "SWIA.Conditions.Weakened", img: `${ICON_DIR}/Weaken.png`, kind: "harmful",
    attack: { surge: -1 }, defense: { evade: -1 },
    discard: { endOfActivation: true },
    description: "SWIA.Conditions.WeakenedText"
  }
  // Campaign markers (Blind, Scanned, Recon, Wanted…) are not built in: add
  // them as custom conditions with every rule at 0. Their icons remain in
  // icons/ for that purpose.
];

const BUILTIN_IDS = new Set(BUILTIN_CONDITIONS.map((c) => c.id));
const RESERVED_IDS = new Set([...BUILTIN_IDS, ...POWER_TOKEN_STATUS_EFFECTS.map((e) => e.id)]);

const num = (v) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};
const dice = (src) => Object.fromEntries(ATTACK_DICE.map((c) => [c, Math.max(0, Math.min(9, num(src?.[c])))]));

/** Bring any condition record (built-in, stored custom, or form input) into canonical shape. */
export function normalizeCondition(raw = {}, { custom = false } = {}) {
  const id = String(raw.id ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return {
    id,
    name: String(raw.name ?? "").trim() || id,
    img: String(raw.img ?? "").trim() || "icons/svg/aura.svg",
    kind: CONDITION_KINDS.includes(raw.kind) ? raw.kind : "neutral",
    description: raw.description ?? "",
    attackDice: dice(raw.attackDice),
    testDice: dice(raw.testDice),
    attack: {
      damage: num(raw.attack?.damage),
      surge: num(raw.attack?.surge),
      accuracy: num(raw.attack?.accuracy)
    },
    defense: {
      block: num(raw.defense?.block),
      evade: num(raw.defense?.evade),
      accuracy: num(raw.defense?.accuracy)
    },
    discard: {
      afterAttack: Boolean(raw.discard?.afterAttack),
      afterTest: Boolean(raw.discard?.afterTest),
      endOfActivation: Boolean(raw.discard?.endOfActivation),
      spendAction: Boolean(raw.discard?.spendAction)
    },
    cannotAttack: Boolean(raw.cannotAttack),
    actionStrain: Math.max(0, num(raw.actionStrain)),
    custom
  };
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

let registry = null;

/** Custom conditions from the world setting, normalized; skips ids that collide with built-ins. */
export function customConditions() {
  let stored = [];
  try { stored = game.settings.get("swia", CUSTOM_CONDITIONS_KEY) ?? []; }
  catch (_err) { stored = []; }
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(stored) ? stored : []) {
    const c = normalizeCondition(raw, { custom: true });
    if (!c.id || RESERVED_IDS.has(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/** Rebuild the registry (built-ins + customs). Called at init and whenever the custom list changes. */
export function rebuildConditionRegistry() {
  registry = new Map();
  for (const raw of BUILTIN_CONDITIONS) registry.set(raw.id, normalizeCondition(raw));
  for (const c of customConditions()) registry.set(c.id, c);
  return registry;
}

/** All conditions, built-ins first. */
export function allConditions() {
  return [...(registry ?? rebuildConditionRegistry()).values()];
}

export function getCondition(id) {
  return (registry ?? rebuildConditionRegistry()).get(id) ?? null;
}

/** Display label: built-ins localize their key, customs are literal. */
export function conditionLabel(condition) {
  if (!condition) return "";
  return condition.custom ? condition.name : game.i18n.localize(condition.name);
}

/** Display description (built-ins localize; customs literal, may be empty). */
export function conditionDescription(condition) {
  if (!condition?.description) return "";
  return condition.custom ? condition.description : game.i18n.localize(condition.description);
}

/**
 * The CONFIG.statusEffects list: conditions (built-in, then custom) followed
 * by power tokens. Applied at init and setup (so no module can clobber it)
 * and re-applied when the custom list changes.
 */
export function buildStatusEffects() {
  const conditions = allConditions().map((c) => ({
    id: c.id,
    name: c.name, // i18n key for built-ins (Foundry localizes), literal for customs
    img: c.img
  }));
  return [...conditions, ...POWER_TOKEN_STATUS_EFFECTS];
}

export function applyStatusEffects() {
  CONFIG.statusEffects = buildStatusEffects();
}

/* ------------------------------------------------------------------ */
/* Actor queries                                                       */
/* ------------------------------------------------------------------ */

/** Conditions currently on an actor (registry records, in registry order). */
export function actorConditions(actor) {
  if (!actor) return [];
  const held = new Set();
  if (actor.statuses instanceof Set) {
    for (const s of actor.statuses) held.add(s);
  } else {
    for (const effect of actor.effects ?? []) for (const s of effect.statuses ?? []) held.add(s);
  }
  return allConditions().filter((c) => held.has(c.id));
}

export function hasCondition(actor, id) {
  return actorConditions(actor).some((c) => c.id === id);
}

function addDice(into, from) {
  for (const c of ATTACK_DICE) into[c] = (into[c] ?? 0) + (from?.[c] ?? 0);
  return into;
}

/**
 * Everything the dice pipeline needs from an actor's conditions for one
 * role: "attack" (attacker), "test" (attribute test) or "defense".
 *
 *   dice        extra dice for the pool (attack/test only)
 *   damage/surge/accuracy   attacker's own result shifts (attack only)
 *   block/evade             defender's result shifts (defense only)
 *   attackerAccuracy        shift on the attacker's accuracy (defense only)
 *   cannotAttack            (attack only)
 *   discardIds              conditions this roll discards on resolution
 *   notes                   human-readable "Label +1 Surge" strings
 */
export function conditionEffectsFor(actor, role) {
  const out = {
    dice: dice({}), damage: 0, surge: 0, accuracy: 0,
    block: 0, evade: 0, attackerAccuracy: 0,
    cannotAttack: false, discardIds: [], notes: []
  };
  // Notes are HTML fragments: "+1 <die swatch>", "+1 <surge glyph>". They
  // render through triple-stash inside sanitized label spans.
  const dieNote = (col, n) => `+${n} ${dieSwatchHTML(col)}`;
  const statNote = (stat, n) => `${signed(n)} ${statGlyphHTML(stat)}`;
  for (const c of actorConditions(actor)) {
    const label = conditionLabel(c);
    const parts = [];
    if (role === "attack") {
      addDice(out.dice, c.attackDice);
      for (const col of ATTACK_DICE) if (c.attackDice[col]) parts.push(dieNote(col, c.attackDice[col]));
      out.damage += c.attack.damage;
      out.surge += c.attack.surge;
      out.accuracy += c.attack.accuracy;
      if (c.attack.damage) parts.push(statNote("damage", c.attack.damage));
      if (c.attack.surge) parts.push(statNote("surge", c.attack.surge));
      if (c.attack.accuracy) parts.push(statNote("accuracy", c.attack.accuracy));
      if (c.cannotAttack) out.cannotAttack = true;
      if (c.discard.afterAttack) out.discardIds.push(c.id);
    } else if (role === "test") {
      addDice(out.dice, c.testDice);
      for (const col of ATTACK_DICE) if (c.testDice[col]) parts.push(dieNote(col, c.testDice[col]));
      if (c.discard.afterTest) out.discardIds.push(c.id);
    } else if (role === "defense") {
      out.block += c.defense.block;
      out.evade += c.defense.evade;
      out.attackerAccuracy += c.defense.accuracy;
      if (c.defense.block) parts.push(statNote("block", c.defense.block));
      if (c.defense.evade) parts.push(statNote("evade", c.defense.evade));
      if (c.defense.accuracy) parts.push(`${signed(c.defense.accuracy)} ${statGlyphHTML("accuracy", { label: game.i18n.localize("SWIA.Conditions.AttackerAccuracy") })}`);
    }
    if (parts.length) out.notes.push(`${escapeHTML(label)} (${parts.join(", ")})`);
  }
  return out;
}

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

/* ------------------------------------------------------------------ */
/* Actor mutations                                                     */
/* ------------------------------------------------------------------ */

/** Put a condition on an actor (no-op when already present). */
export async function addCondition(actor, id) {
  if (!actor || !getCondition(id) || hasCondition(actor, id)) return false;
  await actor.toggleStatusEffect(id, { active: true });
  return true;
}

/** Remove a condition from an actor (no-op when absent). */
export async function discardCondition(actor, id) {
  if (!actor || !hasCondition(actor, id)) return false;
  await actor.toggleStatusEffect(id, { active: false });
  return true;
}

/** Remove every listed condition the actor still has. Returns the ids removed. */
export async function discardConditions(actor, ids) {
  const removed = [];
  for (const id of ids ?? []) {
    try {
      if (await discardCondition(actor, id)) removed.push(id);
    } catch (err) {
      console.warn(`SWIA | could not discard condition "${id}"`, err);
    }
  }
  return removed;
}

/** Discard every condition flagged endOfActivation. */
export async function endActivationConditions(actor) {
  const ids = actorConditions(actor).filter((c) => c.discard.endOfActivation).map((c) => c.id);
  return discardConditions(actor, ids);
}

/**
 * Total strain the actor's conditions cost per action (Bleeding: 1).
 * Applying it lives in actor-actions.js, which owns resource math.
 */
export function actionStrainFor(actor) {
  return actorConditions(actor).reduce((n, c) => n + (c.actionStrain ?? 0), 0);
}

/* ------------------------------------------------------------------ */
/* Settings: custom conditions + GM config form                        */
/* ------------------------------------------------------------------ */

export function registerConditionSettings() {
  game.settings.register("swia", CUSTOM_CONDITIONS_KEY, {
    name: "SWIA Custom Conditions",
    scope: "world",
    config: false,
    type: Array,
    default: [],
    onChange: () => {
      rebuildConditionRegistry();
      applyStatusEffects();
      // Open sheets/portals show condition chips; repaint them.
      for (const app of Object.values(ui.windows ?? {})) app.render?.(false);
      for (const app of foundry.applications?.instances?.values?.() ?? []) app.render?.(false);
    }
  });

  game.settings.registerMenu("swia", "conditionsMenu", {
    name: "SWIA.Conditions.MenuName",
    label: "SWIA.Conditions.MenuLabel",
    hint: "SWIA.Conditions.MenuHint",
    icon: "fas fa-notes-medical",
    type: SWIAConditionsConfig,
    restricted: true
  });
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM form for custom conditions: one row per condition with the rule
 * fields as steppers/checkboxes. Saving writes the whole array back to
 * the world setting, which rebuilds the registry on every client.
 */
export class SWIAConditionsConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "swia-conditions-config",
    classes: ["swia-conditions-config"],
    tag: "form",
    position: { width: 760, height: "auto" },
    window: { title: "SWIA.Conditions.MenuName", icon: "fas fa-notes-medical", resizable: true },
    form: {
      handler: SWIAConditionsConfig.prototype._onSubmit,
      closeOnSubmit: true
    },
    actions: {
      addCondition: SWIAConditionsConfig.prototype._onAdd,
      removeCondition: SWIAConditionsConfig.prototype._onRemove,
      pickIcon: SWIAConditionsConfig.prototype._onPickIcon
    }
  };

  static PARTS = {
    main: { template: "systems/swia/templates/settings/conditions-config.hbs" }
  };

  constructor(options = {}) {
    super(options);
    // Working copy; the setting is only written on Save.
    this.rows = customConditions().map((c) => foundry.utils.deepClone(c));
  }

  /** Read the current form values back into this.rows (so add/remove keep edits). */
  _scrape() {
    const form = this.element;
    if (!form) return;
    const rows = [...form.querySelectorAll("[data-row-index]")];
    this.rows = rows.map((row) => {
      const get = (name) => row.querySelector(`[name="${name}"]`);
      const val = (name) => get(name)?.value ?? "";
      const chk = (name) => Boolean(get(name)?.checked);
      return normalizeCondition({
        id: val("id"), name: val("name"), img: val("img"), kind: val("kind"), description: val("description"),
        attackDice: Object.fromEntries(ATTACK_DICE.map((c) => [c, val(`attackDice.${c}`)])),
        testDice: Object.fromEntries(ATTACK_DICE.map((c) => [c, val(`testDice.${c}`)])),
        attack: { damage: val("attack.damage"), surge: val("attack.surge"), accuracy: val("attack.accuracy") },
        defense: { block: val("defense.block"), evade: val("defense.evade"), accuracy: val("defense.accuracy") },
        discard: {
          afterAttack: chk("discard.afterAttack"), afterTest: chk("discard.afterTest"),
          endOfActivation: chk("discard.endOfActivation"), spendAction: chk("discard.spendAction")
        },
        cannotAttack: chk("cannotAttack"),
        actionStrain: val("actionStrain")
      }, { custom: true });
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      rows: this.rows.map((c, index) => ({ ...c, index })),
      kinds: CONDITION_KINDS.map((k) => ({ value: k, label: game.i18n.localize(`SWIA.Conditions.Kind.${k.charAt(0).toUpperCase()}${k.slice(1)}`) })),
      diceColors: ATTACK_DICE,
      builtins: BUILTIN_CONDITIONS.map((c) => ({ id: c.id, name: game.i18n.localize(c.name), img: c.img }))
    });
  }

  async _onAdd(event) {
    event.preventDefault();
    this._scrape();
    this.rows.push(normalizeCondition({ id: `custom-${this.rows.length + 1}`, name: "", kind: "neutral" }, { custom: true }));
    this.render();
  }

  async _onRemove(event, target) {
    event.preventDefault();
    this._scrape();
    const index = Number(target?.dataset?.index);
    if (Number.isInteger(index)) this.rows.splice(index, 1);
    this.render();
  }

  async _onPickIcon(event, target) {
    event.preventDefault();
    const index = Number(target?.dataset?.index);
    const input = this.element?.querySelector(`[data-row-index="${index}"] [name="img"]`);
    if (!input) return;
    const FilePickerClass = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    const picker = new FilePickerClass({
      type: "image",
      current: input.value,
      callback: (path) => {
        input.value = path;
        const preview = this.element?.querySelector(`[data-row-index="${index}"] .condition-icon-preview`);
        if (preview) preview.src = path;
      }
    });
    picker.render(true);
  }

  async _onSubmit(event, form, formData) {
    this._scrape();
    const seen = new Set();
    const clean = [];
    for (const c of this.rows) {
      if (!c.id) continue;
      if (RESERVED_IDS.has(c.id)) {
        ui.notifications?.warn(game.i18n.format("SWIA.Conditions.ReservedId", { id: c.id }));
        continue;
      }
      if (seen.has(c.id)) {
        ui.notifications?.warn(game.i18n.format("SWIA.Conditions.DuplicateId", { id: c.id }));
        continue;
      }
      seen.add(c.id);
      const { custom, ...stored } = c;
      clean.push(stored);
    }
    await game.settings.set("swia", CUSTOM_CONDITIONS_KEY, clean);
    // onChange does not fire on the client that set the value.
    rebuildConditionRegistry();
    applyStatusEffects();
    ui.notifications?.info(game.i18n.format("SWIA.Conditions.Saved", { count: clean.length }));
  }
}
