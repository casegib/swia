import { getCampaignResources } from "./campaign-tracker.js";

const BaseApplicationV2 = foundry.applications?.api?.ApplicationV2;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;
const BaseApplicationV1 = foundry.appv1?.api?.Application ?? Application;

const BaseApplication = BaseApplicationV2 && HandlebarsApplicationMixin
  ? HandlebarsApplicationMixin(BaseApplicationV2)
  : BaseApplicationV1;

const isV2 = !!(BaseApplicationV2 && HandlebarsApplicationMixin);

export class SWIAGMPortal extends BaseApplication {
  static DEFAULT_OPTIONS = {
    id: "swia-gm-portal",
    classes: ["swia-gm-portal-window"],
    tag: "section",
    position: {
      width: 1500,
      height: 900
    },
    window: {
      title: "SWIA.Portal.GM.Title",
      icon: "fas fa-user-shield"
    },
    actions: {
      openActor: SWIAGMPortal.prototype._onOpenActor,
      toggleActivated: SWIAGMPortal.prototype._onToggleActivated,
      resetActivations: SWIAGMPortal.prototype._onResetActivations,
      endRound: SWIAGMPortal.prototype._onEndRound,
      resetRound: SWIAGMPortal.prototype._onResetRound,
      togglePhase: SWIAGMPortal.prototype._onTogglePhase
    }
  };

  static PARTS = {
    main: {
      template: "systems/swia/templates/actors/gm-portal.hbs"
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
      id: "swia-gm-portal",
      title: game.i18n.localize("SWIA.Portal.GM.Title"),
      template: "systems/swia/templates/actors/gm-portal.hbs",
      width: 1500,
      height: 900,
      resizable: true,
      classes: ["swia-gm-portal-window"]
    });
  }

  get title() {
    return game.i18n.localize("SWIA.Portal.GM.Title");
  }

  get template() {
    return "systems/swia/templates/actors/gm-portal.hbs";
  }

  render(...args) {
    return super.render(...args);
  }

  async _prepareContext(options) {
    const context = isV2 ? await super._prepareContext(options) : {};
    const portalContext = await this._buildContext();
    return foundry.utils.mergeObject(context, portalContext);
  }

  async getData(options) {
    if (isV2) return this._prepareContext(options);

    const data = await super.getData(options);
    const portalContext = await this._buildContext();
    return foundry.utils.mergeObject(data, portalContext);
  }

  async _buildContext() {
    const [playerActors, imperialActors, companionActors] = await Promise.all([
      Promise.all(this._getOrderedPlayerActors().map(actor => this._toPortalActor(actor))),
      Promise.all(this._getOrderedImperialActors().map(actor => this._toPortalActor(actor))),
      Promise.all(this._getOrderedCompanionActors().map(actor => this._toPortalActor(actor)))
    ]);

    const sortByActivated = (a, b) => {
      if (a.isActivated === b.isActivated) return a.name.localeCompare(b.name);
      return a.isActivated ? 1 : -1;
    };
    playerActors.sort(sortByActivated);
    imperialActors.sort(sortByActivated);
    companionActors.sort(sortByActivated);

    const rawRoundState = game.settings.get("swia", "roundState");
    const phaseLabel = rawRoundState.phase === "status" ? "Status Phase" : "Activation Phase";
    const roundState = { ...rawRoundState, phaseLabel };

    const campaignResources = getCampaignResources();

    return {
      hasAnyActors: playerActors.length > 0 || imperialActors.length > 0 || companionActors.length > 0,
      hasPlayers: playerActors.length > 0,
      hasImperials: imperialActors.length > 0,
      hasCompanions: companionActors.length > 0,
      playerActors,
      imperialActors,
      companionActors,
      roundState,
      threat: campaignResources.threat,
      threatLevel: campaignResources.threatLevel,
      isGM: game.user?.isGM ?? false
    };
  }

  _registerSyncHooks() {
    const watch = (hook, fn) => {
      const id = Hooks.on(hook, fn);
      this._syncHooks.push([hook, id]);
    };

    watch("updateActor", (actor) => {
      if (!this._isPortalActor(actor)) return;
      this._queueRefresh();
    });

    watch("createActor", (actor) => {
      if (!this._isPortalActor(actor)) return;
      this._queueRefresh();
    });

    watch("deleteActor", (actor) => {
      if (!this._isPortalActor(actor)) return;
      this._queueRefresh();
    });

    watch("updateUser", () => {
      this._queueRefresh();
    });

    watch("createToken", () => this._queueRefresh());
    watch("deleteToken", () => this._queueRefresh());
    watch("updateToken", () => this._queueRefresh());
    watch("canvasReady", () => this._queueRefresh());

    watch("updateSetting", (setting) => {
      if (setting.key === "swia.roundState" || setting.key === "swia.campaignResources") this._queueRefresh();
    });
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

  _isPortalActor(actor) {
    return ["hero", "villain", "ally"].includes(actor?.type);
  }

  _queueRefresh() {
    if (!this.rendered) return;

    if (this._refreshHandle) {
      clearTimeout(this._refreshHandle);
    }

    this._refreshHandle = setTimeout(() => {
      this._refreshHandle = null;
      this.render(false);
    }, 75);
  }

  _getOrderedPlayerActors() {
    const users = game.users?.contents ?? [];
    const nonGmUsers = users.filter(user => !user.isGM);
    const observerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;

    const isPlayerActor = (actor) => {
      const ownership = actor.ownership ?? {};
      return nonGmUsers.some((user) => {
        const userPermission = ownership[user.id] ?? ownership.default ?? 0;
        return userPermission >= observerLevel;
      });
    };

    return (game.actors?.contents ?? [])
      .filter(actor => ["hero", "villain", "ally"].includes(actor.type))
      .filter(actor => isPlayerActor(actor))
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: "base" }));
  }

  _getOrderedImperialActors() {
    return (game.actors?.contents ?? [])
      .filter(actor => actor.type === "villain")
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: "base" }));
  }

  _getOrderedCompanionActors() {
    return (game.actors?.contents ?? [])
      .filter(actor => actor.type === "ally")
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: "base" }));
  }

  async _toPortalActor(actor) {
    const system = actor.system ?? {};
    const isHero = actor.type === "hero";
    const isWounded = isHero && (system.state?.wounded ?? false);
    const isDefeated = isHero && isWounded && (system.state?.defeated ?? false);
    const isActivated = system.state?.activated ?? false;

    const tokenImage = isWounded
      ? (system.woundedTokenImage || actor.prototypeToken?.texture?.src || actor.img)
      : (actor.prototypeToken?.texture?.src || actor.img);

    return {
      id: actor.id,
      name: actor.name,
      type: actor.type,
      typeLabel: game.i18n.localize(`SWIA.Actor.${actor.type.charAt(0).toUpperCase()}${actor.type.slice(1)}`),
      tokenImage,
      isWounded,
      isDefeated,
      isActivated,
      canManage: Boolean(game.user?.isGM),
      healthStateLabel: game.i18n.localize(isWounded ? "SWIA.State.Wounded" : "SWIA.State.Healthy"),
      activationTokenIcon: `systems/swia/icons/${isActivated ? "Token Hero Turn Over.png" : "Token Hero Turn Start.png"}`,
      activationTokenLabel: game.i18n.localize(isActivated ? "SWIA.ActivationToken.Activated" : "SWIA.ActivationToken.Ready"),
      health: {
        value: system.attributes?.health?.value ?? 0,
        max: system.attributes?.health?.max ?? 0,
        pct: Math.clamp(
          Math.round(((system.attributes?.health?.value ?? 0) / (system.attributes?.health?.max ?? 1)) * 100),
          0, 100
        )
      },
      groupSize: system.groupSize ?? 1,
      sceneTokens: this._getSceneTokensForActor(actor)
    };
  }

  _getSceneTokensForActor(actor) {
    const tokenDocs = (game.scenes?.active?.tokens?.contents ?? [])
      .filter(t => t.actorId === actor.id);
    return tokenDocs.map((tokenDoc, index) => {
      const tokenActor = tokenDoc.actor ?? actor;
      const health = tokenActor.system?.attributes?.health ?? { value: 0, max: 10 };
      const maxHealth = health.max || 1;
      const currentHealth = health.value ?? 0;
      const pct = Math.max(0, Math.min(100, Math.round((currentHealth / maxHealth) * 100)));
      return {
        id: tokenDoc.id,
        name: tokenDoc.name || `${actor.name} ${index + 1}`,
        img: tokenDoc.texture?.src || actor.prototypeToken?.texture?.src || actor.img,
        health: { value: currentHealth, max: health.max, pct },
        isDefeated: currentHealth <= 0
      };
    });
  }

  activateListeners(html) {
    super.activateListeners?.(html);

    html.find("[data-action='openActor']").on("click", this._onOpenActor.bind(this));
    html.find("[data-action='toggleActivated']").on("click", this._onToggleActivated.bind(this));
  }

  async _onOpenActor(event, target) {
    event.preventDefault();

    const el = target ?? event.currentTarget;
    const actorId = el?.dataset?.actorId;
    if (!actorId) return;

    const actor = game.actors?.get(actorId);
    if (!actor?.sheet) return;

    actor.sheet.render(true);
  }

  async _onToggleActivated(event, target) {
    event.preventDefault();
    event.stopPropagation();

    if (!game.user?.isGM) return;

    const el = target ?? event.currentTarget;
    const actorId = el?.dataset?.actorId;
    if (!actorId) return;

    const actor = game.actors?.get(actorId);
    if (!actor) return;

    const current = actor.system?.state?.activated ?? false;
    await actor.update({ "system.state.activated": !current });
  }

  async _onResetActivations(event) {
    event.preventDefault();
    if (!game.user?.isGM) return;

    const updates = (game.actors?.contents ?? []).map(a => ({ _id: a.id, "system.state.activated": false }));
    if (updates.length) await Actor.updateDocuments(updates);

    const roundState = game.settings.get("swia", "roundState");
    await game.settings.set("swia", "roundState", { ...roundState, activationQueue: [] });
    this.render();
  }

  async _onEndRound(event) {
    event.preventDefault();
    if (!game.user?.isGM) return;

    const updates = (game.actors?.contents ?? []).map(a => ({ _id: a.id, "system.state.activated": false }));
    if (updates.length) await Actor.updateDocuments(updates);

    const roundState = game.settings.get("swia", "roundState");
    await game.settings.set("swia", "roundState", {
      ...roundState,
      round: roundState.round + 1,
      phase: "activation",
      activationQueue: []
    });
    this.render();
  }

  async _onResetRound(event) {
    event.preventDefault();
    if (!game.user?.isGM) return;

    const confirmed = await Dialog.confirm({
      title: "Reset Round",
      content: "<p>Reset the round counter to 1 and clear all activations?</p>"
    });
    if (!confirmed) return;

    const updates = (game.actors?.contents ?? []).map(a => ({ _id: a.id, "system.state.activated": false }));
    if (updates.length) await Actor.updateDocuments(updates);

    const roundState = game.settings.get("swia", "roundState");
    await game.settings.set("swia", "roundState", {
      ...roundState,
      round: 1,
      phase: "activation",
      activationQueue: []
    });
    this.render();
  }

  async _onTogglePhase(event) {
    event.preventDefault();
    if (!game.user?.isGM) return;

    const roundState = game.settings.get("swia", "roundState");
    const nextPhase = roundState.phase === "activation" ? "status" : "activation";
    await game.settings.set("swia", "roundState", { ...roundState, phase: nextPhase });
    this.render();
  }

  async close(options) {
    this._unregisterSyncHooks();
    return super.close?.(options);
  }
}
