// Shared actor/item mutations used by BOTH the actor sheet and the player
// portal. Keeping them here means the two surfaces can never drift: a health
// stepper, a state pill or a Ready All button behaves identically wherever it
// is clicked.

import { escapeHTML } from "./data/common.js";

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
 * Healthy token art. Deliberately prefers actor.img over the prototype token:
 * wounding OVERWRITES prototypeToken.texture.src with the wounded art, so by
 * the time we heal, the prototype no longer remembers the healthy image.
 * actor.img is the one field the wound cycle never touches.
 *
 * Known limitation: a GM who set distinct token art (different from the
 * portrait) loses it on the first wound/heal cycle. The real fix is a stored
 * system.healthyTokenImage captured before the first wound — see BACKLOG.md.
 * Do NOT "fix" this by reading prototypeToken first; that makes healing
 * restore the wounded art.
 */
export function getHealthyTokenSrc(actor) {
  return actor?.img || actor?.prototypeToken?.texture?.src || "";
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
/* Items                                                               */
/* ------------------------------------------------------------------ */

/** Flip an armor item's equipped flag (feeds buildDefensePool). */
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
