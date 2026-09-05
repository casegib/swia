// Shared actor/item mutations used by BOTH the actor sheet and the player
// portal. Keeping them here means the two surfaces can never drift: a health
// stepper, a state pill or a Ready All button behaves identically wherever it
// is clicked.

import { escapeHTML, equipmentEffectsFor } from "./data/common.js";
import {
  allConditions, actorConditions, conditionLabel, conditionDescription,
  addCondition, discardCondition, endActivationConditions, actionStrainFor
} from "./conditions.js";

/** Card types that participate in the ready/exhausted/depleted cycle. */
export const READY_ALL_TYPES = ["weapon", "weaponmod", "armor", "classcard", "gear"];

/** Can this user mutate the actor? GM or owner. */
export function canManageActor(actor) {
  return Boolean(game.user?.isGM || actor?.isOwner);
}

/* ------------------------------------------------------------------ */
/* Token art (healthy / wounded portraits)                             */
/* ------------------------------------------------------------------ */

/**
 * Healthy token art.
 *
 * While a hero is healthy the prototype token IS the healthy art (a GM may
 * have set it distinct from the portrait through Foundry's token config).
 * Wounding overwrites prototypeToken.texture.src with the wounded art, so
 * while wounded we read the copy setWoundedState stashed in
 * system.healthyTokenImage — never the prototype, which would make healing
 * restore the wounded art. Heroes wounded before that field existed fall
 * back to the portrait, as before.
 */
export function getHealthyTokenSrc(actor) {
  if (!actor) return "";
  const proto = actor.prototypeToken?.texture?.src || "";
  const wounded = actor.type === "hero" && actor.system?.state?.wounded;
  if (wounded) return actor.system?.healthyTokenImage || actor.img || proto || "";
  return proto || actor.img || "";
}

export function getWoundedTokenSrc(actor) {
  return actor?.system?.woundedTokenImage || getHealthyTokenSrc(actor);
}

/**
 * Push a texture onto every placed token for this actor (linked and unlinked,
 * canvas plus every scene's token documents).
 */
export async function syncActiveTokenTextures(actor, src) {
  if (!actor || !src) return;

  const tokenDocs = [];

  if (typeof actor.getActiveTokens === "function") {
    const activeTokens = actor.getActiveTokens(false, true) || [];
    for (const token of activeTokens) {
      const tokenDoc = token?.document ?? token;
      if (tokenDoc?.id) tokenDocs.push(tokenDoc);
    }
  }

  for (const scene of game.scenes?.contents ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc?.actorId !== actor.id) continue;
      if (tokenDocs.some((existing) => existing.id === tokenDoc.id && existing.parent?.id === tokenDoc.parent?.id)) continue;
      tokenDocs.push(tokenDoc);
    }
  }

  if (!tokenDocs.length) return;

  const updates = [];
  for (const tokenDoc of tokenDocs) {
    if ((tokenDoc.texture?.src || "") === src) continue;
    updates.push(tokenDoc.update({ "texture.src": src }));
  }
  if (updates.length) await Promise.allSettled(updates);
}

/* ------------------------------------------------------------------ */
/* State transitions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Set a hero's wounded state. Resets the newly-active health pool to its max
 * (the wounded card is a fresh side of the hero sheet), clears defeated when
 * healing, and swaps token art to match.
 */
export async function setWoundedState(actor, wounded) {
  if (!actor || actor.type !== "hero") return false;

  const nextTokenSrc = wounded ? getWoundedTokenSrc(actor) : getHealthyTokenSrc(actor);
  const update = { "system.state.wounded": wounded };
  if (!wounded) update["system.state.defeated"] = false;

  // Going healthy -> wounded overwrites the prototype token art below, so
  // stash the current healthy art first (refreshed on every wound, so token
  // art changed while healthy is what comes back on heal).
  if (wounded && !actor.system?.state?.wounded) {
    const healthy = actor.prototypeToken?.texture?.src || actor.img || "";
    if (healthy) update["system.healthyTokenImage"] = healthy;
  }

  if (wounded) {
    const wMax = actor.system.woundedAttributes?.health?.max ?? actor.system.woundedAttributes?.health?.value ?? 0;
    update["system.woundedAttributes.health.value"] = wMax;
  } else {
    const hMax = actor.system.attributes?.health?.max ?? actor.system.attributes?.health?.value ?? 0;
    update["system.attributes.health.value"] = hMax;
  }

  if (nextTokenSrc) update["prototypeToken.texture.src"] = nextTokenSrc;

  try {
    await actor.update(update);
  } catch (error) {
    console.error("SWIA: Failed to toggle wounded state", error);
    ui.notifications?.error(game.i18n.localize("SWIA.State.ToggleFailed"));
    return false;
  }

  if (nextTokenSrc) await syncActiveTokenTextures(actor, nextTokenSrc);
  return true;
}

/**
 * Ask before the destructive transition. Going healthy -> wounded resets the
 * wounded health pool to max and repaints every placed token, so a misclick
 * costs real table state — and the portal now puts this one click from every
 * player. Healing back is not confirmed (restoring full health is expected).
 */
export async function requestWoundedState(actor, wounded) {
  if (!actor || actor.type !== "hero") return false;
  if (wounded) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SWIA.State.WoundConfirmTitle") },
      content: `<p>${game.i18n.format("SWIA.State.WoundConfirm", { name: escapeHTML(actor.name) })}</p>`
    });
    if (!confirmed) return false;
  }
  return setWoundedState(actor, wounded);
}

/** Set a hero's defeated flag (only meaningful while wounded). */
export async function setDefeatedState(actor, defeated) {
  if (!actor || actor.type !== "hero") return false;
  if (!actor.system.state?.wounded) return false;
  await actor.update({ "system.state.defeated": defeated });
  return true;
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

/**
 * Nudge health or endurance by delta on the active attribute set (wounded
 * heroes use their wounded pool, mirroring healthPath() in combat-window.js).
 * Clamped to [0, max].
 */
export async function adjustActorStat(actor, stat, delta) {
  if (!actor) return false;
  const key = stat === "endurance" ? "endurance" : "health";
  const step = Number(delta) || 0;
  if (!step) return false;

  const wounded = actor.type === "hero" && actor.system?.state?.wounded;
  const path = wounded ? `system.woundedAttributes.${key}` : `system.attributes.${key}`;
  const current = Number(foundry.utils.getProperty(actor, `${path}.value`)) || 0;
  const max = Number(foundry.utils.getProperty(actor, `${path}.max`));

  let next = current + step;
  if (Number.isFinite(max) && max > 0) next = Math.min(max, next);
  next = Math.max(0, next);
  if (next === current) return false;

  await actor.update({ [`${path}.value`]: next });
  return true;
}

/* ------------------------------------------------------------------ */
/* Conditions (chips on the sheet header and the portal card)          */
/* ------------------------------------------------------------------ */

/**
 * Display rows for an actor's condition chips. Each carries the manual
 * controls the sheet/portal offer for it: Discard (always), Spend Action
 * (Bleeding/Stunned), Suffer strain (Bleeding), plus flags for the
 * end-of-activation button on the tray.
 */
export function conditionRows(actor) {
  return actorConditions(actor).map((c) => ({
    id: c.id,
    label: conditionLabel(c),
    description: conditionDescription(c),
    icon: c.img,
    kind: c.kind,
    spendAction: c.discard.spendAction,
    actionStrain: c.actionStrain,
    endOfActivation: c.discard.endOfActivation
  }));
}

/** Choices for the "add condition" picker: everything not already on the actor. */
export function conditionChoices(actor) {
  const held = new Set(actorConditions(actor).map((c) => c.id));
  return allConditions()
    .filter((c) => !held.has(c.id))
    .map((c) => ({ id: c.id, label: conditionLabel(c), kind: c.kind }));
}

/** True when any held condition discards at end of activation. */
export function hasEndOfActivationConditions(actor) {
  return actorConditions(actor).some((c) => c.discard.endOfActivation);
}

export async function applyCondition(actor, id) {
  return addCondition(actor, id);
}

export async function removeCondition(actor, id) {
  return discardCondition(actor, id);
}

/**
 * "A figure can spend 1 action to discard this condition." The action
 * itself isn't tracked; this just records the choice and clears the card.
 */
export async function spendActionToDiscard(actor, id) {
  if (!actor) return false;
  const removed = await discardCondition(actor, id);
  if (removed) {
    ui.notifications?.info(game.i18n.format("SWIA.Conditions.SpentAction", {
      name: actor.name, label: conditionLabel(actorConditionById(id))
    }));
  }
  return removed;
}

function actorConditionById(id) {
  return allConditions().find((c) => c.id === id) ?? null;
}

/**
 * Bleeding: "Whenever you perform an action, you must suffer 1 strain (or
 * 1 damage if you are at maximum strain)." Endurance counts down in this
 * system, so max strain == endurance.value 0. Applies every held
 * condition's actionStrain in one go and reports what happened.
 */
export async function sufferActionStrain(actor) {
  if (!actor) return null;
  const total = actionStrainFor(actor);
  if (!total) return null;
  const wounded = actor.type === "hero" && actor.system?.state?.wounded;
  const base = wounded ? "system.woundedAttributes" : "system.attributes";
  const endurance = Number(foundry.utils.getProperty(actor, `${base}.endurance.value`)) || 0;
  const health = Number(foundry.utils.getProperty(actor, `${base}.health.value`)) || 0;
  const strain = Math.min(total, endurance);
  const damage = total - strain;
  const update = {};
  if (strain) update[`${base}.endurance.value`] = endurance - strain;
  if (damage) update[`${base}.health.value`] = Math.max(0, health - damage);
  if (Object.keys(update).length) await actor.update(update);
  const parts = [];
  if (strain) parts.push(game.i18n.format("SWIA.Conditions.StrainSuffered", { count: strain }));
  if (damage) parts.push(game.i18n.format("SWIA.Conditions.DamageSuffered", { count: damage }));
  ui.notifications?.info(`${actor.name}: ${parts.join(", ")}`);
  return { strain, damage };
}

/** End of activation: discard Weakened-style conditions. */
export async function endActivation(actor) {
  if (!actor) return [];
  const removed = await endActivationConditions(actor);
  if (removed.length) {
    ui.notifications?.info(game.i18n.format("SWIA.Conditions.Discarded", {
      name: actor.name,
      list: removed.map((id) => conditionLabel(actorConditionById(id))).join(", ")
    }));
  }
  return removed;
}

/**
 * One dispatcher for every condition button on the sheet and the portal.
 * `target` carries data-op (discard | spendAction | suffer | endActivation |
 * add) and, for per-condition ops, data-condition. "add" reads the picker
 * <select class="condition-add-select"> inside `scope`.
 */
export async function runConditionAction(actor, target, scope = null) {
  if (!actor || !canManageActor(actor)) return false;
  const op = target?.dataset?.op;
  const id = target?.dataset?.condition;
  switch (op) {
    case "discard":
      return removeCondition(actor, id);
    case "spendAction": {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("SWIA.Conditions.SpendActionTitle") },
        content: `<p>${game.i18n.format("SWIA.Conditions.SpendActionConfirm", {
          name: escapeHTML(actor.name), label: escapeHTML(conditionLabel(actorConditionById(id)))
        })}</p>`,
        rejectClose: false
      });
      if (!confirmed) return false;
      return spendActionToDiscard(actor, id);
    }
    case "suffer":
      return sufferActionStrain(actor);
    case "endActivation":
      return endActivation(actor);
    case "add": {
      const select = scope?.querySelector?.(".condition-add-select")
        ?? target?.closest?.(".condition-tray")?.querySelector?.(".condition-add-select");
      const pick = select?.value;
      if (!pick) return false;
      return applyCondition(actor, pick);
    }
  }
  return false;
}

/** Nudge a hero's XP. Campaign Tracker reads/writes this same field. */
export async function adjustActorXp(actor, delta) {
  if (!actor || actor.type !== "hero") return false;
  const step = Number(delta) || 0;
  if (!step) return false;
  const current = Number(actor.system?.xp) || 0;
  const next = Math.max(0, current + step);
  if (next === current) return false;
  await actor.update({ "system.xp": next });
  return true;
}

/* ------------------------------------------------------------------ */
/* Class-card purchase (optional XP deduction)                          */
/* ------------------------------------------------------------------ */

/**
 * Decide whether a class card dropped on a hero is paid for. With the
 * "deduct class card XP" world setting off, or a 0-XP card, it's a plain
 * add. Otherwise the hero's unspent XP is checked: enough → the card is
 * added and the XP deducted after; short → a player is refused, the GM is
 * asked whether to add it unpaid. Returns { allow, deduct }.
 */
export async function settleClassCardPurchase(actor, itemData) {
  const out = { allow: true, deduct: 0 };
  if (actor?.type !== "hero" || itemData?.type !== "classcard") return out;
  if (!game.settings.get("swia", "deductClassCardXp")) return out;
  const cost = Math.max(0, Number(itemData.system?.xpCost) || 0);
  if (!cost) return out;
  const xp = Number(actor.system?.xp) || 0;
  if (xp >= cost) {
    out.deduct = cost;
    return out;
  }
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.format("SWIA.Purchase.NotEnoughXp", { name: actor.name, card: itemData.name, cost, xp }));
    out.allow = false;
    return out;
  }
  out.allow = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("SWIA.Purchase.Title") },
    content: `<p>${game.i18n.format("SWIA.Purchase.OverrideConfirm", {
      name: escapeHTML(actor.name), card: escapeHTML(itemData.name ?? ""), cost, xp
    })}</p>`,
    rejectClose: false
  });
  return out;
}

/** Charge a settled purchase and say so. */
export async function chargeClassCardPurchase(actor, itemData, deduct) {
  if (!deduct) return;
  await adjustActorXp(actor, -deduct);
  ui.notifications?.info(game.i18n.format("SWIA.Purchase.Charged", {
    name: actor.name, card: itemData?.name ?? "", cost: deduct, xp: Number(actor.system?.xp) || 0
  }));
}

/* ------------------------------------------------------------------ */
/* Weapon exhaust abilities                                             */
/* ------------------------------------------------------------------ */

/**
 * Use a weapon's printed exhaust ability: post it to chat and flip the
 * weapon to exhausted. Refused when the weapon isn't ready.
 */
export async function useExhaustAbility(actor, item, index) {
  if (!actor || !item || item.type !== "weapon") return false;
  const abilities = Array.isArray(item.system?.exhaustAbilities) ? item.system.exhaustAbilities : Object.values(item.system?.exhaustAbilities ?? {});
  const ability = abilities[Number(index)];
  if (!ability) return false;
  if ((item.system?.cardState ?? "ready") !== "ready") {
    ui.notifications?.warn(game.i18n.format("SWIA.Inventory.ExhaustNotReady", { name: item.name }));
    return false;
  }
  await item.update({ "system.cardState": "exhausted" });
  const trigger = ability.trigger ? game.i18n.localize(`SWIA.Item.Weapon.ExhaustTrigger.${ability.trigger.charAt(0).toUpperCase()}${ability.trigger.slice(1)}`) : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="swia-exhaust-card"><strong>${escapeHTML(item.name)}</strong> — ${escapeHTML(game.i18n.localize("SWIA.Inventory.ExhaustUsed"))}${trigger ? ` <em>(${escapeHTML(trigger)})</em>` : ""}<p>${escapeHTML(ability.effect ?? "")}</p></div>`
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Power tokens                                                        */
/* ------------------------------------------------------------------ */

/**
 * Power tokens are status effects (see the status list in swia.js), one
 * effect per token so they stack. These helpers are the shared read/write
 * path for the combat window, the portal/sheet chips and the map badge.
 */
export const POWER_TOKEN_TYPES = ["damage", "surge", "block", "evade", "any"];
export const POWER_TOKEN_STATUS = Object.fromEntries(
  POWER_TOKEN_TYPES.map((type) => [type, `power-${type}`])
);

/** Count each power-token type held by an actor: {damage, surge, block, evade, any}. */
export function countPowerTokens(actor) {
  const counts = Object.fromEntries(POWER_TOKEN_TYPES.map((t) => [t, 0]));
  for (const effect of actor?.effects ?? []) {
    for (const type of POWER_TOKEN_TYPES) {
      if (effect.statuses?.has?.(POWER_TOKEN_STATUS[type])) counts[type] += 1;
    }
  }
  return counts;
}

/** True when the actor holds at least one power token of any type. */
export function hasPowerTokens(actor) {
  return Object.values(countPowerTokens(actor)).some((n) => n > 0);
}

/**
 * Display rows for a token tray: every type for editors (so a GM can grant
 * from an empty slot), only held types for everyone else.
 */
export function powerTokenRows(actor, { editable = false } = {}) {
  const counts = countPowerTokens(actor);
  const labels = {
    damage: "SWIA.PowerTokens.DamageToken",
    surge: "SWIA.PowerTokens.SurgeToken",
    block: "SWIA.PowerTokens.BlockToken",
    evade: "SWIA.PowerTokens.EvadeToken",
    any: "SWIA.PowerTokens.AnyToken"
  };
  return POWER_TOKEN_TYPES
    .filter((type) => editable || counts[type] > 0)
    .map((type) => ({
      type,
      count: counts[type],
      label: game.i18n.localize(labels[type]),
      icon: `systems/swia/icons/Power ${type.charAt(0).toUpperCase()}${type.slice(1)} Token.png`
    }));
}

/**
 * Give an actor one more token of `type`. Goes through the status-effect
 * registry so the icon/name match what the token HUD would create, but
 * creates a fresh effect each time (toggleStatusEffect would refuse to
 * stack a second one).
 */
export async function grantPowerToken(actor, type) {
  if (!actor || !POWER_TOKEN_TYPES.includes(type)) return null;
  const EffectClass = CONFIG.ActiveEffect?.documentClass ?? ActiveEffect;
  const effect = await EffectClass.fromStatusEffect(POWER_TOKEN_STATUS[type]);
  const data = effect?.toObject?.() ?? effect;
  if (!data) return null;
  delete data._id;
  return EffectClass.create(data, { parent: actor });
}

/** Take one token of `type` away (the most recently added). */
export async function removePowerToken(actor, type) {
  if (!actor || !POWER_TOKEN_TYPES.includes(type)) return false;
  const status = POWER_TOKEN_STATUS[type];
  const held = (actor.effects ?? []).filter((e) => e.statuses?.has?.(status));
  const effect = held[held.length - 1];
  if (!effect) return false;
  await effect.delete();
  return true;
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

/**
 * Flip an armor item's equipped flag. Health/Block/Evade follow automatically:
 * max health is derived (actors.js) and the item hooks below keep the current
 * value in step with it.
 */
export async function toggleArmorEquipped(item) {
  if (!item || item.type !== "armor") return false;
  await item.update({ "system.equipped": !(item.system?.equipped ?? true) });
  return true;
}

/**
 * Status phase: ready every exhausted card on this actor. Depleted cards are
 * left alone (they need a deliberate readying). Returns the number readied.
 */
export async function readyAllItems(actor) {
  if (!actor) return 0;
  const updates = (actor.items?.contents ?? [])
    .filter((i) => READY_ALL_TYPES.includes(i.type) && i.system?.cardState === "exhausted")
    .map((i) => ({ _id: i.id, "system.cardState": "ready" }));
  if (!updates.length) return 0;
  await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/** Ready All plus the standard user feedback, shared by both surfaces. */
export async function readyAllItemsWithNotice(actor) {
  const count = await readyAllItems(actor);
  if (!count) {
    ui.notifications?.info(game.i18n.localize("SWIA.Inventory.ReadyAllNone"));
    return 0;
  }
  ui.notifications?.info(game.i18n.format("SWIA.Inventory.ReadyAllDone", { count }));
  return count;
}

/* ------------------------------------------------------------------ */
/* Equipment stats: keep damage / strain taken constant when a max moves  */
/* ------------------------------------------------------------------ */

/**
 * The system stores REMAINING health and endurance, but Imperial Assault
 * tracks DAMAGE and STRAIN. When gear changes a max (armor equip/unequip,
 * an armor or class-card edit, a card bought or removed), the remaining
 * value shifts by the same amount so the damage on the figure stays put:
 * 10/12 wearing +2 armor is 12/14, not 10/14. Runs once, on the client
 * that made the item change (it necessarily owns the actor).
 */
const SHIFT_RESOURCES = ["health", "endurance"];

/** {health, endurance} this item currently contributes to its owner's maxes. */
function itemStatContribution(itemLike) {
  const sys = itemLike?.system ?? {};
  let mod = null;
  if (itemLike?.type === "armor") mod = (sys.equipped ?? true) ? sys.modifier : null;
  else if (itemLike?.type === "classcard" || itemLike?.type === "imperialclasscard") mod = sys.passive;
  return {
    health: Number(mod?.stats?.health) || 0,
    endurance: Number(mod?.stats?.endurance) || 0
  };
}

function activeAttrPath(actor) {
  const wounded = actor?.type === "hero" && actor.system?.state?.wounded;
  return wounded ? "system.woundedAttributes" : "system.attributes";
}

// One in-flight shift per actor: two rapid changes (equip toggle + a
// modifier edit, say) must read the value the previous shift wrote.
const pendingShifts = new Map();

function shiftResourcesForEquipmentChange(actor, deltas) {
  if (!actor) return Promise.resolve();
  if (!SHIFT_RESOURCES.some((r) => deltas[r])) return Promise.resolve();
  const key = actor.uuid ?? actor.id;
  const run = async () => {
    const attrPath = activeAttrPath(actor);
    // Recompute the effective max from source + current items rather than
    // trusting derived data, which may not have been re-prepared yet when an
    // embedded-document hook fires.
    const fx = equipmentEffectsFor(actor).stats;
    const update = {};
    for (const res of SHIFT_RESOURCES) {
      const delta = deltas[res];
      if (!delta) continue;
      const path = `${attrPath}.${res}`;
      const sourceMax = foundry.utils.getProperty(actor._source, `${path}.max`);
      if (sourceMax === undefined) continue; // no such resource on this actor type
      const max = Math.max(0, (Number(sourceMax) || 0) + (Number(fx[res]) || 0));
      const current = Number(foundry.utils.getProperty(actor, `${path}.value`)) || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      if (next !== current) update[`${path}.value`] = next;
    }
    if (!Object.keys(update).length) return;
    try {
      await actor.update(update);
    } catch (error) {
      console.warn("SWIA | Could not shift resources for equipment change", error);
    }
  };
  const chained = (pendingShifts.get(key) ?? Promise.resolve()).then(run, run);
  pendingShifts.set(key, chained);
  chained.finally(() => {
    if (pendingShifts.get(key) === chained) pendingShifts.delete(key);
  });
  return chained;
}

const STAT_ITEM_TYPES = ["armor", "classcard", "imperialclasscard"];

function isOwnStatItemChange(item, userId) {
  return STAT_ITEM_TYPES.includes(item?.type)
    && item.parent?.documentName === "Actor"
    && userId === game.user?.id;
}

function diffContribution(after, before) {
  return Object.fromEntries(SHIFT_RESOURCES.map((r) => [r, (after?.[r] ?? 0) - (before?.[r] ?? 0)]));
}

// Flipping the activation token to "activated" IS the end of that figure's
// activation, so Weakened-style conditions come off then. Runs only on the
// client that made the change, so it fires once.
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (userId !== game.user?.id) return;
  if (foundry.utils.getProperty(changes, "system.state.activated") !== true) return;
  if (!hasEndOfActivationConditions(actor)) return;
  endActivation(actor).catch((err) => console.warn("SWIA | end-of-activation discard failed", err));
});

/**
 * The Imperial deck (world imperialclasscard items) feeds every villain's
 * derived data and card offers. Actors only re-prepare on their own
 * updates, so a deck change resets each villain (and any open sheet) here.
 */
function refreshImperialFigures() {
  const actors = (game.actors?.contents ?? []).filter((a) => a.type === "villain");
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor?.type === "villain" && !token.document?.actorLink) actors.push(token.actor);
  }
  for (const actor of actors) {
    try { actor.reset(); } catch (err) { /* synthetic actors without a reset are re-prepared on access */ }
    if (actor.sheet?.rendered) actor.sheet.render(false);
  }
}

for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, (item) => {
    if (item?.type !== "imperialclasscard" || item.parent?.documentName === "Actor") return;
    refreshImperialFigures();
  });
}

Hooks.on("preUpdateItem", (item, changes, options) => {
  if (!STAT_ITEM_TYPES.includes(item?.type) || item.parent?.documentName !== "Actor") return;
  const touches = foundry.utils.hasProperty(changes, "system.equipped")
    || foundry.utils.hasProperty(changes, "system.modifier")
    || foundry.utils.hasProperty(changes, "system.passive");
  if (!touches) return;
  // Stash the pre-change contribution; updateItem only sees the new state.
  // `options` is shared by every item in a batched updateEmbeddedDocuments,
  // so key it by item id or a batch would read one item's value for all.
  options.swiaStatBefore = {
    ...(options.swiaStatBefore ?? {}),
    [item.id]: itemStatContribution(item)
  };
});

Hooks.on("updateItem", (item, changes, options, userId) => {
  if (!isOwnStatItemChange(item, userId)) return;
  const before = options?.swiaStatBefore?.[item.id];
  if (before === undefined) return;
  shiftResourcesForEquipmentChange(item.parent, diffContribution(itemStatContribution(item), before));
});

Hooks.on("createItem", (item, options, userId) => {
  if (!isOwnStatItemChange(item, userId)) return;
  shiftResourcesForEquipmentChange(item.parent, itemStatContribution(item));
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (!isOwnStatItemChange(item, userId)) return;
  shiftResourcesForEquipmentChange(item.parent, diffContribution({}, itemStatContribution(item)));
});
