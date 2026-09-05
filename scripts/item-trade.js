// "Give to…" — move an item from one hero to another between missions.
// Players usually own only their own hero, so a give that lands on someone
// else's sheet relays to the active GM over the system socket (same pattern
// as roll-card actions and combat intents).

import { SOCKET_NAME } from "./dice/roll-dialog.js";
import { escapeHTML } from "./data/common.js";

/** Item types that change hands. Class cards are a hero's own and stay put. */
export const TRADABLE_ITEM_TYPES = ["weapon", "armor", "gear", "weaponmod"];

/** Heroes an item could go to (everyone but the source). */
export function giveTargetsFor(sourceActor) {
  return (game.actors?.contents ?? [])
    .filter((a) => a.type === "hero" && a.id !== sourceActor?.id)
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: "base" }));
}

/**
 * Move `item` from its owner to `target`. A weapon takes its attached mods
 * along (re-pointed at the new weapon id); a lone mod arrives detached;
 * armor arrives unequipped so the receiver's max health doesn't jump
 * unasked. Runs on a client allowed to write both actors (owner of both, or
 * the GM); callers without that permission use requestGive.
 */
export async function transferItem(item, target) {
  const source = item?.parent;
  if (!source || !target || source.id === target.id) return false;
  if (!TRADABLE_ITEM_TYPES.includes(item.type)) return false;

  const data = item.toObject();
  delete data._id;
  const toDelete = [item.id];
  if (item.type === "weaponmod") data.system.attachedWeaponId = "";
  if (item.type === "armor") data.system.equipped = false;

  const [created] = await target.createEmbeddedDocuments("Item", [data]);
  if (item.type === "weapon" && created) {
    const mods = source.items.filter((m) => m.type === "weaponmod" && m.system?.attachedWeaponId === item.id);
    if (mods.length) {
      const modData = mods.map((m) => {
        const d = m.toObject();
        delete d._id;
        d.system.attachedWeaponId = created.id;
        return d;
      });
      await target.createEmbeddedDocuments("Item", modData);
      toDelete.push(...mods.map((m) => m.id));
    }
  }
  await source.deleteEmbeddedDocuments("Item", toDelete);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: source }),
    content: `<p class="swia-give-notice">${game.i18n.format("SWIA.Give.Notice", {
      source: escapeHTML(source.name), item: escapeHTML(item.name), target: escapeHTML(target.name)
    })}</p>`
  });
  return true;
}

/** Give from a client that may not own the target: run locally when allowed, else relay to the GM. */
export async function requestGive(item, target) {
  const source = item?.parent;
  if (!source || !target) return;
  const canWriteBoth = game.user?.isGM || (source.isOwner && target.isOwner);
  if (canWriteBoth) return transferItem(item, target);
  if (!source.isOwner) return;
  const gm = game.users?.activeGM;
  if (!gm) {
    ui.notifications?.warn(game.i18n.localize("SWIA.Give.NoGM"));
    return;
  }
  game.socket?.emit(SOCKET_NAME, {
    type: "giveItem", sourceActorId: source.id, itemId: item.id, targetActorId: target.id, userId: game.user.id
  });
  ui.notifications?.info(game.i18n.format("SWIA.Give.Relayed", { item: item.name, target: target.name }));
}

/** Pick a hero and give. Opened from the sheet's per-row button. */
export async function promptGive(item) {
  const source = item?.parent;
  if (!source || !TRADABLE_ITEM_TYPES.includes(item.type)) return;
  const targets = giveTargetsFor(source);
  if (!targets.length) {
    ui.notifications?.warn(game.i18n.localize("SWIA.Give.NoTargets"));
    return;
  }
  const options = targets.map((a, i) => `<option value="${a.id}"${i === 0 ? " selected" : ""}>${escapeHTML(a.name)}</option>`).join("");
  const modCount = item.type === "weapon"
    ? source.items.filter((m) => m.type === "weaponmod" && m.system?.attachedWeaponId === item.id).length
    : 0;
  const hint = modCount ? `<p class="hint">${game.i18n.format("SWIA.Give.ModsFollow", { count: modCount })}</p>` : "";
  const content = `
    <p>${game.i18n.format("SWIA.Give.Prompt", { item: escapeHTML(item.name) })}</p>
    <div class="form-group"><select name="swiaGiveTarget" style="width: 100%;">${options}</select></div>${hint}`;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("SWIA.Give.Title"), icon: "fas fa-hand-holding" },
    content,
    buttons: [
      { action: "give", label: game.i18n.localize("SWIA.Give.Confirm"), icon: "fas fa-hand-holding", default: true,
        callback: (event, button) => button.form.elements.swiaGiveTarget.value },
      { action: "cancel", label: game.i18n.localize("SWIA.Give.Cancel"), icon: "fas fa-times" }
    ],
    rejectClose: false
  });
  if (!choice || choice === "cancel") return;
  const target = game.actors?.get(choice);
  if (!target) return;
  await requestGive(item, target);
}

/** GM-side socket handler. The claimed user must own the source actor. */
function onSocketMessage(data) {
  if (data?.type !== "giveItem") return;
  if (game.user !== game.users?.activeGM) return;
  const user = game.users?.get(data.userId);
  if (!user || user.isGM) return;
  const source = game.actors?.get(data.sourceActorId);
  const target = game.actors?.get(data.targetActorId);
  const item = source?.items?.get(data.itemId);
  if (!source || !target || !item) return;
  if (!source.testUserPermission(user, "OWNER")) return;
  if (target.type !== "hero") return;
  transferItem(item, target).catch((err) => console.error("SWIA | relayed give failed", err));
}

export function registerItemTradeHooks() {
  Hooks.once("ready", () => {
    game.socket?.on?.(SOCKET_NAME, onSocketMessage);
  });
}
