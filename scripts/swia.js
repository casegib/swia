/* eslint-disable no-console */
// Entry point for SWIA system

import { SWIAActorSheet } from "./sheets/swia-actor-sheet.js";
import { SWIAItemSheet } from "./sheets/swia-item-sheet.js";
import { SWIAPlayerPortal } from "./player-portal.js";
import { SWIACompanionPortal } from "./companion-portal.js";
import { SWIAImperialPortal } from "./imperial-portal.js";
import { SWIAGMPortal } from "./gm-portal.js";
import { SWIACampaignTracker } from "./campaign-tracker.js";

// Get appropriate base class for V1/V2 compatibility
const BaseActorSheet = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;
const BaseItemSheet = foundry.appv1?.sheets?.ItemSheet ?? ItemSheet;
const loadTemplatesFn = foundry?.applications?.handlebars?.loadTemplates ?? loadTemplates;
const ActorsCollection = foundry?.documents?.collections?.Actors ?? Actors;
const ItemsCollection = foundry?.documents?.collections?.Items ?? Items;
const LEGACY_ABILITY_MIGRATION_KEY = "schemaMigration";
const LEGACY_ABILITY_MIGRATION_VERSION = "0.0.5-ability-to-classcard";
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

// Defined at module scope so both init and setup hooks can apply it,
// ensuring it survives any module init hooks that overwrite CONFIG.statusEffects.
const SWIA_STATUS_EFFECTS = [
  // Combat Conditions
  { id: "weakened", name: "SWIA.Conditions.Weakened", icon: "systems/swia/icons/Weaken.png" },
  { id: "stunned",  name: "SWIA.Conditions.Stunned",  icon: "systems/swia/icons/Stunned.png" },
  { id: "bleeding", name: "SWIA.Conditions.Bleeding", icon: "systems/swia/icons/Bleeding.png" },
  { id: "focused",  name: "SWIA.Conditions.Focused",  icon: "systems/swia/icons/Focused.png" },
  { id: "hidden",   name: "SWIA.Conditions.Hidden",   icon: "systems/swia/icons/Hidden.png" },
  { id: "blind",    name: "SWIA.Conditions.Blind",    icon: "systems/swia/icons/Blind.png" },
  { id: "scanned",  name: "SWIA.Conditions.Scanned",  icon: "systems/swia/icons/Scanned.png" },
  { id: "recon",    name: "SWIA.Conditions.Recon",    icon: "systems/swia/icons/Recon.png" },
  { id: "wanted",   name: "SWIA.Conditions.Wanted",   icon: "systems/swia/icons/Wanted.png" },
  // Power Tokens
  { id: "power-block",  name: "SWIA.PowerTokens.BlockToken",  icon: "systems/swia/icons/Power Block Token.png" },
  { id: "power-damage", name: "SWIA.PowerTokens.DamageToken", icon: "systems/swia/icons/Power Damage Token.png" },
  { id: "power-evade",  name: "SWIA.PowerTokens.EvadeToken",  icon: "systems/swia/icons/Power Evade Token.png" },
  { id: "power-surge",  name: "SWIA.PowerTokens.SurgeToken",  icon: "systems/swia/icons/Power Surge Token.png" },
  { id: "power-any",    name: "SWIA.PowerTokens.AnyToken",    icon: "systems/swia/icons/Power Any Token.png" }
];

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

// Initialize system on Foundry ready
Hooks.once("init", async function initSWIA() {
  console.log("SWIA | Initializing Star Wars Imperial Assault system");

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

  // Configure SWIA-specific status effects (conditions and power tokens)
  CONFIG.statusEffects = SWIA_STATUS_EFFECTS;

  // Preload Handlebars templates for actor and item sheets
  await loadTemplatesFn([
    "systems/swia/templates/actors/actor-sheet.hbs",
    "systems/swia/templates/actors/gm-portal.hbs",
    "systems/swia/templates/actors/player-portal.hbs",
    "systems/swia/templates/actors/companion-portal.hbs",
    "systems/swia/templates/actors/imperial-portal.hbs",
    "systems/swia/templates/campaign/campaign-tracker.hbs",
    "systems/swia/templates/items/classcard-sheet.hbs",
    "systems/swia/templates/items/weapon-sheet.hbs",
    "systems/swia/templates/items/gear-sheet.hbs",
    "systems/swia/templates/items/heroability-sheet.hbs"
  ]);

  // Register actor sheets for hero, imperial, and ally types
  ActorsCollection.unregisterSheet("core", BaseActorSheet);
  ActorsCollection.registerSheet("swia", SWIAActorSheet, {
    types: ["hero", "villain", "ally"],
    makeDefault: true
  });

  // Register item sheets
  ItemsCollection.unregisterSheet("core", BaseItemSheet);
  ItemsCollection.registerSheet("swia", SWIAItemSheet, {
    types: ["classcard", "agendacard", "imperialclasscard", "weapon", "gear", "heroability"],
    makeDefault: true
  });
});

// Re-apply status effects in the setup hook, which fires after all module init hooks.
// This ensures no module can overwrite CONFIG.statusEffects after us.
Hooks.once("setup", () => {
  CONFIG.statusEffects = SWIA_STATUS_EFFECTS;
});

Hooks.once("ready", async () => {
  try {
    await migrateLegacyAbilityItems();
  } catch (error) {
    console.error("SWIA | Legacy item migration failed", error);
    ui.notifications?.error("SWIA failed to migrate legacy class card items. Check console for details.");
  }
});

Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user) return;

  const root = html instanceof jQuery ? html : $(html);
  if (root.find(".swia-gm-portal-btn, .swia-player-portal-btn, .swia-companion-portal-btn, .swia-imperial-portal-btn, .swia-campaign-tracker-btn").length) return;

  const buttons = [];

  const gmLabel = game.i18n.localize("SWIA.Portal.GM.Button");
  const gmButton = $(
    `<button
      type="button"
      class="swia-gm-portal-btn"
      aria-label="${gmLabel}"
      title="${gmLabel}"
    >
      <i class="fa-solid fa-user-shield" aria-hidden="true"></i>
    </button>`
  );

  gmButton.on("click", () => {
    new SWIAGMPortal().render(true);
  });

  buttons.push(gmButton);

  const playerLabel = game.i18n.localize("SWIA.Portal.Button");
  const playerButton = $(
    `<button
      type="button"
      class="swia-player-portal-btn"
      aria-label="${playerLabel}"
      title="${playerLabel}"
    >
      <i class="fa-brands fa-rebel" aria-hidden="true"></i>
    </button>`
  );

  playerButton.on("click", () => {
    new SWIAPlayerPortal().render(true);
  });

  buttons.push(playerButton);

  const companionLabel = game.i18n.localize("SWIA.Portal.Companion.Button");
  const companionButton = $(
    `<button
      type="button"
      class="swia-companion-portal-btn"
      aria-label="${companionLabel}"
      title="${companionLabel}"
    >
      <i class="fa-solid fa-robot-astromech" aria-hidden="true"></i>
    </button>`
  );

  companionButton.on("click", () => {
    new SWIACompanionPortal().render(true);
  });

  buttons.push(companionButton);

  const imperialLabel = game.i18n.localize("SWIA.Portal.Imperial.Button");
  const imperialButton = $(
    `<button
      type="button"
      class="swia-imperial-portal-btn"
      aria-label="${imperialLabel}"
      title="${imperialLabel}"
    >
      <i class="fa-brands fa-empire" aria-hidden="true"></i>
    </button>`
  );

  imperialButton.on("click", () => {
    new SWIAImperialPortal().render(true);
  });

  buttons.push(imperialButton);

  const campaignTrackerLabel = game.i18n.localize("SWIA.CampaignTracker.Button");
  const campaignTrackerButton = $(
    `<button
      type="button"
      class="swia-campaign-tracker-btn"
      aria-label="${campaignTrackerLabel}"
      title="${campaignTrackerLabel}"
    >
      <i class="fa-solid fa-coins" aria-hidden="true"></i>
    </button>`
  );

  campaignTrackerButton.on("click", () => {
    new SWIACampaignTracker().render(true);
  });

  buttons.push(campaignTrackerButton);

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
