const BaseApplicationV2 = foundry.applications?.api?.ApplicationV2;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;
const BaseApplicationV1 = foundry.appv1?.api?.Application ?? Application;

const BaseApplication = BaseApplicationV2 && HandlebarsApplicationMixin
  ? HandlebarsApplicationMixin(BaseApplicationV2)
  : BaseApplicationV1;

const isV2 = !!(BaseApplicationV2 && HandlebarsApplicationMixin);

const CAMPAIGN_RESOURCES_KEY = "campaignResources";
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

export function getCampaignResources() {
  const storedResources = game.settings.get("swia", CAMPAIGN_RESOURCES_KEY) ?? {};
  return {
    credits: normalizeResourceValue(storedResources.credits ?? DEFAULT_CAMPAIGN_RESOURCES.credits),
    imperialInfluence: normalizeResourceValue(storedResources.imperialInfluence ?? DEFAULT_CAMPAIGN_RESOURCES.imperialInfluence),
    threatLevel: normalizeResourceValue(storedResources.threatLevel ?? DEFAULT_CAMPAIGN_RESOURCES.threatLevel),
    threat: normalizeResourceValue(storedResources.threat ?? DEFAULT_CAMPAIGN_RESOURCES.threat),
    imperialXp: normalizeResourceValue(storedResources.imperialXp ?? DEFAULT_CAMPAIGN_RESOURCES.imperialXp),
    xp: normalizeResourceValue(storedResources.xp ?? DEFAULT_CAMPAIGN_RESOURCES.xp),
    requisition: normalizeResourceValue(storedResources.requisition ?? DEFAULT_CAMPAIGN_RESOURCES.requisition)
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
      saveResources: SWIACampaignTracker.prototype._onSaveResources
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

  static get defaultOptions() {
    if (isV2) return {};

    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "swia-campaign-tracker",
      title: game.i18n.localize("SWIA.CampaignTracker.Title"),
      template: "systems/swia/templates/campaign/campaign-tracker.hbs",
      width: 520,
      height: 560,
      resizable: true,
      classes: ["swia-campaign-tracker-window"]
    });
  }

  get title() {
    return game.i18n.localize("SWIA.CampaignTracker.Title");
  }

  get template() {
    return "systems/swia/templates/campaign/campaign-tracker.hbs";
  }

  async _prepareContext(options) {
    const context = isV2 ? await super._prepareContext(options) : {};
    const trackerContext = await this._buildContext();
    return foundry.utils.mergeObject(context, trackerContext);
  }

  async getData(options) {
    if (isV2) return this._prepareContext(options);

    const data = await super.getData(options);
    const trackerContext = await this._buildContext();
    return foundry.utils.mergeObject(data, trackerContext);
  }

  async _buildContext() {
    return {
      title: game.i18n.localize("SWIA.CampaignTracker.Title"),
      subtitle: game.i18n.localize("SWIA.CampaignTracker.Subtitle"),
      resources: getCampaignResources(),
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

  activateListeners(html) {
    super.activateListeners?.(html);
    html.find("[data-action='saveResources']").on("click", this._onSaveResources.bind(this));
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

    await game.settings.set("swia", CAMPAIGN_RESOURCES_KEY, resources);

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