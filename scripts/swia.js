/* eslint-disable no-console */
// Entry point for SWIA system

import { SWIAActorSheet } from "./sheets/swia-actor-sheet.js";

// Get appropriate base class for V1/V2 compatibility
const BaseActorSheet = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;
const loadTemplatesFn = foundry?.applications?.handlebars?.loadTemplates ?? loadTemplates;
const ActorsCollection = foundry?.documents?.collections?.Actors ?? Actors;

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

  // Define system namespace for shared data and config
  game.swia = {
    sheets: {},
    config: {}
  };

  // Configure SWIA-specific status effects (conditions and power tokens)
  CONFIG.statusEffects = [
    // Combat Conditions
    {
      id: "weakened",
      name: "SWIA.Conditions.Weakened",
      icon: "systems/swia/icons/Weaken.png"
    },
    {
      id: "stunned",
      name: "SWIA.Conditions.Stunned",
      icon: "systems/swia/icons/Stunned.png"
    },
    {
      id: "bleeding",
      name: "SWIA.Conditions.Bleeding",
      icon: "systems/swia/icons/Bleeding.png"
    },
    {
      id: "focused",
      name: "SWIA.Conditions.Focused",
      icon: "systems/swia/icons/Focused.png"
    },
    {
      id: "hidden",
      name: "SWIA.Conditions.Hidden",
      icon: "systems/swia/icons/Hidden.png"
    },
    {
      id: "blind",
      name: "SWIA.Conditions.Blind",
      icon: "systems/swia/icons/Blind.png"
    },
    // Power Tokens - can stack on actors
    {
      id: "power-block",
      name: "SWIA.PowerTokens.BlockToken",
      icon: "systems/swia/icons/Power Block Token.png"
    },
    {
      id: "power-damage",
      name: "SWIA.PowerTokens.DamageToken",
      icon: "systems/swia/icons/Power Damage Token.png"
    },
    {
      id: "power-evade",
      name: "SWIA.PowerTokens.EvadeToken",
      icon: "systems/swia/icons/Power Evade Token.png"
    },
    {
      id: "power-surge",
      name: "SWIA.PowerTokens.SurgeToken",
      icon: "systems/swia/icons/Power Surge Token.png"
    },
    {
      id: "power-any",
      name: "SWIA.PowerTokens.AnyToken",
      icon: "systems/swia/icons/Power Any Token.png"
    }
  ];

  // Preload Handlebars templates for actor sheet
  await loadTemplatesFn([
    "systems/swia/templates/actors/actor-sheet.hbs"
  ]);

  // Register actor sheets for hero, imperial, and ally types
  ActorsCollection.unregisterSheet("core", BaseActorSheet);
  ActorsCollection.registerSheet("swia", SWIAActorSheet, {
    types: ["hero", "imperial", "ally"],
    makeDefault: true
  });
});
