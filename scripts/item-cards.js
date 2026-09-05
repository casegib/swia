// Presenting an item's card to a human: the floating hover preview and the
// send-to-chat card. Shared by the actor sheet and the player portal so both
// surfaces show the same thing.
//
// `item.img` IS the card scan in this system — the item sheets render it
// full-size with pan/zoom — so no separate field is needed. Items without a
// real scan fall back to a generated text card.

import { sanitizeLabelHTML, sanitizeRichHTML, modifierChips } from "./data/common.js";

const PREVIEW_CLASS = "swia-portal-card-preview";
const PREVIEW_DELAY_MS = 120;
const CHAT_TEMPLATE = "systems/swia/templates/items/item-chat-card.hbs";

/* ------------------------------------------------------------------ */
/* Hover preview                                                       */
/* ------------------------------------------------------------------ */

/**
 * One floating preview element for the whole client. It lives on <body> so it
 * can escape any sheet/app overflow, and is reused by every surface.
 */
class CardPreview {
  constructor() {
    this.element = null;
    this.delayHandle = null;
    this.pending = null;
  }

  _ensureElement() {
    if (this.element) return this.element;
    const wrapper = document.createElement("div");
    wrapper.className = PREVIEW_CLASS;
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "eager";
    wrapper.appendChild(image);
    document.body.appendChild(wrapper);
    this.element = wrapper;
    return wrapper;
  }

  destroy() {
    this.hide();
    this.element?.remove();
    this.element = null;
  }

  _pointer(event) {
    const base = event?.originalEvent ?? event;
    const touch = base?.touches?.[0] ?? base?.changedTouches?.[0] ?? null;
    return { clientX: touch?.clientX ?? base?.clientX, clientY: touch?.clientY ?? base?.clientY };
  }

  /** Keep the card on screen: flip to the other side / clamp at the edges. */
  _position(clientX, clientY) {
    const preview = this.element;
    if (!preview) return;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    const offset = 18;
    const rect = preview.getBoundingClientRect();
    const width = rect.width || 280;
    const height = rect.height || 410;

    let left = clientX + offset;
    let top = clientY + offset;
    if (left + width > window.innerWidth - 8) left = clientX - width - offset;
    if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
  }

  show(event) {
    const target = event.currentTarget;
    // The preview source is the element's own art: an <img> inside the trigger,
    // or a data-preview-src for triggers that render no image of their own.
    const image = target?.querySelector?.("img");
    const src = target?.dataset?.previewSrc || image?.getAttribute("src");
    if (!src) return;

    const { clientX, clientY } = this._pointer(event);
    const rect = target?.getBoundingClientRect?.();
    this.pending = {
      src,
      alt: image?.getAttribute("alt") || target?.getAttribute("title") || "",
      clientX: Number.isFinite(clientX) ? clientX : (rect ? rect.left + rect.width / 2 : undefined),
      clientY: Number.isFinite(clientY) ? clientY : (rect ? rect.top + rect.height / 2 : undefined)
    };

    if (this.delayHandle) clearTimeout(this.delayHandle);
    this.delayHandle = setTimeout(() => {
      this.delayHandle = null;
      const pending = this.pending;
      if (!pending?.src) return;
      const preview = this._ensureElement();
      const img = preview.querySelector("img");
      if (!img) return;
      img.src = pending.src;
      img.alt = pending.alt;
      preview.classList.add("is-visible");
      if (Number.isFinite(pending.clientX) && Number.isFinite(pending.clientY)) {
        this._position(pending.clientX, pending.clientY);
      }
    }, PREVIEW_DELAY_MS);
  }

  move(event) {
    const { clientX, clientY } = this._pointer(event);
    if (this.pending) {
      this.pending.clientX = clientX;
      this.pending.clientY = clientY;
    }
    if (!this.element?.classList.contains("is-visible")) return;
    this._position(clientX, clientY);
  }

  hide() {
    if (this.delayHandle) {
      clearTimeout(this.delayHandle);
      this.delayHandle = null;
    }
    this.pending = null;
    this.element?.classList.remove("is-visible");
    const img = this.element?.querySelector("img");
    if (img) img.removeAttribute("src");
  }
}

const preview = new CardPreview();

/**
 * Bind hover previews to every `selector` inside `root`.
 * Pass an AbortSignal so the caller can drop the listeners on re-render.
 * Returns nothing; call hideCardPreview() on close.
 */
export function bindCardPreviews(root, { selector = ".swia-card-preview-trigger", signal } = {}) {
  if (!root?.querySelectorAll) return;
  for (const el of root.querySelectorAll(selector)) {
    el.addEventListener("mouseenter", (e) => preview.show(e), { signal });
    el.addEventListener("focusin", (e) => preview.show(e), { signal });
    el.addEventListener("mousemove", (e) => preview.move(e), { signal });
    el.addEventListener("mouseleave", () => preview.hide(), { signal });
    el.addEventListener("focusout", () => preview.hide(), { signal });
  }
  // Any scrolling container should drop the preview rather than leave it
  // floating over unrelated content.
  for (const scroller of root.querySelectorAll(".portal-drop-zone, .collapsible-content, .item-list")) {
    scroller.addEventListener("scroll", () => preview.hide(), { signal });
  }
}

export function hideCardPreview() {
  preview.hide();
}

export function destroyCardPreview() {
  preview.destroy();
}

/* ------------------------------------------------------------------ */
/* Send to chat                                                        */
/* ------------------------------------------------------------------ */

/**
 * Does this item have real card art, or just a Foundry placeholder? Defaults
 * live under icons/svg/, and a blank img means nothing was ever set.
 */
export function hasCardArt(item) {
  const img = item?.img ?? "";
  if (!img) return false;
  return !img.startsWith("icons/svg/") && !img.includes("mystery-man");
}

const DICE_COLORS = ["red", "blue", "green", "yellow"];

/** Build the text-card context for an item with no scan. */
function textCardContext(item) {
  const sys = item.system ?? {};
  const attack = sys.attackDice ?? sys.bonusDice ?? {};
  const attackDice = DICE_COLORS.flatMap((color) =>
    Array.from({ length: Math.max(0, Number(attack[color]) || 0) }, () => color)
  );

  const kw = sys.keywords ?? {};
  const keywords = [];
  if (kw.pierce > 0) keywords.push(`${game.i18n.localize("SWIA.Keywords.Pierce")} ${kw.pierce}`);
  if (kw.blast > 0) keywords.push(`${game.i18n.localize("SWIA.Keywords.Blast")} ${kw.blast}`);
  if (kw.cleave) keywords.push(game.i18n.localize("SWIA.Keywords.Cleave"));
  if (kw.reach) keywords.push(game.i18n.localize("SWIA.Keywords.Reach"));

  const surgeRaw = sys.surgeAbilities;
  const surges = (Array.isArray(surgeRaw) ? surgeRaw : Object.values(surgeRaw ?? {})).map((entry) => {
    const value = Number(entry?.effectValue) || 0;
    const text = (entry?.effectText ?? "").trim();
    let base = "";
    if (entry?.effectType === "damage") base = `+${value} ${game.i18n.localize("SWIA.Dice.Damage")}`;
    else if (entry?.effectType === "accuracy") base = `+${value} ${game.i18n.localize("SWIA.Dice.Accuracy")}`;
    else if (entry?.effectType === "pierce") base = `${game.i18n.localize("SWIA.Keywords.Pierce")} ${value}`;
    const label = base ? (text ? `${base}, ${text}` : base) : text;
    return {
      cost: Math.max(1, Number(entry?.cost) || 1),
      label: sanitizeLabelHTML(label || game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Special")),
      exhausts: Boolean(entry?.exhaustToUse)
    };
  });

  // Armor stores its weight class as a lowercase key; everything else in the
  // subtitle is already display text.
  const armorClassLabel = item.type === "armor" && sys.armorClass
    ? game.i18n.localize(`SWIA.Item.Armor.ArmorClass.${sys.armorClass.charAt(0).toUpperCase()}${sys.armorClass.slice(1)}`)
    : "";
  const subtypeParts = [sys.traits, sys.weaponClass, sys.weaponSubtype, armorClassLabel, sys.accessorySubtype, sys.modSubtype]
    .filter((p) => typeof p === "string" && p.trim());

  // Printed ability rows (weapons and armor). They live outside `description`,
  // so a card whose mechanics moved there would otherwise post empty. Left raw
  // here; postItemCard enriches them the same way it enriches the description.
  const abilityRaw = sys.abilities;
  const rawAbilities = (Array.isArray(abilityRaw) ? abilityRaw : Object.values(abilityRaw ?? {}))
    .map((entry) => (entry?.description ?? "").trim())
    .filter(Boolean);

  const state = sys.cardState || "ready";
  return {
    subtitle: subtypeParts.join(" – "),
    rawAbilities,
    modifierChips: modifierChips(sys.modifier ?? sys.passive),
    attackDice,
    hasDice: attackDice.length > 0,
    damage: Number(sys.damage ?? sys.bonusDamage) || 0,
    accuracy: Number(sys.accuracy ?? sys.bonusAccuracy) || 0,
    keywords,
    surges,
    state,
    stateLabel: game.i18n.localize(`SWIA.Item.CardState.${state.charAt(0).toUpperCase()}${state.slice(1)}`),
    equipped: item.type === "armor" ? (sys.equipped ?? true) : null,
    rawDescription: sys.abilityText || sys.description || ""
  };
}

/**
 * Post an item's card to chat: the uploaded scan when there is one, otherwise
 * a generated card built from the item's own data.
 */
export async function postItemCard(item, actor = null) {
  if (!item) return null;
  const withArt = hasCardArt(item);
  const context = {
    name: item.name,
    img: item.img,
    ownerName: actor?.name ?? item.parent?.name ?? "",
    withArt,
    ...(withArt ? {} : textCardContext(item))
  };

  // Descriptions and ability lines are enriched like everywhere else (@UUID
  // links, inline rolls) and then scrubbed: unlike a sheet, a chat card is
  // persisted and rendered on every connected client, so raw item HTML must
  // not ride along.
  if (!withArt) {
    const TextEditorClass = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const enrich = (text) => TextEditorClass.enrichHTML(text, {
      async: true,
      secrets: false,
      relativeTo: item
    });

    if (context.rawDescription) {
      context.description = sanitizeRichHTML(await enrich(context.rawDescription));
    }
    if (context.rawAbilities?.length) {
      context.abilities = await Promise.all(
        context.rawAbilities.map(async (text) => sanitizeLabelHTML(await enrich(text)))
      );
    }
  }
  delete context.rawDescription;
  delete context.rawAbilities;

  const renderTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  const content = await renderTemplate(CHAT_TEMPLATE, context);
  // Only speak as an actor this user actually controls; otherwise post
  // unattributed rather than spoofing another player's figure.
  const candidate = actor ?? item.parent ?? null;
  const maySpeak = candidate && (game.user?.isGM || candidate.isOwner);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker(maySpeak ? { actor: candidate } : {}),
    content
  });
}

/**
 * Resolve the item behind a clicked control and post it. Shared by the sheet
 * and the portal, both of which mark rows with data-item-id.
 */
export async function postItemCardFromElement(actor, target) {
  const itemId = target?.dataset?.itemId ?? target?.closest?.("[data-item-id]")?.dataset?.itemId;
  const item = itemId ? actor?.items?.get(itemId) : null;
  if (!item) return null;
  return postItemCard(item, actor);
}
