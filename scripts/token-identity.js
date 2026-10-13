// Hero token identity: first-name token labels and wounded token art that
// survives edits made outside the sheet's Wounded Token picker.
//
// Token names: a hero's map token shows the first word of the actor name
// ("Verena Talos" → "Verena"). Applied to new heroes, renames, and once to
// existing heroes and their placed tokens. A token name the GM set to
// something else by hand is left alone. Heroes only for now; villains and
// allies keep their full names ("E-Web Engineer" would become "E-Web").
//
// Wounded art: wounding copies `system.woundedTokenImage` onto the prototype
// and every placed token, so that field is the source of truth. An edit to
// the prototype token's image made while the hero is wounded (Foundry's
// Prototype Token config, or anything else that writes the prototype) is
// written back to `woundedTokenImage` so the next wound doesn't revert it.

const NAME_MIGRATION_KEY = "tokenNameMigration";
const NAME_MIGRATION_VERSION = "0.1.9-first-names";

/** "Verena Talos" → "Verena"; single-word names are returned unchanged. */
export function heroTokenName(name) {
  const full = String(name ?? "").trim();
  return full.split(/\s+/)[0] || full;
}

/** True when a token name is still one the system set (or Foundry's default). */
function isAutoName(tokenName, actorName) {
  const current = String(tokenName ?? "").trim();
  return !current || current === actorName || current === heroTokenName(actorName);
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function registerNameHooks() {
  // New hero: Foundry has already copied the actor name onto the prototype
  // token by the time this hook runs; shorten it.
  Hooks.on("preCreateActor", (actor) => {
    if (actor.type !== "hero") return;
    const short = heroTokenName(actor.name);
    if (short === actor.name) return;
    if (!isAutoName(actor.prototypeToken?.name, actor.name)) return;
    actor.updateSource({ "prototypeToken.name": short });
  });

  // Rename: follow it on the prototype unless the GM set a custom token name.
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (actor.type !== "hero") return;
    const newName = changes?.name;
    if (typeof newName !== "string" || !newName.trim() || newName === actor.name) return;
    if (!isAutoName(actor.prototypeToken?.name, actor.name)) return;
    foundry.utils.setProperty(changes, "prototypeToken.name", heroTokenName(newName));
    options.swiaRenamedFrom = actor.name;
  });

  // ...and on placed tokens of that hero that still carry an automatic name.
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (actor.type !== "hero" || userId !== game.user?.id) return;
    const oldName = options?.swiaRenamedFrom;
    if (!oldName) return;
    const short = heroTokenName(actor.name);
    for (const scene of game.scenes?.contents ?? []) {
      const updates = (scene.tokens?.contents ?? [])
        .filter((t) => t.actorId === actor.id && t.name !== short
          && (isAutoName(t.name, oldName) || t.name === actor.name))
        .map((t) => ({ _id: t.id, name: short }));
      if (!updates.length) continue;
      try {
        await scene.updateEmbeddedDocuments("Token", updates);
      } catch (err) {
        console.warn("SWIA | Could not rename placed hero tokens", err);
      }
    }
  });
}

function registerWoundedArtHooks() {
  Hooks.on("preUpdateActor", (actor, changes) => {
    if (actor.type !== "hero" || !actor.system?.state?.wounded) return;
    const flat = foundry.utils.flattenObject(changes ?? {});
    const src = flat["prototypeToken.texture.src"];
    if (!src) return;
    // setWoundedState swaps the art together with the state flag, and the
    // sheet's own picker writes woundedTokenImage itself: leave those alone.
    if ("system.state.wounded" in flat || "system.woundedTokenImage" in flat) return;
    if (src === actor.system.woundedTokenImage) return;
    foundry.utils.setProperty(changes, "system.woundedTokenImage", src);
  });
}

/* ------------------------------------------------------------------ */
/* World migration                                                     */
/* ------------------------------------------------------------------ */

/**
 * Once per world (GM): shorten every hero's prototype token name and the
 * names of their placed tokens, where the name is still the full actor name.
 */
export async function migrateHeroTokenNames() {
  if (!game.user?.isGM) return;
  if (game.settings.get("swia", NAME_MIGRATION_KEY) === NAME_MIGRATION_VERSION) return;

  let renamed = 0;
  const heroes = (game.actors?.contents ?? []).filter((a) => a.type === "hero");

  const actorUpdates = heroes
    .filter((a) => heroTokenName(a.name) !== a.name && (a.prototypeToken?.name ?? a.name) === a.name)
    .map((a) => ({ _id: a.id, "prototypeToken.name": heroTokenName(a.name) }));
  if (actorUpdates.length) {
    await Actor.updateDocuments(actorUpdates);
    renamed += actorUpdates.length;
  }

  const heroById = new Map(heroes.map((a) => [a.id, a]));
  for (const scene of game.scenes?.contents ?? []) {
    const updates = [];
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      const hero = heroById.get(tokenDoc.actorId);
      if (!hero) continue;
      const short = heroTokenName(hero.name);
      if (short === hero.name || tokenDoc.name !== hero.name) continue;
      updates.push({ _id: tokenDoc.id, name: short });
    }
    if (!updates.length) continue;
    await scene.updateEmbeddedDocuments("Token", updates);
    renamed += updates.length;
  }

  await game.settings.set("swia", NAME_MIGRATION_KEY, NAME_MIGRATION_VERSION);
  if (renamed) {
    console.log(`SWIA | Shortened ${renamed} hero token name(s) to first names.`);
    ui.notifications?.info(game.i18n.format("SWIA.TokenNames.Migrated", { count: renamed }));
  }
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

/** Call during init. */
export function registerTokenIdentity() {
  game.settings.register("swia", NAME_MIGRATION_KEY, {
    name: "SWIA Hero Token Name Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  registerNameHooks();
  registerWoundedArtHooks();
}
