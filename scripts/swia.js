/* eslint-disable no-console */
// Entry point for SWIA system

import { SWIAActorSheet } from "./sheets/swia-actor-sheet.js";

const BaseActorSheet = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;
const loadTemplatesFn = foundry?.applications?.handlebars?.loadTemplates ?? loadTemplates;
const ActorsCollection = foundry?.documents?.collections?.Actors ?? Actors;

Hooks.once("init", async function initSWIA() {
  console.log("SWIA | Initializing Star Wars Imperial Assault system");

  Handlebars.registerHelper("capitalize", (value) => {
    if (typeof value !== "string") return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  });

  // Helper to create array of specific length for iteration
  Handlebars.registerHelper("range", (count) => {
    const num = parseInt(count) || 0;
    if (num <= 0) return [];
    return Array.from({ length: num }, (_, i) => i);
  });

  // Helper for equality comparison
  Handlebars.registerHelper("eq", (a, b) => a === b);

  // Helper for logical OR
  Handlebars.registerHelper("or", (a, b) => a || b);

  // Define system namespace
  game.swia = {
    sheets: {},
    config: {}
  };

  // Preload templates
  await loadTemplatesFn([
    "systems/swia/templates/actors/actor-sheet.hbs"
  ]);

  // Register actor sheets
  ActorsCollection.unregisterSheet("core", BaseActorSheet);
  ActorsCollection.registerSheet("swia", SWIAActorSheet, {
    types: ["hero", "imperial", "ally"],
    makeDefault: true
  });
});
