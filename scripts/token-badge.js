// Power tokens on the map token.
//
// Power tokens are status effects, one per token so they stack. Foundry's
// stock rendering draws every effect as a 20px icon in the token's status
// strip, so three Block tokens are three identical icons — unreadable past a
// couple. This module hides power tokens from that strip and draws a compact
// badge instead: one icon per type held, with a count.

import { countPowerTokens, POWER_TOKEN_TYPES, POWER_TOKEN_STATUS } from "./actor-actions.js";

const BADGE_NAME = "swiaPowerTokenBadge";
const TOKEN_ICONS = Object.fromEntries(
  POWER_TOKEN_TYPES.map((type) => [type, `systems/swia/icons/Power ${type.charAt(0).toUpperCase()}${type.slice(1)} Token.png`])
);

function isPowerTokenEffect(effect) {
  const statuses = effect?.statuses;
  if (!statuses?.has) return false;
  return POWER_TOKEN_TYPES.some((type) => statuses.has(POWER_TOKEN_STATUS[type]));
}

/**
 * Actor subclass whose temporary effects exclude power tokens, so the stock
 * status strip never draws them. Everything else (actor.statuses, the token
 * HUD toggles, the effects themselves) is untouched.
 */
export function definePowerTokenActorClass() {
  const Base = CONFIG.Actor.documentClass;
  if (Base?.name === "SWIAActor") return Base;
  class SWIAActor extends Base {
    get temporaryEffects() {
      return super.temporaryEffects.filter((effect) => !isPowerTokenEffect(effect));
    }
  }
  CONFIG.Actor.documentClass = SWIAActor;
  return SWIAActor;
}

/* ------------------------------------------------------------------ */
/* Badge drawing                                                       */
/* ------------------------------------------------------------------ */
//
// The token art is black-on-transparent (the physical tokens are black
// discs), so it vanishes on a dark plate. The badge is therefore drawn like
// the tabletop: black tokens on a light parchment plate, each with a dark
// count bubble on its corner. Sizing follows the grid so the badge stays
// legible on larger maps, and it wraps to extra rows rather than spilling
// past the token when a figure holds many types.

const PLATE_FILL = 0xf3ead8;
const PLATE_ALPHA = 0.92;
const PLATE_BORDER = 0x3a2a14;
const COUNT_FILL = 0x1f1f1f;
const COUNT_BORDER = 0xf3ead8;

/**
 * Icon size follows the grid, then shrinks (to a floor) so every held type
 * fits on ONE row inside the token — a figure rarely holds more than two
 * types, and a badge that swallows half the art is worse than small icons.
 */
function badgeMetrics(tokenWidth, count) {
  const grid = canvas?.grid?.size ?? 100;
  const base = Math.round(Math.max(20, Math.min(30, grid * 0.24)));
  const gap = Math.round(base * 0.18);
  const pad = Math.round(base * 0.16);
  const avail = tokenWidth - 4 - pad * 2;
  const fit = Math.floor((avail + gap) / Math.max(1, count)) - gap;
  const icon = Math.max(16, Math.min(base, fit));
  return {
    icon,
    gap,
    pad,
    bubble: Math.round(icon * 0.42),
    font: Math.max(9, Math.round(icon * 0.5))
  };
}

function countStyle(fontSize) {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontSize = fontSize;
  style.fontWeight = "bold";
  style.fill = "#ffffff";
  style.stroke = "#000000";
  style.strokeThickness = 2;
  return style;
}

function ensureBadge(token) {
  let badge = token.children?.find?.((c) => c.name === BADGE_NAME) ?? null;
  if (badge) return badge;
  badge = new PIXI.Container();
  badge.name = BADGE_NAME;
  badge.eventMode = "none";
  token.addChild(badge);
  return badge;
}

/** Rebuild the badge contents from the actor's current tokens. */
export function refreshPowerTokenBadge(token) {
  if (!token || token.destroyed || !token.actor) return;
  const badge = ensureBadge(token);
  badge.removeChildren().forEach((child) => child.destroy({ children: true }));

  const counts = countPowerTokens(token.actor);
  const held = POWER_TOKEN_TYPES.filter((type) => counts[type] > 0);
  badge.visible = held.length > 0;
  if (!held.length) return;

  const grid = canvas?.grid?.size ?? 100;
  const tokenWidth = (token.document?.width ?? 1) * grid;
  const m = badgeMetrics(tokenWidth, held.length);
  const cell = m.icon + m.gap;
  const perRow = Math.max(1, Math.min(held.length, Math.floor((tokenWidth - 4 - m.pad * 2 + m.gap) / cell)));
  const rows = Math.ceil(held.length / perRow);
  const width = m.pad * 2 + perRow * cell - m.gap;
  const height = m.pad * 2 + rows * cell - m.gap;

  const plate = new PIXI.Graphics();
  plate.lineStyle(1, PLATE_BORDER, 0.8)
    .beginFill(PLATE_FILL, PLATE_ALPHA)
    .drawRoundedRect(0, 0, width, height, Math.round(m.icon * 0.3))
    .endFill();
  badge.addChild(plate);

  held.forEach((type, index) => {
    const col = index % perRow;
    const row = Math.floor(index / perRow);
    const x = m.pad + col * cell;
    const y = m.pad + row * cell;

    const sprite = new PIXI.Sprite(PIXI.Texture.from(TOKEN_ICONS[type]));
    sprite.width = m.icon;
    sprite.height = m.icon;
    sprite.x = x;
    sprite.y = y;
    badge.addChild(sprite);

    // Count bubble on the token's lower-right corner
    const r = m.bubble / 2;
    const cx = x + m.icon - r + 1;
    const cy = y + m.icon - r + 1;
    const bubble = new PIXI.Graphics();
    bubble.lineStyle(1, COUNT_BORDER, 1).beginFill(COUNT_FILL, 1).drawCircle(cx, cy, r).endFill();
    badge.addChild(bubble);

    const label = new PIXI.Text(String(counts[type]), countStyle(m.font));
    label.anchor.set(0.5, 0.5);
    label.x = cx;
    label.y = cy + 0.5;
    badge.addChild(label);
  });

  positionPowerTokenBadge(token);
}

/** Bottom-left corner, inside the token's bounds; re-run on size changes. */
export function positionPowerTokenBadge(token) {
  const badge = token?.children?.find?.((c) => c.name === BADGE_NAME);
  if (!badge || !badge.visible) return;
  const bounds = badge.getLocalBounds();
  // Size from the document, never from the PIXI container (which would
  // include the badge itself).
  const grid = canvas?.grid?.size ?? 100;
  const tokenHeight = (token.document?.height ?? 1) * grid;
  badge.x = 2;
  badge.y = Math.max(0, tokenHeight - bounds.height - 2);
}

function refreshActorTokens(actor) {
  if (!actor || !canvas?.ready) return;
  // linked=false: a token granted on a BASE actor is inherited by its
  // unlinked placeables too, and their badges must repaint as well.
  for (const token of actor.getActiveTokens?.(false, false) ?? []) {
    refreshPowerTokenBadge(token);
  }
}

export function registerPowerTokenBadgeHooks() {
  Hooks.on("drawToken", (token) => refreshPowerTokenBadge(token));
  Hooks.on("refreshToken", (token) => positionPowerTokenBadge(token));
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hook, (effect) => {
      if (!isPowerTokenEffect(effect)) return;
      const parent = effect?.parent;
      if (parent?.documentName === "Actor") refreshActorTokens(parent);
    });
  }
}
