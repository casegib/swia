// Live stat card on token hover.
//
// Resting the pointer on a map token for a moment shows a card with what the
// printed card would show — hero sheet (active side) or deployment card —
// read live from the hovered token's own actor, so an unlinked Imperial
// figure shows its own health. Conditions, power tokens and activation sit
// in the footer. Everyone sees every visible figure (open information).
//
// The card is one fixed element on <body>, pointer-events: none, so it never
// steals the hover from the token underneath it. Touch devices are skipped.

import {
  sanitizeRichHTML, sanitizeLabelHTML, parseKeywordLine, toArray,
  ATTACK_DIE_COLORS, DEFENSE_DIE_COLORS
} from "./data/common.js";
import { actorConditions, conditionLabel } from "./conditions.js";
import { powerTokenRows } from "./actor-actions.js";

export const HOVER_CARD_TEMPLATE = "systems/swia/templates/actors/token-hover-card.hbs";
const SETTING_KEY = "tokenHoverCard";
const SHOW_DELAY_MS = 350;
const CARD_CLASS = "swia-token-card";

const renderTemplateFn = foundry.applications.handlebars.renderTemplate;

/* ------------------------------------------------------------------ */
/* Card data                                                           */
/* ------------------------------------------------------------------ */

function diceList(pool, colors) {
  const out = [];
  for (const color of colors) {
    const n = Math.max(0, Number(pool?.[color]) || 0);
    for (let i = 0; i < n; i += 1) out.push(color);
  }
  return out;
}

function resource(res) {
  const value = Math.max(0, Number(res?.value) || 0);
  const max = Math.max(0, Number(res?.max) || 0);
  return { value, max, pct: max ? Math.min(100, Math.round((100 * value) / max)) : 0 };
}

function abilityRows(list) {
  return toArray(list)
    .filter((a) => (a?.name ?? "").trim() || (a?.description ?? "").trim())
    // Names can carry an icon (an action glyph before "Executive Order"),
    // so they go through the label sanitizer and render as HTML.
    .map((a) => ({ name: sanitizeLabelHTML((a.name ?? "").trim()), html: sanitizeRichHTML(a.description ?? "") }));
}

/**
 * Surge text is often stored with its own cost prefix, with or without a
 * colon ("<surge img>: +1<dmg>", "<surge img> +2 Accuracy"), as typed on the
 * sheet or carried over from older data. The card prints the cost itself, so
 * drop the prefix and keep its icon count.
 */
const LEADING_SURGE = /^\s*((?:<img[^>]*surge[^>]*>\s*)+):?\s*/i;
function stripSurgePrefix(text) {
  const raw = String(text ?? "");
  const match = LEADING_SURGE.exec(raw);
  if (!match) return { text: raw, cost: 0 };
  return { text: raw.slice(match[0].length), cost: (match[1].match(/<img/gi) ?? []).length };
}

/** Surge rows for a unit or form card: printed surges plus surge-cost special abilities. */
function surgeRows(surges, specials) {
  const rows = toArray(surges).map((s) => {
    const { text, cost } = stripSurgePrefix(s?.effectText);
    return {
      cost: Math.max(1, Number(s?.cost) || 1, cost),
      html: sanitizeRichHTML(text)
    };
  });
  for (const a of toArray(specials)) {
    const cost = Number(a?.surgeCost) || 0;
    if (!cost) continue;
    const name = sanitizeLabelHTML((a.name ?? "").trim());
    rows.push({ cost, html: `${name ? `<strong>${name}:</strong> ` : ""}${sanitizeRichHTML(a.description ?? "")}` });
  }
  for (const row of rows) row.surges = Array.from({ length: row.cost });
  return rows;
}

/** Zero-cost specials split into the printed keyword line(s) and the rest. */
function splitSpecials(specials) {
  const keywords = [];
  const abilities = [];
  for (const a of toArray(specials)) {
    if ((Number(a?.surgeCost) || 0) > 0) continue;
    if (!(a?.name ?? "").trim() && parseKeywordLine(a?.description)) {
      keywords.push(sanitizeRichHTML(a.description));
      continue;
    }
    const [row] = abilityRows([a]);
    if (row) abilities.push(row);
  }
  return { keywords, abilities };
}

function liveFooter(actor) {
  const conditions = actorConditions(actor).map((c) => ({ label: conditionLabel(c), img: c.img }));
  const tokens = powerTokenRows(actor);
  return { conditions, tokens, hasFooter: conditions.length > 0 || tokens.length > 0 };
}

function heroContext(actor) {
  const sys = actor.system ?? {};
  const wounded = Boolean(sys.state?.wounded);
  const attrs = sys.activeAttributes ?? (wounded ? sys.woundedAttributes : sys.attributes) ?? {};
  const pools = [
    { key: "strength", icon: "systems/swia/icons/Might.png", label: game.i18n.localize("SWIA.Attributes.Strength") },
    { key: "insight", icon: "systems/swia/icons/Insight.png", label: game.i18n.localize("SWIA.Attributes.Insight") },
    { key: "tech", icon: "systems/swia/icons/Tech.png", label: game.i18n.localize("SWIA.Attributes.Tech") }
  ].map((p) => ({ ...p, dice: diceList(attrs[p.key], ATTACK_DIE_COLORS) }));
  for (const key of ["custom1", "custom2", "custom3"]) {
    const slot = attrs[key];
    if (!slot?.enabled) continue;
    pools.push({
      key,
      icon: slot.icon || "",
      label: slot.label || game.i18n.localize("SWIA.Attributes.CustomSlot"),
      dice: diceList(slot, ATTACK_DIE_COLORS)
    });
  }
  return {
    isHero: true,
    subtitle: sys.title ?? "",
    wounded,
    defeated: wounded && Boolean(sys.state?.defeated),
    health: resource(sys.current?.health ?? attrs.health),
    endurance: resource(sys.current?.endurance ?? attrs.endurance),
    speed: Number(attrs.speed) || 0,
    speedBonus: Number(attrs.speedBonus) || 0,
    defense: diceList(sys.attributes?.defense, DEFENSE_DIE_COLORS),
    pools,
    abilities: abilityRows(wounded ? sys.woundedHeroAbilities : sys.heroAbilities)
  };
}

function unitContext(actor) {
  const sys = actor.system ?? {};
  const attrs = sys.attributes ?? {};
  const own = splitSpecials(sys.specialAbilities);
  const ctx = {
    isUnit: true,
    subtitle: sys.traits ?? "",
    isElite: Boolean(sys.isElite),
    isUnique: Boolean(sys.isUnique),
    groupSize: Number(sys.groupSize) || 0,
    deployCost: Number(sys.deployCost) || 0,
    reinforceCost: Number(sys.reinforceCost) || 0,
    health: resource(sys.current?.health ?? attrs.health),
    speed: Number(attrs.speed) || 0,
    speedBonus: Number(attrs.speedBonus) || 0,
    defense: diceList(attrs.defense, DEFENSE_DIE_COLORS),
    attackMelee: attrs.attackType === "melee",
    attackLabel: game.i18n.localize(attrs.attackType === "melee" ? "SWIA.AttackType.Melee" : "SWIA.AttackType.Ranged"),
    attack: diceList(attrs.attack, ATTACK_DIE_COLORS),
    keywords: own.keywords,
    surges: surgeRows(attrs.surgeAbilities, sys.specialAbilities),
    abilities: own.abilities,
    form: null
  };
  if (actor.type === "villain" && sys.hasShift && sys.activeFormId) {
    const card = actor.items?.get?.(sys.activeFormId);
    if (card) {
      const formSpecials = splitSpecials(card.system?.specialAbilities);
      ctx.form = {
        name: card.name,
        surges: surgeRows(card.system?.surgeAbilities, card.system?.specialAbilities),
        abilities: formSpecials.abilities,
        keywords: formSpecials.keywords
      };
    }
  }
  return ctx;
}

function characterContext(actor) {
  const sys = actor.system ?? {};
  const attrs = sys.attributes ?? {};
  return {
    isCharacter: true,
    subtitle: sys.affiliation ?? "",
    health: resource(sys.current?.health ?? attrs.health),
    speed: Number(attrs.speed) || 0,
    speedBonus: Number(attrs.speedBonus) || 0,
    defense: diceList(attrs.defense, DEFENSE_DIE_COLORS)
  };
}

function objectContext(actor) {
  const sys = actor.system ?? {};
  const attrs = sys.attributes ?? {};
  const health = resource(sys.current?.health ?? attrs.health);
  return {
    isObject: true,
    subtitle: [sys.objectType, sys.traits].filter(Boolean).join(" · "),
    health,
    hasHealth: health.max > 0,
    defense: diceList(attrs.defense, DEFENSE_DIE_COLORS),
    interaction: sys.interactable ? sanitizeRichHTML(sys.interactionText ?? "") : ""
  };
}

/**
 * Everything the card template needs for one actor. `tokenDoc` supplies the
 * art the map shows (wounded art while wounded); the actor is the token's own
 * (synthetic for unlinked tokens).
 */
export function actorCardContext(actor, tokenDoc = null) {
  if (!actor) return null;
  let body;
  switch (actor.type) {
    case "hero": body = heroContext(actor); break;
    case "villain":
    case "ally": body = unitContext(actor); break;
    case "object": body = objectContext(actor); break;
    default: body = characterContext(actor);
  }
  const showHealth = actor.type === "object" ? Boolean(body.hasHealth) : Boolean(body.health);
  return {
    type: actor.type,
    name: actor.name,
    showHealth,
    // Objects without health or defense have nothing for the live block.
    showLive: actor.type !== "object" || showHealth || Boolean(body.defense?.length),
    img: tokenDoc?.texture?.src || actor.img || "",
    activated: Boolean(actor.system?.state?.activated),
    ...body,
    ...liveFooter(actor)
  };
}

/* ------------------------------------------------------------------ */
/* Floating card                                                       */
/* ------------------------------------------------------------------ */

class TokenHoverCard {
  constructor() {
    this.element = null;
    this.token = null;
    this.showHandle = null;
    this.refreshHandle = null;
    this.renderSeq = 0;
    this.pointer = { x: NaN, y: NaN, type: "mouse" };
  }

  get enabled() {
    try {
      return game.settings.get("swia", SETTING_KEY) !== false;
    } catch {
      return true;
    }
  }

  _ensureElement() {
    if (this.element?.isConnected) return this.element;
    const el = document.createElement("div");
    el.className = CARD_CLASS;
    el.setAttribute("role", "tooltip");
    document.body.appendChild(el);
    this.element = el;
    return el;
  }

  trackPointer(event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.pointer.type = event.pointerType || "mouse";
  }

  hover(token, hovered) {
    if (!hovered) {
      if (!token || token === this.token || !this.token) this.hide();
      return;
    }
    if (!this.enabled || this.pointer.type === "touch") return;
    if (!token?.actor || !token.visible) return;
    if (token.document?.hidden && !game.user?.isGM) return;
    this.hide();
    this.token = token;
    this.showHandle = setTimeout(() => {
      this.showHandle = null;
      this.render({ position: true });
    }, SHOW_DELAY_MS);
  }

  async render({ position = false } = {}) {
    const token = this.token;
    if (!token || token.destroyed || !token.actor) return this.hide();
    const seq = ++this.renderSeq;
    const context = actorCardContext(token.actor, token.document);
    let html;
    try {
      html = await renderTemplateFn(HOVER_CARD_TEMPLATE, context);
    } catch (err) {
      console.warn("SWIA | Token hover card failed to render", err);
      return;
    }
    // A newer render or a hide won the race.
    if (seq !== this.renderSeq || this.token !== token) return;
    const el = this._ensureElement();
    el.innerHTML = html;
    el.classList.add("is-visible");
    if (position || !el.style.left) this._position();
  }

  /** Beside the pointer; flip/clamp so the whole card stays on screen. */
  _position() {
    const el = this.element;
    if (!el) return;
    let { x, y } = this.pointer;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      x = window.innerWidth / 2;
      y = window.innerHeight / 3;
    }
    const offset = 18;
    const rect = el.getBoundingClientRect();
    const width = rect.width || 310;
    const height = rect.height || 300;
    let left = x + offset;
    let top = y + offset;
    if (left + width > window.innerWidth - 8) left = x - width - offset;
    if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8;
    left = Math.max(8, left);
    top = Math.max(8, top);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  /** Re-read the actor while the card is up (damage, conditions, tokens). */
  queueRefresh() {
    if (!this.token || !this.element?.classList.contains("is-visible")) return;
    if (this.refreshHandle) clearTimeout(this.refreshHandle);
    this.refreshHandle = setTimeout(() => {
      this.refreshHandle = null;
      this.render();
    }, 60);
  }

  /** True when a document change touches the actor on the card. */
  concerns(actor) {
    const shown = this.token?.actor;
    if (!shown || !actor) return false;
    return actor === shown || actor.uuid === shown.uuid || (shown.isToken ? false : actor.id === shown.id);
  }

  hide() {
    if (this.showHandle) clearTimeout(this.showHandle);
    if (this.refreshHandle) clearTimeout(this.refreshHandle);
    this.showHandle = null;
    this.refreshHandle = null;
    this.renderSeq += 1;
    this.token = null;
    if (this.element) {
      this.element.classList.remove("is-visible");
      this.element.style.left = "";
      this.element.style.top = "";
    }
  }
}

const card = new TokenHoverCard();

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

function registerHooks() {
  window.addEventListener("pointermove", (e) => card.trackPointer(e), { passive: true });
  // Pressing on the canvas starts a drag, a selection or a ruler: get out of the way.
  window.addEventListener("pointerdown", (e) => {
    card.trackPointer(e);
    card.hide();
  }, { passive: true });

  Hooks.on("hoverToken", (token, hovered) => card.hover(token, hovered));
  for (const hook of ["canvasPan", "canvasTearDown", "canvasReady"]) Hooks.on(hook, () => card.hide());
  Hooks.on("deleteToken", (tokenDoc) => {
    if (card.token?.document === tokenDoc || card.token?.document?.id === tokenDoc?.id) card.hide();
  });

  // Live refresh while the card is showing.
  Hooks.on("updateActor", (actor) => { if (card.concerns(actor)) card.queueRefresh(); });
  Hooks.on("updateToken", (tokenDoc) => { if (card.token?.document?.id === tokenDoc?.id) card.queueRefresh(); });
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect", "createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, (doc) => { if (card.concerns(doc?.parent)) card.queueRefresh(); });
  }
}

/** Call during init. */
export function registerTokenHoverCard() {
  game.settings.register("swia", SETTING_KEY, {
    name: "SWIA.Settings.TokenHoverCard.Name",
    hint: "SWIA.Settings.TokenHoverCard.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => { if (!value) card.hide(); }
  });
  registerHooks();
}
