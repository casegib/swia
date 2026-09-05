/* eslint-disable no-console */
// Entry point for SWIA system

import { SWIAActorSheet } from "./sheets/swia-actor-sheet.js";
import { SWIACharacterSheet } from "./sheets/swia-character-sheet.js";
import { SWIAObjectSheet } from "./sheets/swia-object-sheet.js";
import { SWIAItemSheet } from "./sheets/swia-item-sheet.js";
import { SWIAPlayerPortal } from "./player-portal.js";
import { SWIACompanionPortal } from "./companion-portal.js";
import { SWIAImperialPortal } from "./imperial-portal.js";
import { SWIAGMPortal } from "./gm-portal.js";
import { SWIACampaignTracker } from "./campaign-tracker.js";
import { HeroData, VillainData, AllyData, CharacterData, ObjectData } from "./data/actors.js";
import {
  WeaponData, WeaponmodData, ArmorData, GearData, ClasscardData,
  AgendacardData, ImperialclasscardData, HeroabilityData, FormcardData
} from "./data/items.js";
import {
  registerDiceTerms, registerDiceSoNice, registerChatRenderHooks, checkLegacyDiceModule
} from "./dice/dice-terms.js";
import { registerRollCardHooks } from "./dice/roll-dialog.js";
import { registerItemTradeHooks } from "./item-trade.js";
import { registerCombatHooks, SWIACombatWindow } from "./dice/combat-window.js";
import { definePowerTokenActorClass, registerPowerTokenBadgeHooks } from "./token-badge.js";
import { registerConditionSettings, rebuildConditionRegistry, applyStatusEffects } from "./conditions.js";
import { statGlyphHTML } from "./data/common.js";

// Foundry v13+ namespaced APIs (system.json minimum is v13)
// The appv1 sheet classes are referenced only to unregister the core-registered defaults.
const CoreActorSheet = foundry.appv1.sheets.ActorSheet;
const CoreItemSheet = foundry.appv1.sheets.ItemSheet;
const loadTemplatesFn = foundry.applications.handlebars.loadTemplates;
const ActorsCollection = foundry.documents.collections.Actors;
const ItemsCollection = foundry.documents.collections.Items;
const LEGACY_ABILITY_MIGRATION_KEY = "schemaMigration";
const LEGACY_ABILITY_MIGRATION_VERSION = "0.0.5-ability-to-classcard";
const CLASS_DECK_MIGRATION_KEY = "classDeckMigration";
// Bumped when the migration learns a new item type (imperial class cards):
// re-running is safe, every patch skips items already carrying the fields.
const CLASS_DECK_MIGRATION_VERSION = "0.1.9-classdeck-flags-2";
const ARMOR_MODIFIER_MIGRATION_KEY = "armorModifierMigration";
const ARMOR_MODIFIER_MIGRATION_VERSION = "0.1.9-armor-modifier";
const CLASS_DECK_ITEM_TYPES = ["weapon", "weaponmod", "armor", "gear"];
const ROUND_STATE_KEY = "roundState";
const DEFAULT_ROUND_STATE = {
  round: 1,
  phase: "activation", // "activation" | "status"
  activationQueue: []  // ordered array of actor IDs, cleared each round
};

const CAMPAIGN_RESOURCES_KEY = "campaignResources";
const DEFAULT_CAMPAIGN_RESOURCES = {
  credits: 0,
  imperialInfluence: 0,
  threatLevel: 0,
  threat: 0,
  imperialXp: 0,
  xp: 0,
  requisition: 0,
  missions: []
};

// Status effects (conditions + power tokens) are owned by scripts/conditions.js;
// applyStatusEffects() runs at init and again at setup so no module init hook
// can overwrite the list.

async function migrateLegacyAbilityItems() {
  if (!game.user?.isGM) return;

  const completedVersion = game.settings.get("swia", LEGACY_ABILITY_MIGRATION_KEY);
  if (completedVersion === LEGACY_ABILITY_MIGRATION_VERSION) return;

  let migratedActors = 0;
  let migratedItems = 0;

  for (const actor of game.actors?.contents ?? []) {
    const legacyItems = actor.items.filter((item) => item.type === "ability");
    if (!legacyItems.length) continue;

    const createData = legacyItems.map((item) => {
      const data = item.toObject();
      delete data._id;
      data.type = "classcard";
      data.system = data.system || {};
      if (typeof data.system.cooldown !== "number") data.system.cooldown = 0;
      return data;
    });

    await actor.createEmbeddedDocuments("Item", createData);
    await actor.deleteEmbeddedDocuments("Item", legacyItems.map((item) => item.id));

    migratedActors += 1;
    migratedItems += legacyItems.length;
  }

  await game.settings.set("swia", LEGACY_ABILITY_MIGRATION_KEY, LEGACY_ABILITY_MIGRATION_VERSION);

  if (migratedItems > 0) {
    console.log(`SWIA | Migrated ${migratedItems} legacy ability items on ${migratedActors} actor(s).`);
    ui.notifications?.info(`SWIA migrated ${migratedItems} legacy class card item(s).`);
  }
}

/**
 * Imperial class cards from the 0.1.8 packs carry their class in flags and
 * say "Attachment." in their text; lift both into the schema. Returns the
 * update patch, or null when the card already has its class set.
 */
function imperialCardPatch(item, flags) {
  if (item.system?.imperialClass) return null;
  const imperialClass = flags?.imperialClass;
  if (!imperialClass) return null;
  const xp = Number(flags?.classXp);
  const text = String(item.system?.description ?? "").replace(/<[^>]+>/g, "").trim();
  return {
    _id: item.id,
    "system.imperialClass": imperialClass,
    "system.classXp": Number.isFinite(xp) ? xp : 0,
    "system.attachment": /^attachment\b/i.test(text)
  };
}

/**
 * Class-deck equipment imported from the 0.1.8 packs carries its deck tag in
 * `flags.swia.{heroClass,classXp}` only. Lift it into the schema fields so
 * the hero sheet can list those items under Class Cards. Runs once per
 * world; items with `system.heroClass` already set are left alone.
 */
async function migrateClassDeckFlags() {
  if (!game.user?.isGM) return;
  if (game.settings.get("swia", CLASS_DECK_MIGRATION_KEY) === CLASS_DECK_MIGRATION_VERSION) return;

  const patchFor = (item) => {
    if (item.type === "imperialclasscard") return imperialCardPatch(item, item.flags?.swia ?? {});
    if (!CLASS_DECK_ITEM_TYPES.includes(item.type)) return null;
    if (item.system?.heroClass) return null;
    const heroClass = item.getFlag("swia", "heroClass");
    if (!heroClass) return null;
    const xp = Number(item.getFlag("swia", "classXp"));
    return { _id: item.id, "system.heroClass": heroClass, "system.classXp": Number.isFinite(xp) ? xp : 0 };
  };

  let migrated = 0;
  const worldUpdates = (game.items?.contents ?? []).map(patchFor).filter(Boolean);
  if (worldUpdates.length) {
    await Item.updateDocuments(worldUpdates);
    migrated += worldUpdates.length;
  }
  for (const actor of game.actors?.contents ?? []) {
    const updates = actor.items.map(patchFor).filter(Boolean);
    if (!updates.length) continue;
    await actor.updateEmbeddedDocuments("Item", updates);
    migrated += updates.length;
  }

  await game.settings.set("swia", CLASS_DECK_MIGRATION_KEY, CLASS_DECK_MIGRATION_VERSION);
  if (migrated > 0) {
    console.log(`SWIA | Tagged ${migrated} class-deck equipment item(s) from pack flags.`);
    ui.notifications?.info(`SWIA tagged ${migrated} class-deck equipment item(s).`);
  }
}

/**
 * 0.1.8 armor stored its printed effects as bonusHealth / bonusBlock /
 * bonusEvade. ArmorData.migrateData folds them into `modifier` in memory
 * on every load; this writes the fold back once, per world, so the stale
 * fields are gone from the database (otherwise an armor edited to 0 Health
 * would re-migrate to its old value on the next reload).
 */
async function migrateArmorModifiers() {
  if (!game.user?.isGM) return;
  if (game.settings.get("swia", ARMOR_MODIFIER_MIGRATION_KEY) === ARMOR_MODIFIER_MIGRATION_VERSION) return;

  // migrateData has already stripped the legacy keys from the in-memory
  // source, so there is nothing to test against: write every armor item
  // once (deleting an absent key with -= is a no-op).
  const patchFor = (item) => {
    if (item.type !== "armor") return null;
    const mod = item.system?.modifier ?? {};
    return {
      _id: item.id,
      "system.modifier.stats.health": Number(mod.stats?.health) || 0,
      "system.modifier.defense.block": Number(mod.defense?.block) || 0,
      "system.modifier.defense.evade": Number(mod.defense?.evade) || 0,
      "system.-=bonusHealth": null,
      "system.-=bonusBlock": null,
      "system.-=bonusEvade": null
    };
  };

  let migrated = 0;
  const worldUpdates = (game.items?.contents ?? []).map(patchFor).filter(Boolean);
  if (worldUpdates.length) {
    await Item.updateDocuments(worldUpdates);
    migrated += worldUpdates.length;
  }
  for (const actor of game.actors?.contents ?? []) {
    const updates = actor.items.map(patchFor).filter(Boolean);
    if (!updates.length) continue;
    await actor.updateEmbeddedDocuments("Item", updates);
    migrated += updates.length;
  }

  await game.settings.set("swia", ARMOR_MODIFIER_MIGRATION_KEY, ARMOR_MODIFIER_MIGRATION_VERSION);
  if (migrated > 0) console.log(`SWIA | Moved ${migrated} armor item(s) onto the shared modifier.`);
}

// Initialize system on Foundry ready
Hooks.once("init", async function initSWIA() {
  console.log("SWIA | Initializing Star Wars Imperial Assault system");

  // Register IA dice terms + chat/DSN/roll-card hooks (Phase 5)
  registerDiceTerms();
  registerDiceSoNice();
  registerChatRenderHooks();
  registerRollCardHooks();
  registerItemTradeHooks();
  checkLegacyDiceModule();
  registerCombatHooks();

  // Power tokens: hidden from the stock status strip, drawn as a count badge
  // on the map token instead (scripts/token-badge.js)
  definePowerTokenActorClass();
  registerPowerTokenBadgeHooks();

  // Register system data models (schemas live here; document types are declared in system.json)
  Object.assign(CONFIG.Actor.dataModels, {
    hero: HeroData,
    villain: VillainData,
    ally: AllyData,
    character: CharacterData,
    object: ObjectData
  });
  Object.assign(CONFIG.Item.dataModels, {
    weapon: WeaponData,
    weaponmod: WeaponmodData,
    armor: ArmorData,
    gear: GearData,
    classcard: ClasscardData,
    agendacard: AgendacardData,
    imperialclasscard: ImperialclasscardData,
    heroability: HeroabilityData,
    formcard: FormcardData
  });

  // Register custom Handlebars helpers for template rendering
  Handlebars.registerHelper("capitalize", (value) => {
    if (typeof value !== "string") return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  });

  // Helper to create array of specific length for iteration (e.g., rendering dice blocks)
  Handlebars.registerHelper("range", (count) => {
    const num = parseInt(count) || 0;
    if (num <= 0) return [];
    return Array.from({ length: num }, (_, i) => i);
  });

  // Helper for equality comparison in templates
  Handlebars.registerHelper("eq", (a, b) => a === b);

  // Helper for logical OR in templates
  Handlebars.registerHelper("or", (a, b) => a || b);

  // Helper for greater-than comparison in templates
  Handlebars.registerHelper("gt", (a, b) => a > b);

  // Inline stat glyph (icon with the stat name in alt/title): {{{swiaGlyph "damage"}}}
  Handlebars.registerHelper("swiaGlyph", (stat) => new Handlebars.SafeString(statGlyphHTML(stat)));

  // Define system namespace for shared data and config
  game.swia = {
    sheets: {},
    config: {}
  };

  game.settings.register("swia", LEGACY_ABILITY_MIGRATION_KEY, {
    name: "SWIA Schema Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register("swia", CLASS_DECK_MIGRATION_KEY, {
    name: "SWIA Class-Deck Tag Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register("swia", ARMOR_MODIFIER_MIGRATION_KEY, {
    name: "SWIA Armor Modifier Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  // Table rule: buying a class card by dropping it on a hero spends its XP.
  game.settings.register("swia", "deductClassCardXp", {
    name: "SWIA.Settings.DeductClassCardXp.Name",
    hint: "SWIA.Settings.DeductClassCardXp.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register("swia", ROUND_STATE_KEY, {
    name: "SWIA Round State",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_ROUND_STATE
  });

  game.settings.register("swia", CAMPAIGN_RESOURCES_KEY, {
    name: "SWIA Campaign Resources",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_CAMPAIGN_RESOURCES
  });

  // Conditions: registry (built-ins + the custom world setting) and the
  // GM settings menu; then the status-effect list they feed.
  registerConditionSettings();
  rebuildConditionRegistry();
  applyStatusEffects();

  // Preload Handlebars templates for actor and item sheets
  await loadTemplatesFn([
    "systems/swia/templates/actors/actor-sheet.hbs",
    "systems/swia/templates/actors/character-sheet.hbs",
    "systems/swia/templates/actors/object-sheet.hbs",
    "systems/swia/templates/actors/gm-portal.hbs",
    "systems/swia/templates/actors/player-portal.hbs",
    "systems/swia/templates/actors/companion-portal.hbs",
    "systems/swia/templates/actors/imperial-portal.hbs",
    "systems/swia/templates/campaign/campaign-tracker.hbs",
    "systems/swia/templates/items/classcard-sheet.hbs",
    "systems/swia/templates/items/weapon-sheet.hbs",
    "systems/swia/templates/items/weaponmod-sheet.hbs",
    "systems/swia/templates/items/armor-sheet.hbs",
    "systems/swia/templates/items/gear-sheet.hbs",
    "systems/swia/templates/items/heroability-sheet.hbs",
    "systems/swia/templates/items/formcard-sheet.hbs",
    "systems/swia/templates/dice/roll-dialog.hbs",
    "systems/swia/templates/dice/roll-card.hbs",
    "systems/swia/templates/dice/combat-window.hbs",
    "systems/swia/templates/settings/conditions-config.hbs",
    "systems/swia/templates/actors/parts/condition-tray.hbs",
    "systems/swia/templates/items/parts/modifier-editor.hbs"
  ]);

  // Register actor sheets for hero, villain, and ally types
  ActorsCollection.unregisterSheet("core", CoreActorSheet);
  ActorsCollection.registerSheet("swia", SWIAActorSheet, {
    types: ["hero", "villain", "ally"],
    makeDefault: true
  });
  
  // Register separate sheet for Character type
  ActorsCollection.registerSheet("swia", SWIACharacterSheet, {
    types: ["character"],
    makeDefault: true
  });

  // Register separate sheet for Object type
  ActorsCollection.registerSheet("swia", SWIAObjectSheet, {
    types: ["object"],
    makeDefault: true
  });

  // Register item sheets
  ItemsCollection.unregisterSheet("core", CoreItemSheet);
  ItemsCollection.registerSheet("swia", SWIAItemSheet, {
    types: ["classcard", "agendacard", "imperialclasscard", "weapon", "weaponmod", "armor", "gear", "heroability", "formcard"],
    makeDefault: true
  });
});

// Re-apply status effects in the setup hook, which fires after all module init hooks.
// This ensures no module can overwrite CONFIG.statusEffects after us.
Hooks.once("setup", () => {
  applyStatusEffects();
});

/**
 * Packs built before the class-deck tag lived in the schema carry it only in
 * `flags.swia.{heroClass,classXp}`. Lift it as the item is created (world
 * import, drag onto an actor, hero starters arriving with a hero) so stale
 * packs keep working without a rebuild. The ready-hook migration covers
 * items that were already in the world.
 */
Hooks.on("preCreateItem", (item, data) => {
  if (item.type === "imperialclasscard") {
    const patch = imperialCardPatch(item, data?.flags?.swia);
    if (patch) { delete patch._id; item.updateSource(patch); }
    return;
  }
  if (!CLASS_DECK_ITEM_TYPES.includes(item.type)) return;
  if (item.system?.heroClass) return;
  const heroClass = data?.flags?.swia?.heroClass;
  if (!heroClass) return;
  const xp = Number(data.flags.swia.classXp);
  item.updateSource({ "system.heroClass": heroClass, "system.classXp": Number.isFinite(xp) ? xp : 0 });
});

Hooks.once("ready", async () => {
  try {
    await migrateLegacyAbilityItems();
  } catch (error) {
    console.error("SWIA | Legacy item migration failed", error);
    ui.notifications?.error("SWIA failed to migrate legacy class card items. Check console for details.");
  }
  try {
    await migrateClassDeckFlags();
  } catch (error) {
    console.error("SWIA | Class-deck tag migration failed", error);
    ui.notifications?.error("SWIA failed to tag class-deck equipment. Check console for details.");
  }
  try {
    await migrateArmorModifiers();
  } catch (error) {
    console.error("SWIA | Armor modifier migration failed", error);
  }
});

/**
 * Apply Character preferred disposition to newly created tokens
 */
Hooks.on("preCreateToken", (token, data, options, userId) => {
  if (!token.actor) return;
  
  // Only apply disposition for Character actor type
  if (token.actor.type !== "character") return;
  
  // Apply preferred disposition to token data, respecting the shown/hidden toggle
  const preferredDisposition = token.actor.system.preferredDisposition || "neutral";
  const dispositionShown = token.actor.getFlag("swia", "dispositionShown") ?? false;
  const effectiveDisposition = dispositionShown ? preferredDisposition : "neutral";

  // Convert preferred disposition to Foundry token disposition value:
  // "friendly" = 1, "neutral" = 0, "hostile" = -1
  const dispositionMap = {
    friendly: 1,
    neutral: 0,
    hostile: -1
  };

  data.disposition = dispositionMap[effectiveDisposition] ?? 0;
});

Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user) return;

  const root = html instanceof jQuery ? html : $(html);
  if (root.find(".swia-gm-portal-btn, .swia-player-portal-btn, .swia-companion-portal-btn, .swia-imperial-portal-btn, .swia-campaign-tracker-btn, .swia-combat-window-btn").length) return;

  const buttons = [];
  const buildDirectoryButton = ({ buttonClass, label, iconClass, onClick }) => {
    const button = $("<button>")
      .attr({
        type: "button",
        class: buttonClass,
        "aria-label": label,
        title: label
      });
    $("<i>")
      .addClass(iconClass)
      .attr("aria-hidden", "true")
      .appendTo(button);
    button.on("click", onClick);
    return button;
  };

  if (game.user.isGM) {
    buttons.push(buildDirectoryButton({
      buttonClass: "swia-gm-portal-btn",
      label: game.i18n.localize("SWIA.Portal.GM.Button"),
      iconClass: "fa-solid fa-user-shield",
      onClick: () => new SWIAGMPortal().render(true)
    }));
  }

  buttons.push(buildDirectoryButton({
    buttonClass: "swia-player-portal-btn",
    label: game.i18n.localize("SWIA.Portal.Button"),
    iconClass: "fa-brands fa-rebel",
    onClick: () => new SWIAPlayerPortal().render(true)
  }));

  buttons.push(buildDirectoryButton({
    buttonClass: "swia-companion-portal-btn",
    label: game.i18n.localize("SWIA.Portal.Companion.Button"),
    iconClass: "fa-solid fa-robot-astromech",
    onClick: () => new SWIACompanionPortal().render(true)
  }));

  if (game.user.isGM) {
    buttons.push(buildDirectoryButton({
      buttonClass: "swia-imperial-portal-btn",
      label: game.i18n.localize("SWIA.Portal.Imperial.Button"),
      iconClass: "fa-brands fa-empire",
      onClick: () => new SWIAImperialPortal().render(true)
    }));
  }

  buttons.push(buildDirectoryButton({
    buttonClass: "swia-campaign-tracker-btn",
    label: game.i18n.localize("SWIA.CampaignTracker.Button"),
    iconClass: "fa-solid fa-coins",
    onClick: () => new SWIACampaignTracker().render(true)
  }));

  buttons.push(buildDirectoryButton({
    buttonClass: "swia-combat-window-btn",
    label: game.i18n.localize("SWIA.Combat.Button"),
    iconClass: "fa-solid fa-crosshairs",
    onClick: () => SWIACombatWindow.show()
  }));

  const headerActions = root.find(".header-actions").first();
  if (headerActions.length) {
    buttons.forEach((button) => headerActions.append(button));
    return;
  }

  const directoryFooter = root.find(".directory-footer").first();
  if (directoryFooter.length) {
    buttons.forEach((button) => directoryFooter.append(button));
    return;
  }

  buttons.slice().reverse().forEach((button) => root.prepend(button));
});
