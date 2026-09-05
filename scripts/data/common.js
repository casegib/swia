// Shared field builders for SWIA data models.
// Field options are chosen to be tolerant of legacy data created under template.json:
// no `choices` restrictions, blank strings allowed, numbers coerced from strings.
const fields = foundry.data.fields;

/** Non-negative integer field. */
export function int(initial = 0, options = {}) {
  return new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial, ...options });
}

/** General numeric field (fractional values allowed). */
export function num(initial = 0, options = {}) {
  return new fields.NumberField({ required: true, nullable: false, initial, ...options });
}

/** Plain string field, blank allowed. */
export function str(initial = "") {
  return new fields.StringField({ required: true, blank: true, initial });
}

/** Rich text / HTML string field. */
export function html() {
  return new fields.HTMLField({ required: true, blank: true, initial: "" });
}

/** Boolean field. */
export function bool(initial = false) {
  return new fields.BooleanField({ initial });
}

/** A {value, max} resource pool (health, endurance). */
export function resource(value, max) {
  return new fields.SchemaField({ value: int(value), max: int(max) });
}

/** Attack/attribute dice pool: red/blue/green/yellow counts. */
export function attackDice() {
  return new fields.SchemaField({ red: int(), blue: int(), green: int(), yellow: int() });
}

/** Defense dice pool: black/white counts. */
export function defenseDice() {
  return new fields.SchemaField({ black: int(), white: int() });
}

/**
 * User-definable custom attribute slot: a toggle, a free-text label, and an
 * attack-style dice pool. Defaults to disabled/blank/empty so existing actors
 * load unchanged.
 */
export function customAttr() {
  return new fields.SchemaField({
    enabled: bool(false),
    label: str(),
    icon: str(),
    red: int(), blue: int(), green: int(), yellow: int()
  });
}

/** List of {name, description} ability entries (special abilities, etc.). */
export function abilityList(extraFields = {}) {
  return new fields.ArrayField(new fields.SchemaField({
    name: str(),
    description: str(),
    ...extraFields
  }));
}

/** List of {cost, effectText} surge ability entries (actors, form cards). */
export function surgeList() {
  return new fields.ArrayField(new fields.SchemaField({
    cost: int(1),
    effectText: str()
  }));
}

/** List of structured weapon surge entries: {cost, effectType, effectValue, effectText}. */
export function weaponSurgeList() {
  return new fields.ArrayField(new fields.SchemaField({
    cost: int(1),
    effectType: str("damage"),
    effectValue: num(0),
    effectText: str(),
    // Spending this surge exhausts the owning weapon/mod (pass 2)
    exhaustToUse: bool()
  }));
}

/** Weapon keyword block. */
export function keywords() {
  return new fields.SchemaField({
    pierce: int(),
    blast: int(),
    cleave: bool(),
    reach: bool()
  });
}

/**
 * Coerce legacy plain-object "arrays" ({"0": {...}, "1": {...}}) back into real arrays.
 * Older saves produced these via expandObject on dot-notation indexed keys.
 */
export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

/* ------------------------------------------------------------------ */
/* Modifiers: one shape for armor, class-card passives (and, later,      */
/* imperial attachments)                                                 */
/* ------------------------------------------------------------------ */

export const MODIFIER_STATS = ["health", "endurance", "speed"];
export const MODIFIER_ATTACK = ["damage", "surge", "accuracy", "pierce"];
export const MODIFIER_DEFENSE = ["block", "evade"];
export const ATTACK_DIE_COLORS = ["red", "blue", "green", "yellow"];
export const DEFENSE_DIE_COLORS = ["black", "white"];

/**
 * A printed, always-on effect. Armor's "+4 Health", a passive class card's
 * "+1 Accuracy" / "+1 Speed" / "Pierce 1" / "+1 Evade" / "add 1 white die"
 * are all instances of this one schema, so the actor models, the dice
 * pipeline and the sheets read one shape from every source.
 *
 *   stats    added to the figure's max Health / max Endurance / Speed
 *   attack   flat result shifts while attacking (pierce joins the keywords)
 *   defense  flat result shifts while defending
 *   dice     extra dice in the attack pool / the defense pool
 *
 * Signed integers: printed cards are positive, but a house-ruled
 * "-1 Accuracy" armor is legal.
 */
export function modifierField() {
  const signed = () => int(0, { min: undefined });
  return new fields.SchemaField({
    stats: new fields.SchemaField(Object.fromEntries(MODIFIER_STATS.map((k) => [k, signed()]))),
    attack: new fields.SchemaField(Object.fromEntries(MODIFIER_ATTACK.map((k) => [k, signed()]))),
    defense: new fields.SchemaField(Object.fromEntries(MODIFIER_DEFENSE.map((k) => [k, signed()]))),
    // Dice are signed too: a declared card can remove a die (Ferocity swaps a
    // green for a red). Pools floor at 0 when the modifier is applied.
    dice: new fields.SchemaField({
      attack: new fields.SchemaField(Object.fromEntries(ATTACK_DIE_COLORS.map((k) => [k, signed()]))),
      defense: new fields.SchemaField(Object.fromEntries(DEFENSE_DIE_COLORS.map((k) => [k, signed()])))
    })
  });
}

/**
 * A declared, costed roll effect on a class card ("Exhaust this card while
 * attacking to apply +2 Damage"). Offered as a button on the matching roll
 * surface; paying the cost and applying the modifier is the button's job.
 *
 *   when      attack | defense | test — which roll offers it
 *   scope     self | friendly | any — whose roll offers it (see below)
 *   note      printed condition, shown on the button, never enforced
 *   choice    entries sharing a non-empty choice are mutually exclusive
 *             ("choose one: -1 Block or -1 Evade")
 *   cost      exhaust / strain N / deplete (any combination)
 *   modifier  attack shifts land on the attacker's layer and defense shifts
 *             on the defender's, whichever side declared the card; dice join
 *             the matching pool (stats are unused here)
 *   surgeAbilities  surge abilities the attack gains, weapon-structured
 */
export function cardUseList() {
  return new fields.ArrayField(new fields.SchemaField({
    when: str("attack"),
    // Whose roll offers it: "self" (the owner's own), "friendly" (another
    // figure on the owner's side — Dig In, Professional Aide), or "any"
    // (either — Called Shot, Wookiee Loyalty). The cost is always paid by
    // the card's owner.
    scope: str("self"),
    note: str(),
    choice: str(),
    cost: new fields.SchemaField({
      exhaust: bool(),
      strain: int(),
      deplete: bool(),
      // Imperial cards: threat spent from the campaign pool
      threat: int()
    }),
    modifier: modifierField(),
    surgeAbilities: weaponSurgeList()
  }));
}

export function emptyModifier() {
  return {
    stats: Object.fromEntries(MODIFIER_STATS.map((k) => [k, 0])),
    attack: Object.fromEntries(MODIFIER_ATTACK.map((k) => [k, 0])),
    defense: Object.fromEntries(MODIFIER_DEFENSE.map((k) => [k, 0])),
    dice: {
      attack: Object.fromEntries(ATTACK_DIE_COLORS.map((k) => [k, 0])),
      defense: Object.fromEntries(DEFENSE_DIE_COLORS.map((k) => [k, 0]))
    }
  };
}

/** Sum `from` into `into` (both modifier-shaped; missing parts read as 0). */
export function addModifier(into, from) {
  if (!from) return into;
  for (const k of MODIFIER_STATS) into.stats[k] += Number(from.stats?.[k]) || 0;
  for (const k of MODIFIER_ATTACK) into.attack[k] += Number(from.attack?.[k]) || 0;
  for (const k of MODIFIER_DEFENSE) into.defense[k] += Number(from.defense?.[k]) || 0;
  for (const k of ATTACK_DIE_COLORS) into.dice.attack[k] += Number(from.dice?.attack?.[k]) || 0;
  for (const k of DEFENSE_DIE_COLORS) into.dice.defense[k] += Number(from.dice?.defense?.[k]) || 0;
  return into;
}

export function modifierIsEmpty(mod) {
  if (!mod) return true;
  const nz = (obj = {}) => Object.values(obj).some((v) => Number(v));
  return !(nz(mod.stats) || nz(mod.attack) || nz(mod.defense) || nz(mod.dice?.attack) || nz(mod.dice?.defense));
}

/**
 * Display chips for a modifier: [{key, group, value, label}] — e.g.
 * {key:"health", group:"stats", value:2, label:"+2 Health"}. Used by the
 * armor / class-card rows and sheets. Labels are plain text; callers that
 * want glyphs use statGlyphHTML / dieSwatchHTML on `key`.
 */
export function modifierChips(mod) {
  const out = [];
  if (!mod) return out;
  const sign = (n) => (n > 0 ? `+${n}` : String(n));
  const L = (key) => game.i18n.localize(MODIFIER_LABEL_KEYS[key] ?? key);
  for (const k of MODIFIER_STATS) if (Number(mod.stats?.[k])) out.push({ key: k, group: "stats", value: mod.stats[k], label: `${sign(mod.stats[k])} ${L(k)}` });
  for (const k of MODIFIER_ATTACK) if (Number(mod.attack?.[k])) out.push({ key: k, group: "attack", value: mod.attack[k], label: k === "pierce" ? `${L(k)} ${mod.attack[k]}` : `${sign(mod.attack[k])} ${L(k)}` });
  for (const k of MODIFIER_DEFENSE) if (Number(mod.defense?.[k])) out.push({ key: k, group: "defense", value: mod.defense[k], label: `${sign(mod.defense[k])} ${L(k)}` });
  for (const k of ATTACK_DIE_COLORS) if (Number(mod.dice?.attack?.[k])) out.push({ key: k, group: "attackDice", value: mod.dice.attack[k], label: `${sign(mod.dice.attack[k])} ${L(k)}` });
  for (const k of DEFENSE_DIE_COLORS) if (Number(mod.dice?.defense?.[k])) out.push({ key: k, group: "defenseDice", value: mod.dice.defense[k], label: `${sign(mod.dice.defense[k])} ${L(k)}` });
  return out;
}

const MODIFIER_LABEL_KEYS = {
  health: "SWIA.Attributes.Health", endurance: "SWIA.Attributes.Endurance", speed: "SWIA.Attributes.Speed",
  damage: "SWIA.Dice.Damage", surge: "SWIA.Dice.Surge", accuracy: "SWIA.Dice.Accuracy", pierce: "SWIA.Keywords.Pierce",
  block: "SWIA.Dice.Block", evade: "SWIA.Dice.Evade",
  red: "SWIA.Attack.Red", blue: "SWIA.Attack.Blue", green: "SWIA.Attack.Green", yellow: "SWIA.Attack.Yellow",
  black: "SWIA.Defense.Black", white: "SWIA.Defense.White"
};

/* ------------------------------------------------------------------ */
/* Equipment effects: armor + class-card passives                        */
/* ------------------------------------------------------------------ */

/** Owned armor items currently equipped. `equipped` defaults true (see ArmorData). */
export function equippedArmorFor(actor) {
  const items = actor?.items;
  if (!items) return [];
  const list = typeof items.filter === "function" ? items : Array.from(items);
  return list.filter((i) => i?.type === "armor" && (i.system?.equipped ?? true));
}

/**
 * Every item contributing an always-on modifier, with the modifier it
 * contributes: equipped armor (`system.modifier`) and owned class cards
 * with a non-empty `system.passive`. A purchased class card is always in
 * effect — there is no equip toggle. Imperial attachments join here in a
 * later pass.
 */
export function equipmentSourcesFor(actor) {
  const out = [];
  for (const armor of equippedArmorFor(actor)) out.push({ item: armor, modifier: armor.system?.modifier });
  const items = actor?.items;
  if (items) {
    const list = typeof items.filter === "function" ? items : Array.from(items);
    // Hero class cards, and imperial attachments placed on this group.
    for (const card of list.filter((i) => CARD_USE_ITEM_TYPES.includes(i?.type))) {
      if (!modifierIsEmpty(card.system?.passive)) out.push({ item: card, modifier: card.system.passive });
    }
  }
  // Class-wide imperial cards apply to every villain.
  if (isImperialFigure(actor)) {
    for (const card of imperialClassWideCards()) {
      if (!modifierIsEmpty(card.system?.passive)) out.push({ item: card, modifier: card.system.passive });
    }
  }
  return out;
}

/**
 * Summed always-on modifier for a figure — the single chokepoint for "what
 * does this figure's gear do". The actor models derive max Health / max
 * Endurance / Speed from `.stats`; the combat window and solo cards seed
 * their bonus rows from `.attack` / `.defense`; the pool builders add
 * `.dice`; the sheets and portals display the totals. Stacks across
 * sources, matching how the table plays it.
 */
export function equipmentEffectsFor(actor) {
  const total = emptyModifier();
  for (const { modifier } of equipmentSourcesFor(actor)) addModifier(total, modifier);
  return total;
}

/**
 * Per-source notes for the roll surfaces ("Bank Shot (+1 Accuracy)"), in
 * the same HTML-fragment style as conditionEffectsFor's notes, filtered to
 * what matters for `role` ("attack" | "defense").
 */
export function equipmentRollNotesFor(actor, role) {
  const notes = [];
  for (const { item, modifier } of equipmentSourcesFor(actor)) {
    const parts = [];
    if (role === "attack") {
      for (const k of ATTACK_DIE_COLORS) if (modifier?.dice?.attack?.[k]) parts.push(`+${modifier.dice.attack[k]} ${dieSwatchHTML(k)}`);
      for (const k of MODIFIER_ATTACK) {
        const n = Number(modifier?.attack?.[k]) || 0;
        if (!n) continue;
        parts.push(k === "pierce"
          ? `${escapeHTML(game.i18n.localize("SWIA.Keywords.Pierce"))} ${n}`
          : `${n > 0 ? "+" : ""}${n} ${statGlyphHTML(k)}`);
      }
    } else if (role === "defense") {
      for (const k of DEFENSE_DIE_COLORS) if (modifier?.dice?.defense?.[k]) parts.push(`+${modifier.dice.defense[k]} ${dieSwatchHTML(k)}`);
      for (const k of MODIFIER_DEFENSE) {
        const n = Number(modifier?.defense?.[k]) || 0;
        if (n) parts.push(`${n > 0 ? "+" : ""}${n} ${statGlyphHTML(k)}`);
      }
    }
    if (parts.length) notes.push(`${escapeHTML(item.name)} (${parts.join(", ")})`);
  }
  return notes;
}

/* ------------------------------------------------------------------ */
/* Declared card effects (class-card `use` entries)                     */
/* ------------------------------------------------------------------ */

export const CARD_USE_ITEM_TYPES = ["classcard", "imperialclasscard"];

/**
 * HTML fragment summarizing a modifier for a roll surface: "+2 <dmg>",
 * "+1 <yellow die>", "Pierce 1". Empty string when nothing is set.
 */
export function modifierEffectHTML(mod) {
  const parts = [];
  const sign = (n) => (n > 0 ? `+${n}` : String(n));
  for (const k of MODIFIER_ATTACK) {
    const n = Number(mod?.attack?.[k]) || 0;
    if (!n) continue;
    parts.push(k === "pierce" ? `${escapeHTML(game.i18n.localize("SWIA.Keywords.Pierce"))} ${n}` : `${sign(n)} ${statGlyphHTML(k)}`);
  }
  for (const k of MODIFIER_DEFENSE) {
    const n = Number(mod?.defense?.[k]) || 0;
    if (n) parts.push(`${sign(n)} ${statGlyphHTML(k)}`);
  }
  for (const k of ATTACK_DIE_COLORS) {
    const n = Number(mod?.dice?.attack?.[k]) || 0;
    if (n) parts.push(`${sign(n)} ${dieSwatchHTML(k)}`);
  }
  for (const k of DEFENSE_DIE_COLORS) {
    const n = Number(mod?.dice?.defense?.[k]) || 0;
    if (n) parts.push(`${sign(n)} ${dieSwatchHTML(k)}`);
  }
  return parts.join(", ");
}

/** Plain-text cost chips for a use: ["Exhaust", "1 Strain", "Deplete"]. */
export function cardUseCostLabels(cost) {
  const out = [];
  if (cost?.exhaust) out.push(game.i18n.localize("SWIA.CardUse.CostExhaust"));
  if (Number(cost?.strain) > 0) out.push(game.i18n.format("SWIA.CardUse.CostStrain", { count: Number(cost.strain) }));
  if (cost?.deplete) out.push(game.i18n.localize("SWIA.CardUse.CostDeplete"));
  if (Number(cost?.threat) > 0) out.push(game.i18n.format("SWIA.CardUse.CostThreat", { count: Number(cost.threat) }));
  return out;
}

/* Campaign threat pool (the Campaign Tracker's "threat" resource). Read and
   written here rather than through campaign-tracker.js to keep the data
   layer free of application imports. */
const CAMPAIGN_RESOURCES_SETTING = "campaignResources";

export function campaignThreat() {
  const stored = game.settings?.get?.("swia", CAMPAIGN_RESOURCES_SETTING) ?? {};
  return Math.max(0, Math.floor(Number(stored.threat) || 0));
}

export async function adjustCampaignThreat(delta) {
  if (!game.user?.isGM) return 0;
  const stored = foundry.utils.deepClone(game.settings.get("swia", CAMPAIGN_RESOURCES_SETTING) ?? {});
  const before = Math.max(0, Math.floor(Number(stored.threat) || 0));
  const after = Math.max(0, before + (Number(delta) || 0));
  if (after === before) return 0;
  stored.threat = after;
  await game.settings.set("swia", CAMPAIGN_RESOURCES_SETTING, stored);
  return after - before;
}

/** Is this figure on the Imperial side (reads the Imperial player's class deck)? */
export function isImperialFigure(actor) {
  return actor?.type === "villain";
}

/**
 * The Imperial player's class-wide cards: world items of type
 * imperialclasscard that are not attachments. Their passive and declared
 * effects apply to every villain.
 */
export function imperialClassWideCards() {
  return (game.items?.contents ?? []).filter((i) => i.type === "imperialclasscard" && !i.system?.attachment);
}

/**
 * Resolve the item behind a card use: an embedded item on the figure, or a
 * class-wide card in the world deck (villains only).
 */
export function resolveUseItem(actor, itemId) {
  const own = actor?.items?.get?.(itemId);
  if (own) return own;
  if (!isImperialFigure(actor)) return null;
  const world = game.items?.get?.(itemId);
  return world?.type === "imperialclasscard" && !world.system?.attachment ? world : null;
}

/** Current endurance of a figure (heroes; 0 for figures without the resource). */
function currentEndurance(actor) {
  const sys = actor?.system ?? {};
  const attrs = actor?.type === "hero" && sys.state?.wounded ? (sys.woundedAttributes ?? sys.attributes) : sys.attributes;
  return Number(attrs?.endurance?.value) || 0;
}

/**
 * Whether a use's cost can be paid right now, and why not. `applied` marks
 * uses already declared on the current roll (their cost is paid, so the
 * card's state no longer counts against them).
 */
export function cardUseAvailability(actor, item, use) {
  const state = item?.system?.cardState ?? "ready";
  const cost = use?.cost ?? {};
  if (cost.exhaust && state !== "ready") return { available: false, reason: "SWIA.CardUse.NotReady" };
  if (cost.deplete && state === "depleted") return { available: false, reason: "SWIA.CardUse.Depleted" };
  const strain = Number(cost.strain) || 0;
  if (strain > 0 && actor?.type === "hero" && currentEndurance(actor) < strain) return { available: false, reason: "SWIA.CardUse.NoStrain" };
  const threat = Number(cost.threat) || 0;
  if (threat > 0 && isImperialFigure(actor) && campaignThreat() < threat) return { available: false, reason: "SWIA.CardUse.NoThreat" };
  return { available: true, reason: "" };
}

/** Which side a figure fights on: "rebel" or "imperial". Companions follow whoever they are pinned to. */
export function teamOf(actor) {
  if (!actor) return null;
  if (actor.type === "villain") return "imperial";
  if (actor.type === "ally") {
    const owner = actor.system?.companionOf ? game.actors?.get(actor.system.companionOf) : null;
    return owner ? teamOf(owner) : "rebel";
  }
  return "rebel";
}

/** Figures on the same side as `actor`, excluding itself (world actors). */
export function friendlyFiguresOf(actor) {
  const team = teamOf(actor);
  if (!team) return [];
  const baseId = actor.token?.baseActor?.id ?? actor.id;
  return (game.actors?.contents ?? []).filter((a) => a.id !== baseId && ["hero", "ally", "villain"].includes(a.type) && teamOf(a) === team);
}

/**
 * The declared card effects a figure can offer on a roll of kind `when`
 * ("attack" | "defense" | "test"): one descriptor per matching `use` entry
 * on its class cards, with everything a roll surface needs to draw the
 * button and later pay / undo the cost.
 */
export function cardUsesFor(actor, when, { forFriend = false, owner = null } = {}) {
  const out = [];
  const items = actor?.items;
  if (!items) return out;
  const list = typeof items.filter === "function" ? items : Array.from(items);
  const sources = list.filter((i) => CARD_USE_ITEM_TYPES.includes(i?.type));
  // Class-wide imperial cards are read once, on the acting figure's own pass.
  if (!forFriend && isImperialFigure(actor)) sources.push(...imperialClassWideCards());
  for (const item of sources) {
    const uses = toArray(item.system?.use);
    uses.forEach((use, index) => {
      if ((use?.when ?? "attack") !== when) return;
      const scope = use.scope || "self";
      if (forFriend ? scope === "self" : scope === "friendly") return;
      const mod = use.modifier ?? {};
      const surgeAbilities = toArray(use.surgeAbilities);
      if (modifierIsEmpty(mod) && !surgeAbilities.length && !use.note) return;
      out.push({
        key: forFriend ? `${owner?.id ?? actor.id}:${item.id}:${index}` : `${item.id}:${index}`,
        itemId: item.id,
        useIndex: index,
        // The card's owner pays; null = the acting figure itself.
        ownerActorId: forFriend ? (owner?.id ?? actor.id) : null,
        ownerName: forFriend ? (owner?.name ?? actor.name) : "",
        scope,
        name: item.name,
        note: use.note ?? "",
        choice: use.choice ?? "",
        world: item.parent?.documentName !== "Actor",
        cost: {
          exhaust: Boolean(use.cost?.exhaust),
          strain: Math.max(0, Number(use.cost?.strain) || 0),
          deplete: Boolean(use.cost?.deplete),
          threat: Math.max(0, Number(use.cost?.threat) || 0)
        },
        modifier: foundry.utils.deepClone(mod),
        surgeAbilities: foundry.utils.deepClone(surgeAbilities),
        effectHTML: modifierEffectHTML(mod),
        costLabels: cardUseCostLabels(use.cost),
        ...cardUseAvailability(actor, item, use)
      });
    });
  }
  return out;
}

/**
 * Declared effects OTHER figures on the acting figure's side can lend to
 * this roll (Called Shot on a friend's attack, Dig In on a friend's
 * defense). Each descriptor names its owner, who pays the cost.
 */
export function friendlyCardUsesFor(actor, when) {
  const out = [];
  for (const friend of friendlyFiguresOf(actor)) {
    out.push(...cardUsesFor(friend, when, { forFriend: true, owner: friend }));
  }
  return out;
}

/** The actor that pays for a use descriptor: its owner, else the acting figure. */
export function cardUseOwner(use, actingActor) {
  return use?.ownerActorId ? (game.actors?.get(use.ownerActorId) ?? null) : actingActor;
}

/**
 * Pay a use's cost on its card / figure. Returns the receipt Undo needs
 * ({ cardState: previous state or null, strain: points taken }), or null
 * when the cost could not be paid. Idempotent per receipt: refundCardUse
 * reverses exactly what was paid.
 */
export async function payCardUse(actor, use) {
  const item = resolveUseItem(actor, use.itemId);
  if (!item) return null;
  const current = item.system?.cardState ?? "ready";
  const receipt = { cardState: null, strain: 0, threat: 0 };
  const threat = Number(use.cost.threat) || 0;
  if (threat > 0 && isImperialFigure(actor)) {
    if (campaignThreat() < threat) return null;
    receipt.threat = -(await adjustCampaignThreat(-threat));
  }
  if (use.cost.exhaust || use.cost.deplete) {
    if (use.cost.deplete && current === "depleted") return null;
    if (use.cost.exhaust && !use.cost.deplete && current !== "ready") return null;
    await item.update({ "system.cardState": use.cost.deplete ? "depleted" : "exhausted" });
    receipt.cardState = current;
  }
  const strain = use.cost.strain;
  if (strain > 0 && actor.type === "hero") {
    const before = currentEndurance(actor);
    const next = Math.max(0, before - strain);
    if (next !== before) {
      const sys = actor.system ?? {};
      const path = sys.state?.wounded ? "system.woundedAttributes.endurance.value" : "system.attributes.endurance.value";
      await actor.update({ [path]: next });
      receipt.strain = before - next;
    }
  }
  return receipt;
}

/** Reverse payCardUse from its receipt (card state back, strain back). */
export async function refundCardUse(actor, use, receipt) {
  if (!receipt) return;
  if (receipt.threat > 0) await adjustCampaignThreat(receipt.threat);
  const item = resolveUseItem(actor, use.itemId);
  if (item && receipt.cardState) {
    try { await item.update({ "system.cardState": receipt.cardState }); }
    catch (err) { console.warn("SWIA | could not refund a card use", err); }
  }
  if (receipt.strain > 0 && actor?.type === "hero") {
    const sys = actor.system ?? {};
    const attrs = sys.state?.wounded ? (sys.woundedAttributes ?? sys.attributes) : sys.attributes;
    const path = sys.state?.wounded ? "system.woundedAttributes.endurance.value" : "system.attributes.endurance.value";
    const max = Number(attrs?.endurance?.max) || 0;
    const value = Math.min(max || Infinity, (Number(attrs?.endurance?.value) || 0) + receipt.strain);
    try { await actor.update({ [path]: value }); }
    catch (err) { console.warn("SWIA | could not refund strain", err); }
  }
}

/** Escape raw text for safe HTML interpolation. */
export function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Scrub enriched HTML that is about to be broadcast (chat cards). Unlike
 * sanitizeLabelHTML this keeps ordinary rich text — paragraphs, lists, links,
 * Foundry's own content links — and only removes what can execute: script-ish
 * elements, every on* handler, and javascript: URLs.
 */
const RICH_FORBIDDEN_TAGS = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "base", "form"]);

export function sanitizeRichHTML(value) {
  const html = String(value ?? "");
  if (!html) return "";
  let doc;
  try {
    doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  } catch {
    return escapeHTML(html);
  }
  for (const el of [...doc.body.querySelectorAll("*")]) {
    if (RICH_FORBIDDEN_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (["href", "src", "xlink:href", "action", "formaction"].includes(name)) {
        const url = attr.value.replace(/[\u0000-\u0020]/g, "").toLowerCase();
        const bad = url.startsWith("javascript:") || url.startsWith("vbscript:")
          || (url.startsWith("data:") && !url.startsWith("data:image/"));
        if (bad) el.removeAttribute(attr.name);
      }
    }
  }
  return doc.body.innerHTML;
}

const LABEL_ALLOWED_TAGS = new Set(["img", "strong", "em", "br", "span"]);
const LABEL_ALLOWED_ATTRS = {
  img: new Set(["src", "alt", "title", "class"]),
  strong: new Set(["class", "title"]),
  em: new Set(["class", "title"]),
  br: new Set([]),
  span: new Set(["class", "title"])
};

function isSafeLabelUrl(value) {
  const normalized = String(value ?? "").trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (lower.startsWith("javascript:")) return false;
  if (lower.startsWith("data:")) return /^data:image\//i.test(normalized);
  return true;
}

function sanitizeLabelNode(node, doc) {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent ?? "");
  if (node.nodeType !== 1) return doc.createDocumentFragment();

  const tag = node.tagName.toLowerCase();
  if (!LABEL_ALLOWED_TAGS.has(tag)) {
    const fragment = doc.createDocumentFragment();
    for (const child of node.childNodes) fragment.appendChild(sanitizeLabelNode(child, doc));
    return fragment;
  }

  if (tag === "img") {
    const src = node.getAttribute("src") ?? "";
    if (!isSafeLabelUrl(src)) return doc.createDocumentFragment();
  }

  const clean = doc.createElement(tag);
  const allowedAttrs = LABEL_ALLOWED_ATTRS[tag] ?? new Set();
  for (const attr of node.attributes) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) continue;
    if (!allowedAttrs.has(name)) continue;
    if (tag === "img" && name === "src" && !isSafeLabelUrl(attr.value)) continue;
    clean.setAttribute(name, attr.value);
  }

  for (const child of node.childNodes) clean.appendChild(sanitizeLabelNode(child, doc));
  return clean;
}

/** Sanitize limited rich HTML used in surge labels while preserving icon markup. */
export function sanitizeLabelHTML(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value ?? "");
  const container = document.createElement("div");
  for (const child of template.content.childNodes) container.appendChild(sanitizeLabelNode(child, document));
  return container.innerHTML;
}

/* ------------------------------------------------------------------ */
/* Stat glyphs                                                         */
/* ------------------------------------------------------------------ */

/** Icon file per stat. One place owns the mapping; templates use the `swiaGlyph` helper. */
export const STAT_GLYPHS = {
  damage: "Damage.png",
  surge: "Surge.png",
  accuracy: "Reticle.png",
  block: "Block.png",
  evade: "Evade.png",
  dodge: "Dodge.png",
  strain: "Strain.png",
  pierce: "Reticle.png"
};

/** Localized stat name for a glyph key (falls back to the key). */
export function statLabel(stat) {
  const key = `SWIA.Dice.${String(stat).charAt(0).toUpperCase()}${String(stat).slice(1)}`;
  const label = game?.i18n?.localize?.(key);
  return label && label !== key ? label : String(stat);
}

/**
 * Inline stat glyph: an <img> at text height with the stat name in alt/title.
 * Returns "" for unknown stats so a typo shows nothing rather than a broken image.
 */
export function statGlyphHTML(stat, { label = null } = {}) {
  const file = STAT_GLYPHS[stat];
  if (!file) return "";
  const text = escapeHTML(label ?? statLabel(stat));
  return `<img class="swia-glyph" src="systems/swia/icons/${file}" alt="${text}" title="${text}" />`;
}

/** Inline die swatch for condition notes and similar ("+1 [green]"). */
export function dieSwatchHTML(color, { label = null } = {}) {
  const c = String(color);
  const key = `SWIA.Roll.Die.${c.charAt(0).toUpperCase()}${c.slice(1)}`;
  const text = escapeHTML(label ?? (game?.i18n?.localize?.(key) ?? c));
  return `<span class="dice-block ${c} swia-glyph-die" title="${text}"></span>`;
}
