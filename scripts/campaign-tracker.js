// Foundry v13+ ApplicationV2 base
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApplication = HandlebarsApplicationMixin(ApplicationV2);

export const CAMPAIGN_RESOURCES_KEY = "campaignResources";
const HERO_XP_FIELD_PREFIX = "heroXp.";
const DEFAULT_CAMPAIGN_RESOURCES = Object.freeze({
  credits: 0,
  imperialInfluence: 0,
  threatLevel: 0,
  threat: 0,
  imperialXp: 0,
  xp: 0,
  requisition: 0
});

function normalizeResourceValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) return 0;
  return Math.floor(numericValue);
}

const MISSION_TYPES = ["story", "side"];
const MISSION_OUTCOMES = ["pending", "rebels", "imperials"];

function normalizeMission(mission) {
  const m = mission && typeof mission === "object" ? mission : {};
  return {
    id: typeof m.id === "string" && m.id ? m.id : foundry.utils.randomID(),
    name: typeof m.name === "string" ? m.name : "",
    type: MISSION_TYPES.includes(m.type) ? m.type : "story",
    outcome: MISSION_OUTCOMES.includes(m.outcome) ? m.outcome : "pending",
    allyUnlocked: typeof m.allyUnlocked === "string" ? m.allyUnlocked : ""
  };
}

function normalizeMissions(value) {
  const arr = Array.isArray(value) ? value : Object.values(value ?? {});
  return arr.map(normalizeMission);
}

export function getCampaignResources() {
  const storedResources = game.settings.get("swia", CAMPAIGN_RESOURCES_KEY) ?? {};
  return {
    credits: normalizeResourceValue(storedResources.credits ?? DEFAULT_CAMPAIGN_RESOURCES.credits),
    imperialInfluence: normalizeResourceValue(storedResources.imperialInfluence ?? DEFAULT_CAMPAIGN_RESOURCES.imperialInfluence),
    threatLevel: normalizeResourceValue(storedResources.threatLevel ?? DEFAULT_CAMPAIGN_RESOURCES.threatLevel),
    threat: normalizeResourceValue(storedResources.threat ?? DEFAULT_CAMPAIGN_RESOURCES.threat),
    imperialXp: normalizeResourceValue(storedResources.imperialXp ?? DEFAULT_CAMPAIGN_RESOURCES.imperialXp),
    xp: normalizeResourceValue(storedResources.xp ?? DEFAULT_CAMPAIGN_RESOURCES.xp),
    requisition: normalizeResourceValue(storedResources.requisition ?? DEFAULT_CAMPAIGN_RESOURCES.requisition),
    missions: normalizeMissions(storedResources.missions)
  };
}

function getOrderedHeroActors() {
  const actors = game.actors?.contents ?? [];
  return actors
    .filter((actor) => actor?.type === "hero")
    .sort((a, b) => (a?.name ?? "").localeCompare((b?.name ?? "")));
}

function getHeroXpEntries() {
  return getOrderedHeroActors().map((actor) => ({
    id: actor.id,
    name: actor.name ?? game.i18n.localize("SWIA.Actor.Hero"),
    xp: normalizeResourceValue(actor.system?.xp)
  }));
}

export class SWIACampaignTracker extends BaseApplication {
  static DEFAULT_OPTIONS = {
    id: "swia-campaign-tracker",
    classes: ["swia-campaign-tracker-window"],
    tag: "section",
    position: {
      width: 520,
      height: 560
    },
    window: {
      title: "SWIA.CampaignTracker.Title",
      icon: "fas fa-coins"
    },
    actions: {
      saveResources: SWIACampaignTracker.prototype._onSaveResources,
      addMission: SWIACampaignTracker.prototype._onAddMission,
      removeMission: SWIACampaignTracker.prototype._onRemoveMission
    }
  };

  static PARTS = {
    main: {
      template: "systems/swia/templates/campaign/campaign-tracker.hbs"
    }
  };

  constructor(...args) {
    super(...args);
    this._syncHooks = [];
    this._refreshHandle = null;
    this._registerSyncHooks();
  }

  get title() {
    return game.i18n.localize("SWIA.CampaignTracker.Title");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const trackerContext = await this._buildContext();
    return foundry.utils.mergeObject(context, trackerContext);
  }

  async _buildContext() {
    const resources = getCampaignResources();
    return {
      title: game.i18n.localize("SWIA.CampaignTracker.Title"),
      subtitle: game.i18n.localize("SWIA.CampaignTracker.Subtitle"),
      resources,
      missions: resources.missions,
      heroXpEntries: getHeroXpEntries(),
      canEdit: Boolean(game.user?.isGM)
    };
  }

  _registerSyncHooks() {
    const watch = (hook, fn) => {
      const id = Hooks.on(hook, fn);
      this._syncHooks.push([hook, id]);
    };

    watch("updateSetting", (setting) => {
      if (setting?.key !== `swia.${CAMPAIGN_RESOURCES_KEY}`) return;
      this._queueRefresh();
    });

    watch("updateActor", () => this._queueRefresh());
    watch("createActor", () => this._queueRefresh());
    watch("deleteActor", () => this._queueRefresh());
  }

  _unregisterSyncHooks() {
    for (const [hook, id] of this._syncHooks) {
      Hooks.off(hook, id);
    }
    this._syncHooks = [];

    if (this._refreshHandle) {
      clearTimeout(this._refreshHandle);
      this._refreshHandle = null;
    }
  }

  _queueRefresh() {
    if (!this.rendered) return;

    if (this._refreshHandle) {
      clearTimeout(this._refreshHandle);
    }

    this._refreshHandle = setTimeout(() => {
      this._refreshHandle = null;
      this.render(false);
    }, 50);
  }

  /**
   * Scrape mission rows from the rendered form. Returns null when the missions
   * section isn't present (so callers can fall back to stored data) and an
   * array otherwise — including [] when all rows were removed.
   */
  _collectMissionsFromForm(form) {
    const root = form ?? this.element?.querySelector?.("form") ?? null;
    if (!root || !root.querySelector(".tracker-missions")) return null;

    const missions = [];
    root.querySelectorAll(".tracker-mission-row[data-mission-id]").forEach((row) => {
      missions.push(normalizeMission({
        id: row.dataset.missionId,
        name: row.querySelector(".mission-name")?.value ?? "",
        type: row.querySelector(".mission-type")?.value,
        outcome: row.querySelector(".mission-outcome")?.value,
        allyUnlocked: row.querySelector(".mission-ally")?.value ?? ""
      }));
    });
    return missions;
  }

  async _saveMissions(missions) {
    const existing = game.settings.get("swia", CAMPAIGN_RESOURCES_KEY) ?? {};
    await game.settings.set("swia", CAMPAIGN_RESOURCES_KEY, { ...existing, missions });
  }

  async _onAddMission(event, target) {
    event.preventDefault();
    if (!game.user?.isGM) return;

    const trigger = target ?? event.currentTarget;
    const form = trigger?.closest?.("form") ?? null;
    // Preserve unsaved edits in existing rows before adding the new one.
    const missions = this._collectMissionsFromForm(form) ?? getCampaignResources().missions;
    missions.push(normalizeMission({}));
    await this._saveMissions(missions);
  }

  async _onRemoveMission(event, target) {
    event.preventDefault();
    if (!game.user?.isGM) return;

    const trigger = target ?? event.currentTarget;
    const missionId = trigger?.dataset?.missionId;
    if (!missionId) return;

    const form = trigger?.closest?.("form") ?? null;
    const missions = this._collectMissionsFromForm(form) ?? getCampaignResources().missions;
    await this._saveMissions(missions.filter((mission) => mission.id !== missionId));
  }

  async _onSaveResources(event, target) {
    event.preventDefault();

    if (!game.user?.isGM) return;

    const trigger = target ?? event.currentTarget;
    const form = trigger?.closest?.("form") ?? null;
    if (!form) return;

    const formData = new FormData(form);
    const resources = {
      credits: normalizeResourceValue(formData.get("credits")),
      imperialInfluence: normalizeResourceValue(formData.get("imperialInfluence")),
      threatLevel: normalizeResourceValue(formData.get("threatLevel")),
      threat: normalizeResourceValue(formData.get("threat")),
      imperialXp: normalizeResourceValue(formData.get("imperialXp")),
      xp: normalizeResourceValue(formData.get("xp")),
      requisition: normalizeResourceValue(formData.get("requisition"))
    };

    const heroXpById = new Map();
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith(HERO_XP_FIELD_PREFIX)) continue;
      const actorId = key.slice(HERO_XP_FIELD_PREFIX.length);
      if (!actorId) continue;
      heroXpById.set(actorId, normalizeResourceValue(value));
    }

    const heroUpdates = [];
    for (const hero of getOrderedHeroActors()) {
      if (!heroXpById.has(hero.id)) continue;
      const nextXp = heroXpById.get(hero.id);
      const currentXp = normalizeResourceValue(hero.system?.xp);
      if (nextXp === currentXp) continue;
      heroUpdates.push(hero.update({ "system.xp": nextXp }));
    }

    // Merge with the stored setting so unknown fields are preserved.
    // Missions are scraped from the rendered rows when the section is present.
    const missions = this._collectMissionsFromForm(form);
    const existing = game.settings.get("swia", CAMPAIGN_RESOURCES_KEY) ?? {};
    await game.settings.set("swia", CAMPAIGN_RESOURCES_KEY, {
      ...existing,
      ...resources,
      ...(missions !== null ? { missions } : {})
    });

    const heroUpdateResults = await Promise.allSettled(heroUpdates);
    const failedHeroUpdates = heroUpdateResults.filter((result) => result.status === "rejected");
    if (failedHeroUpdates.length > 0) {
      console.error("SWIA: One or more hero XP updates failed", failedHeroUpdates);
      ui.notifications?.warn(game.i18n.format("SWIA.CampaignTracker.SavedWithHeroErrors", {
        count: failedHeroUpdates.length
      }));
      return;
    }

    ui.notifications?.info(game.i18n.localize("SWIA.CampaignTracker.Saved"));
  }

  async close(options) {
    this._unregisterSyncHooks();
    return super.close?.(options);
  }
}
