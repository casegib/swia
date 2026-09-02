// Phase 6 — Shared combat window (attacker vs defender).
// State lives in the "swia.activeCombat" world setting; every client re-renders
// via the updateSetting hook (campaign-tracker pattern). All mutations are
// socket intents executed and permission-checked on the active GM's client
// (generalizes the Phase 5 surge-spend relay).

import {
  SOCKET_NAME, CARD_TEMPLATE, renderTemplateFn, clampCount, recomputeCard,
  ATTACK_POOL_COLORS, DEFENSE_POOL_COLORS, heroWeapons, defaultWeaponId,
  buildAttackPool, buildDefensePool, attackKeywordsFor, weaponAccuracyFor,
  armorDefenseBonusFor, gatherSurgeAbilities, setCombatStarter,
  replaceFace, recomputeFaceTotals, rollReplacementDie,
  applySurgeToState, revertSurgeOnState, exhaustSurgeSource, readySurgeSource
} from "./roll-dialog.js";
import { COLOR_TO_DENOM, totalSymbols, rollFaces } from "./dice-terms.js";
import { escapeHTML } from "../data/common.js";
import { countPowerTokens, POWER_TOKEN_STATUS } from "../actor-actions.js";
import { conditionEffectsFor, discardConditions, conditionLabel, getCondition } from "../conditions.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApplication = HandlebarsApplicationMixin(ApplicationV2);

export const ACTIVE_COMBAT_KEY = "activeCombat";
const WINDOW_TEMPLATE = "systems/swia/templates/dice/combat-window.hbs";

/**
 * Which power tokens each side can declare, and the bonus stat each feeds.
 * Tokens are spent BEFORE that side rolls (attacker: during setup; defender:
 * until its defense roll), matching the table rule that they are declared
 * when attacking/defending. An "any" token converts to one of the side's
 * stats at spend time.
 */
const SIDE_TOKEN_STATS = {
  attacker: ["damage", "surge"],
  defender: ["block", "evade"]
};
const SIDE_BONUS_STATS = {
  attacker: ["damage", "surge", "accuracy"],
  defender: ["block", "evade"]
};

/** Is `side` still inside its declaration window? */
function inDeclareWindow(combat, side) {
  if (!combat) return false;
  if (side === "attacker") return combat.phase === "setup";
  return combat.phase === "setup" || combat.phase === "attackRolled";
}

/**
 * Total pre-roll bonus per stat: manual steppers + armor seed + spent tokens
 * (that trio never drops below 0), plus the signed condition layer (Hidden
 * +1 Surge, Weakened -1 Evade) which may pull the total negative — the
 * result totals floor at 0 in recomputeCard.
 */
function totalBonus(sideData, side) {
  const out = {};
  for (const stat of SIDE_BONUS_STATS[side]) {
    out[stat] = Math.max(0,
      (sideData.manualBonus?.[stat] ?? 0)
      + (sideData.armorBonus?.[stat] ?? 0)
      + (sideData.tokenBonus?.[stat] ?? 0))
      + (sideData.conditionBonus?.[stat] ?? 0);
  }
  return out;
}

/** Add condition dice (Focused) onto a built attack pool. */
function withConditionDice(pool, dice) {
  for (const c of ATTACK_POOL_COLORS) pool[c] = clampCount((pool[c] ?? 0) + (dice?.[c] ?? 0));
  return pool;
}

function emptyBonus(side) {
  return Object.fromEntries(SIDE_BONUS_STATS[side].map((stat) => [stat, 0]));
}

/* ------------------------------------------------------------------ */
/* State access + permissions                                          */
/* ------------------------------------------------------------------ */

export function getCombat() {
  const data = game.settings.get("swia", ACTIVE_COMBAT_KEY);
  if (!data || typeof data !== "object" || !data.attacker) return null;
  // A combat saved by an older build (pre-declared-token state shape) has no
  // per-source bonus layers. Rather than silently mis-scoring it (its armor
  // seed and manual bonuses would all read as 0), treat it as finished.
  if (!data.attacker.manualBonus || !data.defender?.manualBonus) return null;
  return data;
}

/**
 * The actor behind a combat side. Unlinked tokens carry a synthetic actor
 * whose id is the BASE actor's id, so `game.actors.get` would silently hit
 * the wrong document; prefer the token uuid recorded at start.
 */
function resolveActor(actorId, tokenUuid) {
  if (tokenUuid) {
    const doc = fromUuidSync(tokenUuid);
    if (doc?.actor) return doc.actor;
  }
  return game.actors?.get(actorId) ?? null;
}

function sideActor(combat, side) {
  const data = combat?.[side];
  if (!data) return null;
  return resolveActor(data.actorId, data.tokenUuid);
}

async function setCombat(data) {
  await game.settings.set("swia", ACTIVE_COMBAT_KEY, data ?? {});
}

function userOwnsActor(user, actorId) {
  const actor = game.actors?.get(actorId);
  return Boolean(actor?.testUserPermission?.(user, "OWNER"));
}

function canControl(user, combat, side) {
  if (!user || !combat) return false;
  return user.isGM || userOwnsActor(user, combat[side]?.actorId);
}

function healthPath(actor) {
  const wounded = actor?.type === "hero" && actor.system?.state?.wounded;
  return wounded ? "system.woundedAttributes.health" : "system.attributes.health";
}

/* ------------------------------------------------------------------ */
/* Intent dispatch (player -> GM relay)                                */
/* ------------------------------------------------------------------ */

async function dispatchIntent(intent, payload = {}) {
  if (game.user?.isGM) return execIntent(intent, payload, game.user.id);
  const gm = game.users?.activeGM;
  if (!gm) {
    ui.notifications?.warn(game.i18n.localize("SWIA.Combat.NoGM"));
    return;
  }
  game.socket?.emit(SOCKET_NAME, { type: "combatIntent", intent, payload, userId: game.user.id });
}

function onSocketMessage(payload) {
  if (payload?.type !== "combatIntent") return;
  if (game.user !== game.users?.activeGM) return;
  // The acting identity in `payload.userId` is self-asserted by the sender and
  // cannot be verified — Foundry's socket exposes no authenticated sender id on
  // the client. The local GM never relays (it calls execIntent directly in
  // dispatchIntent), so any intent arriving here is from a remote, non-GM client.
  // Reject relayed intents that claim a GM (or an unknown) user: otherwise a
  // malicious client could spoof the GM's id and bypass every ownership check via
  // canControl/userOwnsActor (which honor isGM). Non-GM intents remain authorized
  // by actor ownership in execIntent, which bounds any residual spoofing to the
  // combat actors a claimed owner already controls.
  const claimed = game.users?.get(payload.userId);
  if (!claimed || claimed.isGM) return;
  execIntent(payload.intent, payload.payload ?? {}, payload.userId);
}

/* ------------------------------------------------------------------ */
/* GM-side intent execution                                            */
/* ------------------------------------------------------------------ */

async function execIntent(intent, payload, userId) {
  const user = game.users?.get(userId);
  if (!user) return;
  try {
    switch (intent) {
      case "start": return await execStart(payload, user);
      case "setWeapon": return await execSetWeapon(payload, user);
      case "adjustPool": return await execAdjustPool(payload, user);
      case "adjustBonus": return await execAdjustBonus(payload, user);
      case "rollAttack": return await execRollAttack(payload, user);
      case "rollDefense": return await execRollDefense(payload, user);
      case "rerollDie": return await execRerollDie(payload, user);
      case "spendSurge": return await execSpendSurge(payload, user);
      case "unspendSurge": return await execUnspendSurge(payload, user);
      case "spendToken": return await execSpendToken(payload, user);
      case "unspendToken": return await execUnspendToken(payload, user);
      case "applyDamage": return await execApplyDamage(payload, user);
      case "cancel": return await execCancel(payload, user);
    }
  } catch (err) {
    console.error(`SWIA | Combat intent "${intent}" failed`, err);
  }
}

async function execStart({ attackerActorId, attackerTokenUuid, defenderActorId, defenderTokenUuid }, user) {
  if (getCombat() && !user.isGM) return;
  const attacker = resolveActor(attackerActorId, attackerTokenUuid);
  const defender = resolveActor(defenderActorId, defenderTokenUuid);
  if (!attacker || !defender) return;
  if (!user.isGM && !userOwnsActor(user, attacker.id)) return;

  const weaponId = attacker.type === "hero" ? defaultWeaponId(attacker) : null;
  // Condition rules for each side, read once at start. The defender's
  // "attacker accuracy" shift (Hidden -2) lands on the attacker's layer.
  const atkFx = conditionEffectsFor(attacker, "attack");
  const defFx = conditionEffectsFor(defender, "defense");
  await setCombat({
    id: foundry.utils.randomID(),
    phase: "setup",
    applied: false,
    attacker: {
      actorId: attacker.id,
      tokenUuid: attackerTokenUuid ?? null,
      name: attacker.name,
      img: attacker.img,
      weaponId,
      pool: withConditionDice(buildAttackPool(attacker, weaponId), atkFx.dice),
      conditionDice: atkFx.dice,
      conditionBonus: { damage: atkFx.damage, surge: atkFx.surge, accuracy: atkFx.accuracy + defFx.attackerAccuracy },
      conditionNotes: [...atkFx.notes, ...defFx.notes],
      conditionDiscard: atkFx.discardIds,
      keywords: attackKeywordsFor(attacker, weaponId),
      accuracy: weaponAccuracyFor(attacker, weaponId),
      // Pre-roll bonuses are kept by source so each can be undone on its
      // own: manual steppers, the armor seed, and declared power tokens.
      manualBonus: emptyBonus("attacker"),
      armorBonus: emptyBonus("attacker"),
      tokenBonus: emptyBonus("attacker"),
      // Per stat, the tokens declared so far (most recent last); each entry
      // carries the deleted effect so Undo can restore it exactly.
      spentTokens: { damage: [], surge: [] }
    },
    defender: {
      actorId: defender.id,
      tokenUuid: defenderTokenUuid ?? null,
      name: defender.name,
      img: defender.img,
      pool: buildDefensePool(defender),
      conditionBonus: { block: defFx.block, evade: defFx.evade },
      conditionNotes: defFx.notes,
      manualBonus: emptyBonus("defender"),
      // Equipped armor's printed Block/Evade pre-seed the bonus row. The
      // manual stepper can pull the total back down when the printed text
      // doesn't apply ("+1 Block against Ranged").
      armorBonus: armorDefenseBonusFor(defender),
      tokenBonus: emptyBonus("defender"),
      spentTokens: { block: [], evade: [] }
    },
    result: null
  });
}

async function execSetWeapon({ weaponId }, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "setup" || !canControl(user, combat, "attacker")) return;
  const attacker = sideActor(combat, "attacker");
  if (!attacker || (weaponId && !attacker.items.get(weaponId))) return;
  combat.attacker.weaponId = weaponId || null;
  combat.attacker.pool = withConditionDice(buildAttackPool(attacker, combat.attacker.weaponId), combat.attacker.conditionDice);
  combat.attacker.keywords = attackKeywordsFor(attacker, combat.attacker.weaponId);
  combat.attacker.accuracy = weaponAccuracyFor(attacker, combat.attacker.weaponId);
  await setCombat(combat);
}

async function execAdjustPool({ side, color, delta }, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "setup") return;
  if (!["attacker", "defender"].includes(side) || !canControl(user, combat, side)) return;
  const colors = side === "attacker" ? ATTACK_POOL_COLORS : DEFENSE_POOL_COLORS;
  if (!colors.includes(color)) return;
  const pool = combat[side].pool;
  pool[color] = clampCount((pool[color] ?? 0) + (Number(delta) || 0));
  await setCombat(combat);
}

async function execAdjustBonus({ side, stat, delta }, user) {
  const combat = getCombat();
  if (!combat) return;
  if (!["attacker", "defender"].includes(side)) return;
  // Attacker bonus only during setup; defender bonus during setup or after attack is rolled
  if (side === "attacker" && combat.phase !== "setup") return;
  if (side === "defender" && !["setup", "attackRolled"].includes(combat.phase)) return;
  if (!canControl(user, combat, side)) return;
  if (!SIDE_BONUS_STATS[side].includes(stat)) return;
  const sideData = combat[side];
  sideData.manualBonus ??= emptyBonus(side);
  const floor = -((sideData.armorBonus?.[stat] ?? 0) + (sideData.tokenBonus?.[stat] ?? 0));
  sideData.manualBonus[stat] = Math.max(floor, (sideData.manualBonus[stat] ?? 0) + (Number(delta) || 0));
  await setCombat(combat);
}

async function execRollAttack(_payload, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "setup" || !canControl(user, combat, "attacker")) return;
  const attacker = sideActor(combat, "attacker");
  const defender = sideActor(combat, "defender");
  if (!attacker || !defender) return;

  const formula = (pool, colors) => colors
    .filter((c) => (pool[c] ?? 0) > 0)
    .map((c) => `${pool[c]}d${COLOR_TO_DENOM[c]}`)
    .join(" + ");
  const attackFormula = formula(combat.attacker.pool, ATTACK_POOL_COLORS);
  if (!attackFormula) return;

  const attackRoll = await new Roll(attackFormula).evaluate();

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    rolls: [attackRoll],
    flavor: game.i18n.format("SWIA.Combat.AttackRollFlavor", {
      attacker: escapeHTML(combat.attacker.name),
      defender: escapeHTML(combat.defender.name)
    }),
    sound: CONFIG.sounds.dice
  });

  const attackTotals = totalSymbols(attackRoll);
  const kw = combat.attacker.keywords ?? { pierce: 0, blast: 0, cleave: false };
  const weapon = combat.attacker.weaponId ? attacker.items.get(combat.attacker.weaponId) : null;
  const pre = totalBonus(combat.attacker, "attacker");

  combat.result = recomputeCard({
    isAttack: true,
    isTest: false,
    subtitle: weapon?.name ?? "",
    targetName: combat.defender.name,
    attackFaces: rollFaces(attackRoll),
    defenseFaces: [],
    damage: attackTotals.damage,
    surge: Math.max(0, attackTotals.surge + (pre.surge ?? 0)),
    accuracy: attackTotals.accuracy,
    block: 0,
    evade: 0,
    dodge: 0,
    weaponAccuracy: combat.attacker.accuracy ?? 0,
    basePierce: kw.pierce ?? 0,
    blast: kw.blast ?? 0,
    cleave: Boolean(kw.cleave),
    bonusDamage: pre.damage ?? 0,
    bonusAccuracy: pre.accuracy ?? 0,
    bonusPierce: 0,
    bonusBlock: 0,
    bonusEvade: 0,
    spentSurge: 0,
    preBonusSurge: pre.surge ?? 0,
    // Declared-token shares, for the results breakdown
    tokenDamage: combat.attacker.tokenBonus?.damage ?? 0,
    tokenSurge: combat.attacker.tokenBonus?.surge ?? 0,
    conditionNotes: [...(combat.attacker.conditionNotes ?? []), ...(combat.defender.conditionNotes ?? [])],
    rerollLocked: false,
    surgeAbilities: gatherSurgeAbilities(attacker, combat.attacker.weaponId)
  });
  combat.phase = "attackRolled";
  await setCombat(combat);
}

async function execRollDefense(_payload, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "attackRolled" || !canControl(user, combat, "defender")) return;
  const attacker = sideActor(combat, "attacker");
  const defender = sideActor(combat, "defender");
  if (!attacker || !defender) return;

  const formula = (pool, colors) => colors
    .filter((c) => (pool[c] ?? 0) > 0)
    .map((c) => `${pool[c]}d${COLOR_TO_DENOM[c]}`)
    .join(" + ");
  const defenseFormula = formula(combat.defender.pool, DEFENSE_POOL_COLORS);

  const defenseRoll = defenseFormula ? await new Roll(defenseFormula).evaluate() : null;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: defender }),
    rolls: [defenseRoll].filter(Boolean),
    flavor: game.i18n.format("SWIA.Combat.DefenseRollFlavor", {
      defender: escapeHTML(combat.defender.name)
    }),
    sound: CONFIG.sounds.dice
  });

  const defenseTotals = totalSymbols(defenseRoll);
  const defPre = totalBonus(combat.defender, "defender");
  const state = combat.result;
  state.defenseFaces = rollFaces(defenseRoll);
  state.block = defenseTotals.block;
  state.evade = defenseTotals.evade;
  state.dodge = defenseTotals.dodge;
  state.bonusBlock = (state.bonusBlock ?? 0) + (defPre.block ?? 0);
  state.bonusEvade = (state.bonusEvade ?? 0) + (defPre.evade ?? 0);
  state.armorBlock = combat.defender.armorBonus?.block ?? 0;
  state.armorEvade = combat.defender.armorBonus?.evade ?? 0;
  state.tokenBlock = combat.defender.tokenBonus?.block ?? 0;
  state.tokenEvade = combat.defender.tokenBonus?.evade ?? 0;
  state.rerollLocked = false;

  recomputeCard(state);
  combat.phase = "rolled";
  await setCombat(combat);
}

async function execRerollDie({ side, index }, user) {
  const combat = getCombat();
  if (!combat?.result) return;
  const state = combat.result;
  if (state.rerollLocked) return;

  const idx = Number(index);
  if (!["attack", "defense"].includes(side)) return;

  // Attack dice reroll from the attack roll onward; defense dice only once rolled.
  const combatSide = side === "attack" ? "attacker" : "defender";
  const phases = side === "attack" ? ["attackRolled", "rolled"] : ["rolled"];
  if (!phases.includes(combat.phase) || !canControl(user, combat, combatSide)) return;

  const faces = side === "attack" ? state.attackFaces : state.defenseFaces;
  const face = faces?.[idx];
  if (!face?.denom) return;

  // Shared with the solo chat card: roll the replacement, swap the face,
  // recompute raw dice totals (pre-roll bonuses are preserved).
  const newResult = await rollReplacementDie(face, sideActor(combat, combatSide), combat[combatSide].name);
  if (!replaceFace(faces, idx, newResult)) return;
  recomputeFaceTotals(state, side);

  await setCombat(combat);
}

async function execSpendSurge({ index }, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "rolled" || !canControl(user, combat, "attacker")) return;
  const state = combat.result;
  // Shared with the solo chat card: mark spent, apply effects, lock rerolls
  // (a spend is the one thing a reroll can't undo; declared power tokens
  // never lock them). Exhaust-to-use flips the source card; undo readies it.
  if (!applySurgeToState(state, index)) return;
  await exhaustSurgeSource(sideActor(combat, "attacker"), state.surgeAbilities[Number(index)]);
  await setCombat(combat);
}

async function execUnspendSurge({ index }, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "rolled" || combat.applied) return;
  if (!canControl(user, combat, "attacker")) return;
  const state = combat.result;
  const ability = state?.surgeAbilities?.[Number(index)];
  if (!revertSurgeOnState(state, index)) return;
  await readySurgeSource(sideActor(combat, "attacker"), ability);
  await setCombat(combat);
}

/**
 * Declare a power token for `side` on `stat`. `kind` is "typed" (a Block
 * token for Block) or "any" (a wildcard converted to `stat`). The status
 * effect is removed from the actor and its data kept on the combat so Undo
 * can put it back. Only inside the side's declaration window.
 */
async function execSpendToken({ side, stat, kind = "typed" }, user) {
  const combat = getCombat();
  if (!combat || !["attacker", "defender"].includes(side)) return;
  if (!inDeclareWindow(combat, side) || !canControl(user, combat, side)) return;
  if (!SIDE_TOKEN_STATS[side].includes(stat)) return;
  const actor = sideActor(combat, side);
  if (!actor) return;

  const status = kind === "any" ? POWER_TOKEN_STATUS.any : POWER_TOKEN_STATUS[stat];
  if (!status) return;
  const effect = (actor.effects ?? []).find((e) => e.statuses?.has?.(status));
  if (!effect) return;
  const effectData = effect.toObject();
  await effect.delete();

  const sideData = combat[side];
  sideData.tokenBonus ??= emptyBonus(side);
  sideData.spentTokens ??= {};
  sideData.spentTokens[stat] ??= [];
  sideData.spentTokens[stat].push({ kind: kind === "any" ? "any" : "typed", effect: effectData });
  sideData.tokenBonus[stat] = (sideData.tokenBonus[stat] ?? 0) + 1;
  await setCombat(combat);
}

/** Put a declared token back on its figure from the stashed effect data. */
async function restoreTokenEffect(actor, entry) {
  if (!actor || !entry?.effect) return;
  const EffectClass = CONFIG.ActiveEffect?.documentClass ?? ActiveEffect;
  try {
    await EffectClass.create(entry.effect, { parent: actor, keepId: true });
  } catch (err) {
    // Same-id restore can collide if the token was re-granted meanwhile;
    // fall back to a fresh id rather than losing the token.
    const copy = { ...entry.effect };
    delete copy._id;
    await EffectClass.create(copy, { parent: actor });
  }
}

/** Every token declared on either side goes back to its figure (cancel path). */
async function refundDeclaredTokens(combat) {
  for (const side of ["attacker", "defender"]) {
    const sideData = combat?.[side];
    const actor = sideActor(combat, side);
    if (!sideData?.spentTokens || !actor) continue;
    for (const log of Object.values(sideData.spentTokens)) {
      for (const entry of log ?? []) {
        try {
          await restoreTokenEffect(actor, entry);
        } catch (err) {
          console.warn("SWIA | could not refund a declared power token", err);
        }
      }
    }
  }
}

/** Undo the most recent token declared on `stat`: restore the effect exactly. */
async function execUnspendToken({ side, stat }, user) {
  const combat = getCombat();
  if (!combat || !["attacker", "defender"].includes(side)) return;
  if (!inDeclareWindow(combat, side) || !canControl(user, combat, side)) return;
  const sideData = combat[side];
  const log = sideData.spentTokens?.[stat];
  if (!Array.isArray(log) || !log.length) return;
  const actor = resolveActor(sideData.actorId, sideData.tokenUuid);
  if (!actor) return;

  // Restore first, pop only once the token is back on the figure: a failed
  // create must not leave the entry gone from the log AND from the actor.
  const entry = log[log.length - 1];
  await restoreTokenEffect(actor, entry);
  log.pop();
  sideData.tokenBonus[stat] = Math.max(0, (sideData.tokenBonus[stat] ?? 0) - 1);
  // Manual may have been pulled negative against this token; keep total >= 0.
  const floor = -((sideData.armorBonus?.[stat] ?? 0) + (sideData.tokenBonus?.[stat] ?? 0));
  if ((sideData.manualBonus?.[stat] ?? 0) < floor) sideData.manualBonus[stat] = floor;
  await setCombat(combat);
}

async function execApplyDamage(_payload, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "rolled" || combat.applied) return;
  if (!canControl(user, combat, "attacker")) return;
  const defender = sideActor(combat, "defender");
  if (!defender) return;

  const state = combat.result;
  const path = healthPath(defender);
  const current = Number(foundry.utils.getProperty(defender, `${path}.value`)) || 0;
  await defender.update({ [`${path}.value`]: Math.max(0, current - state.netDamage) });

  // Summary chat card (read-only: no flags, no reroll/undo buttons, all
  // surge buttons disabled)
  const summary = foundry.utils.deepClone(state);
  summary.title = game.i18n.format("SWIA.Combat.SummaryTitle", {
    attacker: combat.attacker.name,
    defender: combat.defender.name
  });
  summary.readOnly = true;
  recomputeCard(summary); // derives canReroll=false from readOnly
  for (const ability of summary.surgeAbilities ?? []) ability.affordable = false;
  const content = await renderTemplateFn(CARD_TEMPLATE, summary);
  const attacker = sideActor(combat, "attacker");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker ?? undefined }),
    content
  });

  ui.notifications?.info(game.i18n.format("SWIA.Combat.Applied", {
    damage: state.netDamage,
    name: combat.defender.name
  }));

  // The attack has resolved: the attacker's Focused/Hidden-style conditions
  // come off. (Cancel never reaches here, so a cancelled attack keeps them.)
  if (combat.attacker.conditionDiscard?.length) {
    const removed = await discardConditions(attacker, combat.attacker.conditionDiscard);
    if (removed.length) {
      ui.notifications?.info(game.i18n.format("SWIA.Conditions.Discarded", {
        name: combat.attacker.name,
        list: removed.map((id) => conditionLabel(getCondition(id))).join(", ")
      }));
    }
  }
  await setCombat(null);
}

async function execCancel(_payload, user) {
  const combat = getCombat();
  if (!combat) return;
  if (!user.isGM && !canControl(user, combat, "attacker")) return;
  // Declared tokens were removed from the figures; a cancelled attack never
  // happened, so they go back.
  await refundDeclaredTokens(combat);
  await setCombat(null);
}

/* ------------------------------------------------------------------ */
/* Initiation (called from SWIARollDialog.open when a target is set)   */
/* ------------------------------------------------------------------ */

export function startCombat(attacker, targetToken) {
  if (getCombat()) {
    // Reopen the in-progress combat window (it may have been closed) so the
    // user can resolve or cancel it instead of being stranded.
    SWIACombatWindow.show();
    ui.notifications?.warn(game.i18n.localize("SWIA.Combat.ActiveExists"));
    return;
  }
  dispatchIntent("start", {
    attackerActorId: attacker.id,
    // Synthetic (unlinked-token) actors expose their TokenDocument as .token
    attackerTokenUuid: attacker.token?.uuid ?? null,
    defenderActorId: targetToken.actor.id,
    defenderTokenUuid: targetToken.document?.uuid ?? targetToken.uuid ?? null
  });
}

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

export class SWIACombatWindow extends BaseApplication {
  static DEFAULT_OPTIONS = {
    id: "swia-combat-window",
    classes: ["swia-combat-window"],
    tag: "section",
    position: { width: 720, height: "auto" },
    window: { title: "SWIA.Combat.Title", icon: "fas fa-crosshairs" },
    actions: {
      combatAdjustDie: SWIACombatWindow.prototype._onAdjustDie,
      combatAdjustBonus: SWIACombatWindow.prototype._onAdjustBonus,
      combatRollAttack: SWIACombatWindow.prototype._onRollAttack,
      combatRollDefense: SWIACombatWindow.prototype._onRollDefense,
      combatRerollDie: SWIACombatWindow.prototype._onRerollDie,
      combatSpendSurge: SWIACombatWindow.prototype._onSpendSurge,
      combatUnspendSurge: SWIACombatWindow.prototype._onUnspendSurge,
      combatSpendToken: SWIACombatWindow.prototype._onSpendToken,
      combatUnspendToken: SWIACombatWindow.prototype._onUnspendToken,
      combatApplyDamage: SWIACombatWindow.prototype._onApplyDamage,
      combatCancel: SWIACombatWindow.prototype._onCancel
    }
  };

  static PARTS = {
    main: { template: WINDOW_TEMPLATE }
  };

  static instance = null;

  static show() {
    SWIACombatWindow.instance ??= new SWIACombatWindow();
    SWIACombatWindow.instance.render(true);
    return SWIACombatWindow.instance;
  }

  get title() {
    const combat = getCombat();
    if (!combat) return game.i18n.localize("SWIA.Combat.Title");
    return `${game.i18n.localize("SWIA.Combat.Title")}: ${combat.attacker.name} vs ${combat.defender.name}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const combat = getCombat();
    if (!combat) return foundry.utils.mergeObject(context, { hasCombat: false });

    const canAttacker = canControl(game.user, combat, "attacker");
    const canDefender = canControl(game.user, combat, "defender");
    const attackerActor = sideActor(combat, "attacker");
    const weapons = attackerActor?.type === "hero"
      ? heroWeapons(attackerActor).filter((w) => (w.system?.cardState ?? "ready") !== "depleted")
      : [];
    const kw = combat.attacker.keywords ?? {};
    const keywordParts = [];
    if (kw.pierce > 0) keywordParts.push(`${game.i18n.localize("SWIA.Keywords.Pierce")} ${kw.pierce}`);
    if (kw.blast > 0) keywordParts.push(`${game.i18n.localize("SWIA.Keywords.Blast")} ${kw.blast}`);
    if (kw.cleave) keywordParts.push(game.i18n.localize("SWIA.Keywords.Cleave"));
    if (kw.reach) keywordParts.push(game.i18n.localize("SWIA.Keywords.Reach"));

    const diceRow = (side, pool) => (color) => ({ side, color, count: pool[color] ?? 0 });
    const defenderActor = sideActor(combat, "defender");

    // One row per bonus stat: the manual stepper on the total, plus token
    // controls for stats a token can feed. Token counts are read live from
    // the actor so a GM granting one mid-setup shows up without a restart.
    const bonusRows = (side, sideData, actor, canAct) => {
      const totals = totalBonus(sideData, side);
      const held = countPowerTokens(actor);
      const open = inDeclareWindow(combat, side) && canAct;
      return SIDE_BONUS_STATS[side].map((stat) => {
        const manual = sideData.manualBonus?.[stat] ?? 0;
        const armor = sideData.armorBonus?.[stat] ?? 0;
        const token = sideData.tokenBonus?.[stat] ?? 0;
        const condition = sideData.conditionBonus?.[stat] ?? 0;
        const spent = sideData.spentTokens?.[stat]?.length ?? 0;
        const takesTokens = SIDE_TOKEN_STATS[side].includes(stat);
        const label = game.i18n.localize(`SWIA.Dice.${stat.charAt(0).toUpperCase()}${stat.slice(1)}`);
        return {
          side, stat, label,
          count: totals[stat],
          manual, armor, token, condition,
          breakdown: game.i18n.format("SWIA.Combat.BonusBreakdown", { manual, armor, token, condition }),
          takesTokens,
          typedTokens: takesTokens ? (held[stat] ?? 0) : 0,
          anyTokens: takesTokens ? (held.any ?? 0) : 0,
          spent,
          canSpend: open,
          tokenIcon: `systems/swia/icons/Power ${stat.charAt(0).toUpperCase()}${stat.slice(1)} Token.png`,
          anyIcon: "systems/swia/icons/Power Any Token.png"
        };
      });
    };
    const isSetup = combat.phase === "setup";
    const isAttackRolled = combat.phase === "attackRolled";
    const isRolled = combat.phase === "rolled";

    return foundry.utils.mergeObject(context, {
      hasCombat: true,
      isSetup,
      isAttackRolled,
      isRolled,
      canAttacker,
      canDefender,
      canCancel: game.user.isGM || canAttacker,
      canAttackerReroll: !combat.result?.rerollLocked && canAttacker && (isAttackRolled || isRolled),
      canDefenderReroll: !combat.result?.rerollLocked && canDefender && isRolled,
      showDefenderBonus: isSetup || isAttackRolled,
      attacker: {
        ...combat.attacker,
        keywordsLine: keywordParts.join(" · "),
        showWeaponSelect: weapons.length > 0,
        weapons: weapons.map((w) => ({
          id: w.id,
          name: w.name,
          selected: w.id === combat.attacker.weaponId,
          cardState: w.system?.cardState ?? "ready"
        })),
        preBonusRows: bonusRows("attacker", combat.attacker, attackerActor, canAttacker),
        tokensHeld: countPowerTokens(attackerActor)
      },
      defender: {
        ...combat.defender,
        preBonusRows: bonusRows("defender", combat.defender, defenderActor, canDefender),
        tokensHeld: countPowerTokens(defenderActor)
      },
      attackRows: ATTACK_POOL_COLORS.map(diceRow("attacker", combat.attacker.pool)),
      defenseRows: DEFENSE_POOL_COLORS.map(diceRow("defender", combat.defender.pool)),
      result: combat.result
    });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const select = this.element?.querySelector?.(".combat-weapon-select");
    if (select) {
      select.addEventListener("change", (event) => {
        dispatchIntent("setWeapon", { weaponId: event.currentTarget.value || null });
      });
    }
  }

  async _onAdjustDie(event, target) {
    event.preventDefault();
    dispatchIntent("adjustPool", {
      side: target?.dataset?.side,
      color: target?.dataset?.color,
      delta: Number(target?.dataset?.delta) || 0
    });
  }

  async _onAdjustBonus(event, target) {
    event.preventDefault();
    dispatchIntent("adjustBonus", {
      side: target?.dataset?.side,
      stat: target?.dataset?.stat,
      delta: Number(target?.dataset?.delta) || 0
    });
  }

  async _onRerollDie(event, target) {
    event.preventDefault();
    dispatchIntent("rerollDie", {
      side: target?.dataset?.side,
      index: Number(target?.dataset?.index)
    });
  }

  async _onRollAttack(event) {
    event.preventDefault();
    dispatchIntent("rollAttack");
  }

  async _onRollDefense(event) {
    event.preventDefault();
    dispatchIntent("rollDefense");
  }

  async _onSpendSurge(event, target) {
    event.preventDefault();
    dispatchIntent("spendSurge", { index: Number(target?.dataset?.index) });
  }

  async _onUnspendSurge(event, target) {
    event.preventDefault();
    dispatchIntent("unspendSurge", { index: Number(target?.dataset?.index) });
  }

  async _onSpendToken(event, target) {
    event.preventDefault();
    dispatchIntent("spendToken", {
      side: target?.dataset?.side,
      stat: target?.dataset?.stat,
      kind: target?.dataset?.kind || "typed"
    });
  }

  async _onUnspendToken(event, target) {
    event.preventDefault();
    dispatchIntent("unspendToken", {
      side: target?.dataset?.side,
      stat: target?.dataset?.stat
    });
  }

  async _onApplyDamage(event) {
    event.preventDefault();
    const combat = getCombat();
    if (!combat?.result) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SWIA.Combat.ApplyDamage") },
      content: `<p>${game.i18n.format("SWIA.Combat.ApplyConfirm", {
        damage: combat.result.netDamage,
        name: escapeHTML(combat.defender.name)
      })}</p>`
    });
    if (!confirmed) return;
    dispatchIntent("applyDamage");
  }

  async _onCancel(event) {
    event.preventDefault();
    dispatchIntent("cancel");
  }

  async close(options) {
    if (SWIACombatWindow.instance === this) SWIACombatWindow.instance = null;
    return super.close?.(options);
  }
}

/* ------------------------------------------------------------------ */
/* Registration (call from the system init hook)                       */
/* ------------------------------------------------------------------ */

export function registerCombatHooks() {
  game.settings.register("swia", ACTIVE_COMBAT_KEY, {
    name: "SWIA Active Combat",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Targeted attacks start a shared combat instead of the solo dialog
  setCombatStarter(startCombat);

  // Token trays in the window read the actors live; repaint when a power
  // token is granted or removed on either combatant (e.g. from the portal).
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hook, (effect) => {
      const combat = getCombat();
      const parent = effect?.parent;
      if (!combat || parent?.documentName !== "Actor") return;
      const ids = [combat.attacker?.actorId, combat.defender?.actorId];
      if (!ids.includes(parent.id)) return;
      SWIACombatWindow.instance?.render(false);
    });
  }

  Hooks.once("ready", () => {
    game.socket?.on?.(SOCKET_NAME, onSocketMessage);
  });

  // Live sync + auto-open for all connected users. Spectators get a
  // view-only window: every action is permission-gated per user via
  // canAttacker/canDefender/canCancel in _prepareContext and execIntent.
  Hooks.on("updateSetting", (setting) => {
    if (setting?.key !== `swia.${ACTIVE_COMBAT_KEY}`) return;
    const combat = getCombat();
    const win = SWIACombatWindow.instance;
    if (!combat) {
      win?.close();
      return;
    }
    if (win?.rendered) {
      win.render(false);
      return;
    }
    SWIACombatWindow.show();
  });
}
