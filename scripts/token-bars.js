// Token bars that follow the active attribute set, and linked hero tokens.
//
// A hero has two health/endurance pools (healthy `attributes`, wounded
// `woundedAttributes`). The sheet, portals, combat window and steppers all
// switch to the wounded pool while wounded; Foundry's token bars cannot, so
// a bar pointed at `attributes.health` kept showing the healthy side's (usually
// empty) pool after a wound. The data models now expose `system.current.*`
// (see scripts/data/actors.js) and the bars point there.
//
// Hero tokens are also linked: an unlinked hero token keeps its own copy of
// health (an ActorDelta) that the portals and the sidebar sheet never read,
// so the two drift apart the moment the combat window damages the token.

import { ACTIVE_POOL_KEYS } from "./data/actors.js";

export const ACTIVE_BAR = { bar1: "current.health", bar2: "current.endurance" };

/** Old bar attributes and what they become. */
const LEGACY_BAR_ATTRIBUTES = {
  "attributes.health": "current.health",
  "attributes.endurance": "current.endurance"
};

const MIGRATION_KEY = "tokenBarMigration";
const MIGRATION_VERSION = "0.1.9-active-pool";

function isPoolAttribute(attribute) {
  const match = /^current\.(\w+)$/.exec(String(attribute ?? ""));
  return Boolean(match && ACTIVE_POOL_KEYS.includes(match[1]));
}

/* ------------------------------------------------------------------ */
/* Document classes                                                    */
/* ------------------------------------------------------------------ */

/**
 * Actor: the token HUD's bar input calls modifyTokenAttribute with the bar's
 * attribute. `current.*` is derived (not in the schema), so redirect the
 * write to the active set's real path; the core method then reads value/max
 * from there and clamps as usual.
 */
function defineActorClass() {
  const Base = CONFIG.Actor.documentClass;
  if (Base?.swiaActivePool) return;
  class SWIAActorActivePool extends Base {
    static swiaActivePool = true;

    async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
      const real = this.system?.resolvePoolAttribute?.(attribute) ?? attribute;
      return super.modifyTokenAttribute(real, value, isDelta, isBar);
    }
  }
  CONFIG.Actor.documentClass = SWIAActorActivePool;
}

/**
 * TokenDocument: core marks a bar editable only when its attribute is a
 * schema field, which `current.*` is not, so the HUD would show the bar
 * read-only. The write path is handled above, so mark it editable.
 */
function defineTokenClass() {
  const Base = CONFIG.Token.documentClass;
  if (Base?.swiaActivePool) return;
  class SWIATokenDocument extends Base {
    static swiaActivePool = true;

    getBarAttribute(barName, options = {}) {
      const data = super.getBarAttribute(barName, options);
      if (data && isPoolAttribute(data.attribute)) data.editable = true;
      return data;
    }
  }
  CONFIG.Token.documentClass = SWIATokenDocument;
}

/**
 * Bar choices in Token Config. Derived paths are not discovered from the
 * schema, so list them explicitly; the raw per-side paths stay available.
 */
function configureTrackableAttributes() {
  const unit = {
    bar: ["current.health", "attributes.health"],
    value: ["attributes.speed", "attributes.surge"]
  };
  CONFIG.Actor.trackableAttributes = {
    hero: {
      bar: [
        "current.health", "current.endurance",
        "attributes.health", "attributes.endurance",
        "woundedAttributes.health", "woundedAttributes.endurance"
      ],
      value: ["attributes.speed", "xp"]
    },
    villain: unit,
    ally: unit,
    character: { bar: ["current.health", "attributes.health"], value: ["attributes.speed"] },
    object: { bar: ["current.health", "attributes.health"], value: [] }
  };
}

/* ------------------------------------------------------------------ */
/* Creation-time normalising                                           */
/* ------------------------------------------------------------------ */

/** Patch for a token-ish source (prototype token or token data): legacy bar paths only. */
function barPatch(tokenData, prefix = "") {
  const patch = {};
  for (const bar of ["bar1", "bar2"]) {
    const attr = tokenData?.[bar]?.attribute;
    if (attr && LEGACY_BAR_ATTRIBUTES[attr]) patch[`${prefix}${bar}.attribute`] = LEGACY_BAR_ATTRIBUTES[attr];
  }
  return patch;
}

function registerCreationHooks() {
  // New heroes are linked (Foundry's default is unlinked for every type);
  // any actor arriving with the old bar paths (an un-rebuilt pack, a JSON
  // import) gets the active-pool ones.
  Hooks.on("preCreateActor", (actor, data) => {
    const proto = actor.prototypeToken ?? data?.prototypeToken ?? {};
    const patch = barPatch(proto, "prototypeToken.");
    if (actor.type === "hero" && !proto.actorLink) patch["prototypeToken.actorLink"] = true;
    if (Object.keys(patch).length) actor.updateSource(patch);
  });

  // Tokens dropped straight from a compendium actor (not yet imported)
  // carry whatever bars that actor was built with.
  Hooks.on("preCreateToken", (token) => {
    const patch = barPatch(token);
    if (Object.keys(patch).length) token.updateSource(patch);
  });
}

/* ------------------------------------------------------------------ */
/* Bar refresh                                                         */
/* ------------------------------------------------------------------ */

/**
 * Wounding switches the active pool without touching `current.*` in the
 * update payload, and a write to the wounded side lands on
 * `woundedAttributes.*`. Make sure placed tokens redraw their bars either way.
 */
function registerRefreshHooks() {
  Hooks.on("updateActor", (actor, changes) => {
    if (actor?.type !== "hero" || !canvas?.ready) return;
    const touches = foundry.utils.hasProperty(changes, "system.state.wounded")
      || foundry.utils.hasProperty(changes, "system.woundedAttributes");
    if (!touches) return;
    for (const token of actor.getActiveTokens?.(false, false) ?? []) {
      token.renderFlags?.set?.({ refreshBars: true });
      if (token.hasActiveHUD) canvas.tokens?.hud?.render?.();
    }
  });
}

/* ------------------------------------------------------------------ */
/* World migration                                                     */
/* ------------------------------------------------------------------ */

/**
 * Once per world (GM): repoint legacy bars on every world actor's
 * prototype and every placed token, and link every hero — prototypes and
 * placed tokens. Linking a placed token drops its private copy of health;
 * from then on it shows the hero sheet's numbers, which is what the portals
 * and sheet were already showing.
 */
export async function migrateTokenBars() {
  if (!game.user?.isGM) return;
  if (game.settings.get("swia", MIGRATION_KEY) === MIGRATION_VERSION) return;

  let actorsPatched = 0;
  let heroesLinked = 0;
  let tokensPatched = 0;
  let tokensLinked = 0;

  const actorUpdates = [];
  for (const actor of game.actors?.contents ?? []) {
    const proto = actor.prototypeToken ?? {};
    const patch = barPatch(proto, "prototypeToken.");
    if (actor.type === "hero" && !proto.actorLink) {
      patch["prototypeToken.actorLink"] = true;
      heroesLinked += 1;
    }
    if (!Object.keys(patch).length) continue;
    actorUpdates.push({ _id: actor.id, ...patch });
    actorsPatched += 1;
  }
  if (actorUpdates.length) await Actor.updateDocuments(actorUpdates);

  for (const scene of game.scenes?.contents ?? []) {
    const updates = [];
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      const patch = barPatch(tokenDoc);
      const isHero = game.actors?.get(tokenDoc.actorId)?.type === "hero";
      if (isHero && !tokenDoc.actorLink) {
        patch.actorLink = true;
        tokensLinked += 1;
      }
      if (!Object.keys(patch).length) continue;
      updates.push({ _id: tokenDoc.id, ...patch });
      tokensPatched += 1;
    }
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
  }

  await game.settings.set("swia", MIGRATION_KEY, MIGRATION_VERSION);

  if (actorsPatched || tokensPatched) {
    console.log(`SWIA | Token bars: ${actorsPatched} actor prototype(s), ${tokensPatched} placed token(s) updated; `
      + `${heroesLinked} hero(es) and ${tokensLinked} placed hero token(s) linked.`);
  }
  if (heroesLinked || tokensLinked) {
    ui.notifications?.info(game.i18n.format("SWIA.TokenBars.Linked", { heroes: heroesLinked, tokens: tokensLinked }));
  }
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

/** Call during init, after any other Actor/Token document subclassing. */
export function registerTokenBars() {
  game.settings.register("swia", MIGRATION_KEY, {
    name: "SWIA Token Bar Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  defineActorClass();
  defineTokenClass();
  configureTrackableAttributes();
  registerCreationHooks();
  registerRefreshHooks();
}
