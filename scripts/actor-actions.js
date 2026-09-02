// Shared actor/item mutations used by BOTH the actor sheet and the player
// portal. Keeping them here means the two surfaces can never drift: a health
// stepper, a state pill or a Ready All button behaves identically wherever it
// is clicked.

import { escapeHTML, armorEffectsFor } from "./data/common.js";
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
/* Armor health: keep damage-taken constant when the max moves         */
/* ------------------------------------------------------------------ */

/**
 * The system stores REMAINING health, but Imperial Assault tracks DAMAGE.
 * When equipped armor changes the max (equip/unequip, edit, add, remove), the
 * remaining value shifts by the same amount so the damage on the figure stays
 * put: 10/12 wearing +2 armor is 12/14, not 10/14. Runs once, on the client
 * that made the item change (it necessarily owns the actor).
 */
function armorHealthContribution(itemLike) {
  const sys = itemLike?.system ?? {};
  if (!(sys.equipped ?? true)) return 0;
  return Math.max(0, Number(sys.bonusHealth) || 0);
}

function activeHealthPath(actor) {
  const wounded = actor?.type === "hero" && actor.system?.state?.wounded;
  return wounded ? "system.woundedAttributes.health" : "system.attributes.health";
}

// One in-flight shift per actor: two rapid changes (equip toggle + a
// bonusHealth edit, say) must read the value the previous shift wrote.
const pendingShifts = new Map();

function shiftHealthForArmorChange(actor, delta) {
  if (!actor || !delta) return Promise.resolve();
  const key = actor.uuid ?? actor.id;
  const run = async () => {
    const path = activeHealthPath(actor);
    // Recompute the effective max from source + current items rather than
    // trusting derived data, which may not have been re-prepared yet when an
    // embedded-document hook fires.
    const sourceMax = Number(foundry.utils.getProperty(actor._source, `${path}.max`)) || 0;
    const max = sourceMax + (armorEffectsFor(actor).health || 0);
    const current = Number(foundry.utils.getProperty(actor, `${path}.value`)) || 0;
    const next = Math.max(0, Math.min(max, current + delta));
    if (next === current) return;
    try {
      await actor.update({ [`${path}.value`]: next });
    } catch (error) {
      console.warn("SWIA | Could not shift health for armor change", error);
    }
  };
  const chained = (pendingShifts.get(key) ?? Promise.resolve()).then(run, run);
  pendingShifts.set(key, chained);
  chained.finally(() => {
    if (pendingShifts.get(key) === chained) pendingShifts.delete(key);
  });
  return chained;
}

function isOwnArmorChange(item, userId) {
  return item?.type === "armor"
    && item.parent?.documentName === "Actor"
    && userId === game.user?.id;
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

Hooks.on("preUpdateItem", (item, changes, options) => {
  if (item?.type !== "armor" || item.parent?.documentName !== "Actor") return;
  const touchesHealth = foundry.utils.hasProperty(changes, "system.equipped")
    || foundry.utils.hasProperty(changes, "system.bonusHealth");
  if (!touchesHealth) return;
  // Stash the pre-change contribution; updateItem only sees the new state.
  // `options` is shared by every item in a batched updateEmbeddedDocuments,
  // so key it by item id or a batch would read one item's value for all.
  options.swiaArmorHealthBefore = {
    ...(options.swiaArmorHealthBefore ?? {}),
    [item.id]: armorHealthContribution(item)
  };
});

Hooks.on("updateItem", (item, changes, options, userId) => {
  if (!isOwnArmorChange(item, userId)) return;
  const before = options?.swiaArmorHealthBefore?.[item.id];
  if (before === undefined) return;
  const delta = armorHealthContribution(item) - before;
  if (delta) shiftHealthForArmorChange(item.parent, delta);
});

Hooks.on("createItem", (item, options, userId) => {
  if (!isOwnArmorChange(item, userId)) return;
  const delta = armorHealthContribution(item);
  if (delta) shiftHealthForArmorChange(item.parent, delta);
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (!isOwnArmorChange(item, userId)) return;
  const delta = -armorHealthContribution(item);
  if (delta) shiftHealthForArmorChange(item.parent, delta);
});
