// Phase 6 — Shared combat window (attacker vs defender).
// State lives in the "swia.activeCombat" world setting; every client re-renders
// via the updateSetting hook (campaign-tracker pattern). All mutations are
// socket intents executed and permission-checked on the active GM's client
// (generalizes the Phase 5 surge-spend relay).

import {
  SOCKET_NAME, CARD_TEMPLATE, renderTemplateFn, clampCount, recomputeCard,
  ATTACK_POOL_COLORS, DEFENSE_POOL_COLORS, heroWeapons, defaultWeaponId,
  buildAttackPool, buildDefensePool, attackKeywordsFor, weaponAccuracyFor,
  gatherSurgeAbilities, setCombatStarter
} from "./roll-dialog.js";
import { COLOR_TO_DENOM, totalSymbols, rollFaces, faceData, SWIA_DICE, symbolsLabel, dieImgPath } from "./dice-terms.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApplication = HandlebarsApplicationMixin(ApplicationV2);

export const ACTIVE_COMBAT_KEY = "activeCombat";
const WINDOW_TEMPLATE = "systems/swia/templates/dice/combat-window.hbs";
const POWER_TOKEN_TYPES = ["block", "evade"];

/* ------------------------------------------------------------------ */
/* State access + permissions                                          */
/* ------------------------------------------------------------------ */

export function getCombat() {
  const data = game.settings.get("swia", ACTIVE_COMBAT_KEY);
  return data && typeof data === "object" && data.attacker ? data : null;
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

function countPowerTokens(actor) {
  const counts = { block: 0, evade: 0 };
  for (const effect of actor?.effects ?? []) {
    for (const type of POWER_TOKEN_TYPES) {
      if (effect.statuses?.has?.(`power-${type}`)) counts[type] += 1;
    }
  }
  return counts;
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
      case "spendToken": return await execSpendToken(payload, user);
      case "applyDamage": return await execApplyDamage(payload, user);
      case "cancel": return await execCancel(payload, user);
    }
  } catch (err) {
    console.error(`SWIA | Combat intent "${intent}" failed`, err);
  }
}

async function execStart({ attackerActorId, defenderActorId, defenderTokenId }, user) {
  if (getCombat() && !user.isGM) return;
  const attacker = game.actors?.get(attackerActorId);
  const defender = game.actors?.get(defenderActorId);
  if (!attacker || !defender) return;
  if (!user.isGM && !userOwnsActor(user, attacker.id)) return;

  const weaponId = attacker.type === "hero" ? defaultWeaponId(attacker) : null;
  await setCombat({
    id: foundry.utils.randomID(),
    phase: "setup",
    applied: false,
    attacker: {
      actorId: attacker.id,
      name: attacker.name,
      img: attacker.img,
      weaponId,
      pool: buildAttackPool(attacker, weaponId),
      keywords: attackKeywordsFor(attacker, weaponId),
      accuracy: weaponAccuracyFor(attacker, weaponId),
      preBonus: { damage: 0, surge: 0, accuracy: 0 }
    },
    defender: {
      actorId: defender.id,
      tokenId: defenderTokenId ?? null,
      name: defender.name,
      img: defender.img,
      pool: buildDefensePool(defender),
      tokens: countPowerTokens(defender),
      preBonus: { block: 0, evade: 0 }
    },
    result: null
  });
}

async function execSetWeapon({ weaponId }, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "setup" || !canControl(user, combat, "attacker")) return;
  const attacker = game.actors?.get(combat.attacker.actorId);
  if (!attacker || (weaponId && !attacker.items.get(weaponId))) return;
  combat.attacker.weaponId = weaponId || null;
  combat.attacker.pool = buildAttackPool(attacker, combat.attacker.weaponId);
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
  const validStats = side === "attacker" ? ["damage", "surge", "accuracy"] : ["block", "evade"];
  if (!validStats.includes(stat)) return;
  const preBonus = combat[side].preBonus ?? {};
  preBonus[stat] = Math.max(0, (preBonus[stat] ?? 0) + (Number(delta) || 0));
  combat[side].preBonus = preBonus;
  await setCombat(combat);
}

async function execRollAttack(_payload, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "setup" || !canControl(user, combat, "attacker")) return;
  const attacker = game.actors?.get(combat.attacker.actorId);
  const defender = game.actors?.get(combat.defender.actorId);
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
      attacker: combat.attacker.name,
      defender: combat.defender.name
    }),
    sound: CONFIG.sounds.dice
  });

  const attackTotals = totalSymbols(attackRoll);
  const kw = combat.attacker.keywords ?? { pierce: 0, blast: 0, cleave: false };
  const weapon = combat.attacker.weaponId ? attacker.items.get(combat.attacker.weaponId) : null;
  const pre = combat.attacker.preBonus ?? {};

  combat.result = recomputeCard({
    isAttack: true,
    isTest: false,
    subtitle: weapon?.name ?? "",
    targetName: combat.defender.name,
    attackFaces: rollFaces(attackRoll),
    defenseFaces: [],
    damage: attackTotals.damage,
    surge: attackTotals.surge + (pre.surge ?? 0),
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
    spentTokens: { block: 0, evade: 0 },
    preBonusSurge: pre.surge ?? 0,
    rerollLocked: false,
    surgeAbilities: gatherSurgeAbilities(attacker, combat.attacker.weaponId)
  });
  combat.phase = "attackRolled";
  await setCombat(combat);
}

async function execRollDefense(_payload, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "attackRolled" || !canControl(user, combat, "defender")) return;
  const attacker = game.actors?.get(combat.attacker.actorId);
  const defender = game.actors?.get(combat.defender.actorId);
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
      defender: combat.defender.name
    }),
    sound: CONFIG.sounds.dice
  });

  const defenseTotals = totalSymbols(defenseRoll);
  const defPre = combat.defender.preBonus ?? {};
  const state = combat.result;
  state.defenseFaces = rollFaces(defenseRoll);
  state.block = defenseTotals.block;
  state.evade = defenseTotals.evade;
  state.dodge = defenseTotals.dodge;
  state.bonusBlock = (state.bonusBlock ?? 0) + (defPre.block ?? 0);
  state.bonusEvade = (state.bonusEvade ?? 0) + (defPre.evade ?? 0);
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

  if (side === "attack") {
    if (!["attackRolled", "rolled"].includes(combat.phase)) return;
    if (!canControl(user, combat, "attacker")) return;
    const faces = state.attackFaces;
    if (!faces?.[idx] || faces[idx].rerolled || !faces[idx].denom) return;

    const face = faces[idx];
    const roll = await new Roll(`1d${face.denom}`).evaluate();
    const attacker = game.actors?.get(combat.attacker.actorId);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      rolls: [roll],
      flavor: game.i18n.format("SWIA.Combat.RerollFlavor", { name: combat.attacker.name }),
      sound: CONFIG.sounds.dice
    });

    const newResult = roll.dice[0].results[0].result;
    const newFace = faceData(face.denom, newResult);
    if (!newFace) return;
    faces[idx] = {
      img: dieImgPath(newFace.img),
      label: symbolsLabel(newFace.symbols),
      color: SWIA_DICE[face.denom].color,
      denom: face.denom,
      resultNum: newResult,
      rerolled: true
    };

    // Recompute attack totals from all current faces
    let totalDmg = 0, totalSrg = 0, totalAcc = 0;
    for (const f of faces) {
      if (!f.denom || f.resultNum == null) continue;
      const fd = faceData(f.denom, f.resultNum);
      if (fd) {
        totalDmg += fd.symbols.damage ?? 0;
        totalSrg += fd.symbols.surge ?? 0;
        totalAcc += fd.symbols.accuracy ?? 0;
      }
    }
    state.damage = totalDmg;
    state.surge = totalSrg + (state.preBonusSurge ?? 0);
    state.accuracy = totalAcc;
    recomputeCard(state);

  } else if (side === "defense") {
    if (combat.phase !== "rolled") return;
    if (!canControl(user, combat, "defender")) return;
    const faces = state.defenseFaces;
    if (!faces?.[idx] || faces[idx].rerolled || !faces[idx].denom) return;

    const face = faces[idx];
    const roll = await new Roll(`1d${face.denom}`).evaluate();
    const defender = game.actors?.get(combat.defender.actorId);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: defender }),
      rolls: [roll],
      flavor: game.i18n.format("SWIA.Combat.RerollFlavor", { name: combat.defender.name }),
      sound: CONFIG.sounds.dice
    });

    const newResult = roll.dice[0].results[0].result;
    const newFace = faceData(face.denom, newResult);
    if (!newFace) return;
    faces[idx] = {
      img: dieImgPath(newFace.img),
      label: symbolsLabel(newFace.symbols),
      color: SWIA_DICE[face.denom].color,
      denom: face.denom,
      resultNum: newResult,
      rerolled: true
    };

    // Recompute defense totals from all current faces
    // bonusBlock/bonusEvade already include preBonus + any token spends; just update raw dice values
    let totalBlk = 0, totalEvd = 0, totalDdg = 0;
    for (const f of faces) {
      if (!f.denom || f.resultNum == null) continue;
      const fd = faceData(f.denom, f.resultNum);
      if (fd) {
        totalBlk += fd.symbols.block ?? 0;
        totalEvd += fd.symbols.evade ?? 0;
        totalDdg += fd.symbols.dodge ?? 0;
      }
    }
    state.block = totalBlk;
    state.evade = totalEvd;
    state.dodge = totalDdg;
    recomputeCard(state);
  }

  await setCombat(combat);
}

async function execSpendSurge({ index }, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "rolled" || !canControl(user, combat, "attacker")) return;
  const state = combat.result;
  const ability = state?.surgeAbilities?.[Number(index)];
  if (!ability || ability.spent || ability.cost > state.usableSurge) return;

  ability.spent = true;
  state.spentSurge += ability.cost;
  state.rerollLocked = true;
  for (const fx of ability.effects ?? []) {
    if (fx.type === "damage") state.bonusDamage += fx.value;
    else if (fx.type === "accuracy") state.bonusAccuracy += fx.value;
    else if (fx.type === "pierce") state.bonusPierce += fx.value;
  }
  recomputeCard(state);
  await setCombat(combat);
}

async function execSpendToken({ token }, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "rolled" || !canControl(user, combat, "defender")) return;
  if (!POWER_TOKEN_TYPES.includes(token)) return;
  const defender = game.actors?.get(combat.defender.actorId);
  if (!defender) return;

  // Consume one matching power-token status effect from the defender
  const effect = (defender.effects ?? []).find((e) => e.statuses?.has?.(`power-${token}`));
  if (!effect) return;
  await effect.delete();

  const state = combat.result;
  if (token === "block") state.bonusBlock += 1;
  else state.bonusEvade += 1;
  state.spentTokens[token] = (state.spentTokens[token] ?? 0) + 1;
  state.rerollLocked = true;
  combat.defender.tokens = countPowerTokens(defender);
  recomputeCard(state);
  await setCombat(combat);
}

async function execApplyDamage(_payload, user) {
  const combat = getCombat();
  if (!combat || combat.phase !== "rolled" || combat.applied) return;
  if (!canControl(user, combat, "attacker")) return;
  const defender = game.actors?.get(combat.defender.actorId);
  if (!defender) return;

  const state = combat.result;
  const path = healthPath(defender);
  const current = Number(foundry.utils.getProperty(defender, `${path}.value`)) || 0;
  await defender.update({ [`${path}.value`]: Math.max(0, current - state.netDamage) });

  // Summary chat card (read-only: no flags, all surge buttons disabled)
  const summary = foundry.utils.deepClone(state);
  summary.title = game.i18n.format("SWIA.Combat.SummaryTitle", {
    attacker: combat.attacker.name,
    defender: combat.defender.name
  });
  for (const ability of summary.surgeAbilities ?? []) ability.affordable = false;
  const content = await renderTemplateFn(CARD_TEMPLATE, summary);
  const attacker = game.actors?.get(combat.attacker.actorId);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker ?? undefined }),
    content
  });

  ui.notifications?.info(game.i18n.format("SWIA.Combat.Applied", {
    damage: state.netDamage,
    name: combat.defender.name
  }));
  await setCombat(null);
}

async function execCancel(_payload, user) {
  const combat = getCombat();
  if (!combat) return;
  if (!user.isGM && !canControl(user, combat, "attacker")) return;
  await setCombat(null);
}

/* ------------------------------------------------------------------ */
/* Initiation (called from SWIARollDialog.open when a target is set)   */
/* ------------------------------------------------------------------ */

export function startCombat(attacker, targetToken) {
  if (getCombat()) {
    ui.notifications?.warn(game.i18n.localize("SWIA.Combat.ActiveExists"));
    return;
  }
  dispatchIntent("start", {
    attackerActorId: attacker.id,
    defenderActorId: targetToken.actor.id,
    defenderTokenId: targetToken.id ?? null
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
      combatSpendToken: SWIACombatWindow.prototype._onSpendToken,
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
    const attackerActor = game.actors?.get(combat.attacker.actorId);
    const weapons = attackerActor?.type === "hero" ? heroWeapons(attackerActor) : [];
    const kw = combat.attacker.keywords ?? {};
    const keywordParts = [];
    if (kw.pierce > 0) keywordParts.push(`${game.i18n.localize("SWIA.Keywords.Pierce")} ${kw.pierce}`);
    if (kw.blast > 0) keywordParts.push(`${game.i18n.localize("SWIA.Keywords.Blast")} ${kw.blast}`);
    if (kw.cleave) keywordParts.push(game.i18n.localize("SWIA.Keywords.Cleave"));
    if (kw.reach) keywordParts.push(game.i18n.localize("SWIA.Keywords.Reach"));

    const diceRow = (side, pool) => (color) => ({ side, color, count: pool[color] ?? 0 });
    const attackPre = combat.attacker.preBonus ?? { damage: 0, surge: 0, accuracy: 0 };
    const defensePre = combat.defender.preBonus ?? { block: 0, evade: 0 };
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
        preBonusRows: [
          { stat: "damage", label: game.i18n.localize("SWIA.Dice.Damage"), count: attackPre.damage },
          { stat: "surge", label: game.i18n.localize("SWIA.Dice.Surge"), count: attackPre.surge },
          { stat: "accuracy", label: game.i18n.localize("SWIA.Dice.Accuracy"), count: attackPre.accuracy }
        ]
      },
      defender: {
        ...combat.defender,
        preBonusRows: [
          { stat: "block", label: game.i18n.localize("SWIA.Dice.Block"), count: defensePre.block },
          { stat: "evade", label: game.i18n.localize("SWIA.Dice.Evade"), count: defensePre.evade }
        ]
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

  async _onSpendToken(event, target) {
    event.preventDefault();
    dispatchIntent("spendToken", { token: target?.dataset?.token });
  }

  async _onApplyDamage(event) {
    event.preventDefault();
    const combat = getCombat();
    if (!combat?.result) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SWIA.Combat.ApplyDamage") },
      content: `<p>${game.i18n.format("SWIA.Combat.ApplyConfirm", {
        damage: combat.result.netDamage,
        name: combat.defender.name
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

  Hooks.once("ready", () => {
    game.socket?.on?.(SOCKET_NAME, onSocketMessage);
  });

  // Live sync + auto-open for involved users
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
    const involved = game.user.isGM
      || canControl(game.user, combat, "attacker")
      || canControl(game.user, combat, "defender");
    if (involved) SWIACombatWindow.show();
  });
}
