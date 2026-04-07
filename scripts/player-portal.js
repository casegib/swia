const BaseApplicationV2 = foundry.applications?.api?.ApplicationV2;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;
const BaseApplicationV1 = foundry.appv1?.api?.Application ?? Application;

const BaseApplication = BaseApplicationV2 && HandlebarsApplicationMixin
  ? HandlebarsApplicationMixin(BaseApplicationV2)
  : BaseApplicationV1;

const isV2 = !!(BaseApplicationV2 && HandlebarsApplicationMixin);

export class SWIAPlayerPortal extends BaseApplication {
  static DEFAULT_OPTIONS = {
    id: "swia-player-portal",
    classes: ["swia-player-portal-window"],
    tag: "section",
    position: {
      width: 1500,
      height: 900
    },
    window: {
      title: "SWIA.Portal.Title",
      icon: "fas fa-users"
    },
    actions: {
      openActor: SWIAPlayerPortal.prototype._onOpenActor,
      toggleActivated: SWIAPlayerPortal.prototype._onToggleActivated,
      openItem: SWIAPlayerPortal.prototype._onOpenItem,
      cycleItemState: SWIAPlayerPortal.prototype._onCycleItemState
    }
  };

  static PARTS = {
    main: {
      template: "systems/swia/templates/actors/player-portal.hbs"
    }
  };

  constructor(...args) {
    super(...args);
    this._syncHooks = [];
    this._refreshHandle = null;
    this._cardPreviewElement = null;
    this._cardPreviewDelayHandle = null;
    this._pendingCardPreview = null;
    this._cardPreviewEventsController = null;
    this._registerSyncHooks();
  }

  static get defaultOptions() {
    if (isV2) return {};

    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "swia-player-portal",
      title: game.i18n.localize("SWIA.Portal.Title"),
      template: "systems/swia/templates/actors/player-portal.hbs",
      width: 1500,
      height: 900,
      resizable: true,
      classes: ["swia-player-portal-window"]
    });
  }

  get title() {
    return game.i18n.localize("SWIA.Portal.Title");
  }

  get template() {
    return "systems/swia/templates/actors/player-portal.hbs";
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
    const orderedActors = this._getOrderedPlayerActors();
    const actors = await Promise.all(orderedActors.map(actor => this._toPortalActor(actor)));

    return {
      title: game.i18n.localize("SWIA.Portal.Title"),
      subtitle: game.i18n.localize("SWIA.Portal.Subtitle"),
      actors,
      hasActors: actors.length > 0
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

    watch("createItem", (item) => {
      if (!this._isPortalItem(item)) return;
      this._queueRefresh();
    });

    watch("updateItem", (item) => {
      if (!this._isPortalItem(item)) return;
      this._queueRefresh();
    });

    watch("deleteItem", (item) => {
      if (!this._isPortalItem(item)) return;
      this._queueRefresh();
    });

    watch("updateUser", () => {
      // Ownership or GM/player toggles can change portal visibility/order.
      this._queueRefresh();
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
    return ["hero", "imperial", "ally"].includes(actor?.type);
  }

  _isPortalItem(item) {
    if (!item?.parent) return false;
    if (item.parent.documentName !== "Actor") return false;
    if (!["weapon", "classcard", "gear"].includes(item.type)) return false;
    return this._isPortalActor(item.parent);
  }

  _queueRefresh() {
    if (!this.rendered) return;

    if (this._refreshHandle) {
      clearTimeout(this._refreshHandle);
    }

    // Debounce bursty updates so rapid item/flag changes only trigger one rerender.
    this._refreshHandle = setTimeout(() => {
      this._refreshHandle = null;
      this.render(false);
    }, 75);
  }

  _getOrderedPlayerActors() {
    const currentUser = game.user;
    const users = game.users?.contents ?? [];
    const nonGmUsers = users.filter(user => !user.isGM);
    const observerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
    const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;

    const isPlayerActor = (actor) => {
      const ownership = actor.ownership ?? {};
      return nonGmUsers.some((user) => {
        const userPermission = ownership[user.id] ?? ownership.default ?? 0;
        return userPermission >= observerLevel;
      });
    };

    const isMine = (actor) => {
      const ownership = actor.ownership ?? {};
      const userPermission = ownership[currentUser?.id] ?? ownership.default ?? 0;
      return userPermission >= ownerLevel;
    };

    return (game.actors?.contents ?? [])
      .filter(actor => ["hero", "imperial", "ally"].includes(actor.type))
      .filter(actor => isPlayerActor(actor))
      .sort((a, b) => {
        const mineDelta = Number(isMine(b)) - Number(isMine(a));
        if (mineDelta !== 0) return mineDelta;
        return a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: "base" });
      });
  }

  async _toPortalActor(actor) {
    const system = actor.system ?? {};
    const isHero = actor.type === "hero";
    const isWounded = isHero && (system.state?.wounded ?? false);
    const isActivated = system.state?.activated ?? false;
    const currentAttributes = isWounded
      ? (system.woundedAttributes ?? system.attributes ?? {})
      : (system.attributes ?? {});

    const health = currentAttributes.health ?? system.attributes?.health ?? { value: 0, max: 0 };
    const endurance = currentAttributes.endurance ?? system.attributes?.endurance ?? { value: 0, max: 0 };
    const speed = currentAttributes.speed ?? system.attributes?.speed ?? 0;
    const defense = system.attributes?.defense ?? { black: 0, white: 0 };
    const attack = system.attributes?.attack ?? { red: 0, blue: 0, green: 0, yellow: 0 };
    const strength = currentAttributes.strength ?? { red: 0, blue: 0, green: 0, yellow: 0 };
    const insight = currentAttributes.insight ?? { red: 0, blue: 0, green: 0, yellow: 0 };
    const tech = currentAttributes.tech ?? { red: 0, blue: 0, green: 0, yellow: 0 };

    const isMine = actor.isOwner;
    const canManage = Boolean(game.user?.isGM) || actor.isOwner;

    const ownedItems = actor.items?.contents ?? [];
    const weaponItems = ownedItems.filter(item => item.type === "weapon");
    const classcardItems = ownedItems.filter(item => item.type === "classcard");
    const gearItems = ownedItems.filter(item => item.type === "gear");

    const toPortalItem = (item) => {
      const state = item.system?.cardState || "ready";
      const normalizedState = ["ready", "exhausted", "depleted"].includes(state) ? state : "ready";
      const stateLabelKey = `SWIA.Item.CardState.${normalizedState.charAt(0).toUpperCase()}${normalizedState.slice(1)}`;
      return {
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type,
        state: normalizedState,
        stateLabel: game.i18n.localize(stateLabelKey)
      };
    };

    const biographySource = (isHero && isWounded)
      ? (system.woundedBiography || system.biography || "")
      : (system.biography || "");

    const TextEditorClass = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const enrichedBiography = await TextEditorClass.enrichHTML(biographySource, {
      async: true,
      secrets: actor.isOwner,
      relativeTo: actor
    });

    return {
      id: actor.id,
      name: actor.name,
      img: actor.img,
      type: actor.type,
      typeLabel: game.i18n.localize(`SWIA.Actor.${actor.type.charAt(0).toUpperCase()}${actor.type.slice(1)}`),
      isHero,
      isWounded,
      isActivated,
      isMine,
      canManage,
      activationTokenIcon: `systems/swia/icons/${isActivated ? "Token Hero Turn Over.png" : "Token Hero Turn Start.png"}`,
      activationTokenLabel: game.i18n.localize(isActivated ? "SWIA.ActivationToken.Activated" : "SWIA.ActivationToken.Ready"),
      health,
      endurance,
      speed,
      defense,
      attack,
      strength,
      insight,
      tech,
      enrichedBiography,
      hasBiography: !!biographySource?.trim(),
      defenseBlackDice: Array.from({ length: defense.black || 0 }, (_, i) => i),
      defenseWhiteDice: Array.from({ length: defense.white || 0 }, (_, i) => i),
      attackRedDice: Array.from({ length: attack.red || 0 }, (_, i) => i),
      attackBlueDice: Array.from({ length: attack.blue || 0 }, (_, i) => i),
      attackGreenDice: Array.from({ length: attack.green || 0 }, (_, i) => i),
      attackYellowDice: Array.from({ length: attack.yellow || 0 }, (_, i) => i),
      strengthRedDice: Array.from({ length: strength.red || 0 }, (_, i) => i),
      strengthBlueDice: Array.from({ length: strength.blue || 0 }, (_, i) => i),
      strengthGreenDice: Array.from({ length: strength.green || 0 }, (_, i) => i),
      strengthYellowDice: Array.from({ length: strength.yellow || 0 }, (_, i) => i),
      insightRedDice: Array.from({ length: insight.red || 0 }, (_, i) => i),
      insightBlueDice: Array.from({ length: insight.blue || 0 }, (_, i) => i),
      insightGreenDice: Array.from({ length: insight.green || 0 }, (_, i) => i),
      insightYellowDice: Array.from({ length: insight.yellow || 0 }, (_, i) => i),
      techRedDice: Array.from({ length: tech.red || 0 }, (_, i) => i),
      techBlueDice: Array.from({ length: tech.blue || 0 }, (_, i) => i),
      techGreenDice: Array.from({ length: tech.green || 0 }, (_, i) => i),
      techYellowDice: Array.from({ length: tech.yellow || 0 }, (_, i) => i),
      hasAttack: actor.type !== "hero",
      weapons: weaponItems.map(toPortalItem),
      abilities: classcardItems.map(toPortalItem),
      gear: gearItems.map(toPortalItem),
      weaponCount: weaponItems.length,
      abilityCount: classcardItems.length,
      gearCount: gearItems.length,
      hasInventory: ownedItems.length > 0
    };
  }

  activateListeners(html) {
    super.activateListeners?.(html);

    html.find("[data-action='openActor']").on("click", this._onOpenActor.bind(this));
    html.find("[data-action='toggleActivated']").on("click", this._onToggleActivated.bind(this));
    html.find("[data-action='openItem']").on("click", this._onOpenItem.bind(this));
    html.find("[data-action='cycleItemState']").on("click", this._onCycleItemState.bind(this));

    html.find(".portal-drop-zone")
      .on("dragover", this._onPortalDragOver.bind(this))
      .on("drop", this._onPortalDrop.bind(this));

    const root = html?.[0] ?? html;
    this._bindCardPreviewListeners(root);
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element?.[0] ?? this.element;
    this._bindCardPreviewListeners(root);
  }

  _unbindCardPreviewListeners() {
    if (!this._cardPreviewEventsController) return;
    this._cardPreviewEventsController.abort();
    this._cardPreviewEventsController = null;
  }

  _bindCardPreviewListeners(root) {
    if (!root?.querySelectorAll) return;

    this._unbindCardPreviewListeners();

    const controller = new AbortController();
    const signal = controller.signal;
    this._cardPreviewEventsController = controller;

    const itemButtons = root.querySelectorAll(".portal-item-open");
    for (const button of itemButtons) {
      button.addEventListener("mouseenter", this._onShowCardPreview.bind(this), { signal });
      button.addEventListener("focusin", this._onShowCardPreview.bind(this), { signal });
      button.addEventListener("mousemove", this._onMoveCardPreview.bind(this), { signal });
      button.addEventListener("mouseleave", this._onHideCardPreview.bind(this), { signal });
      button.addEventListener("focusout", this._onHideCardPreview.bind(this), { signal });
    }

    const dropZones = root.querySelectorAll(".portal-drop-zone");
    for (const dropZone of dropZones) {
      dropZone.addEventListener("scroll", this._onHideCardPreview.bind(this), { signal });
    }
  }

  _ensureCardPreviewElement() {
    if (this._cardPreviewElement) return this._cardPreviewElement;

    const wrapper = document.createElement("div");
    wrapper.className = "swia-portal-card-preview";

    const image = document.createElement("img");
    image.alt = "";
    image.loading = "eager";
    wrapper.appendChild(image);

    document.body.appendChild(wrapper);
    this._cardPreviewElement = wrapper;
    return wrapper;
  }

  _destroyCardPreviewElement() {
    if (!this._cardPreviewElement) return;
    this._cardPreviewElement.remove();
    this._cardPreviewElement = null;
  }

  _extractPointer(event) {
    const baseEvent = event?.originalEvent ?? event;
    const touch = baseEvent?.touches?.[0] ?? baseEvent?.changedTouches?.[0] ?? null;
    const clientX = touch?.clientX ?? baseEvent?.clientX;
    const clientY = touch?.clientY ?? baseEvent?.clientY;
    return { clientX, clientY };
  }

  _positionCardPreview(clientX, clientY) {
    const preview = this._cardPreviewElement;
    if (!preview) return;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    const offset = 18;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = preview.getBoundingClientRect();
    const width = rect.width || 280;
    const height = rect.height || 410;

    let left = clientX + offset;
    let top = clientY + offset;

    if (left + width > vw - 8) left = clientX - width - offset;
    if (top + height > vh - 8) top = vh - height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
  }

  _onShowCardPreview(event) {
    const target = event.currentTarget;
    const image = target?.querySelector("img");
    const src = image?.getAttribute("src");
    if (!src) return;
    const { clientX, clientY } = this._extractPointer(event);
    const rect = target?.getBoundingClientRect?.();
    const fallbackX = rect ? rect.left + (rect.width / 2) : undefined;
    const fallbackY = rect ? rect.top + (rect.height / 2) : undefined;
    this._pendingCardPreview = {
      src,
      alt: image?.getAttribute("alt") || target?.getAttribute("title") || "",
      clientX: Number.isFinite(clientX) ? clientX : fallbackX,
      clientY: Number.isFinite(clientY) ? clientY : fallbackY
    };

    if (this._cardPreviewDelayHandle) {
      clearTimeout(this._cardPreviewDelayHandle);
    }

    this._cardPreviewDelayHandle = setTimeout(() => {
      this._cardPreviewDelayHandle = null;
      const pending = this._pendingCardPreview;
      if (!pending?.src) return;

      const preview = this._ensureCardPreviewElement();
      const previewImage = preview.querySelector("img");
      if (!previewImage) return;

      previewImage.src = pending.src;
      previewImage.alt = pending.alt;
      preview.classList.add("is-visible");

      if (Number.isFinite(pending.clientX) && Number.isFinite(pending.clientY)) {
        this._positionCardPreview(pending.clientX, pending.clientY);
      }
    }, 120);
  }

  _onMoveCardPreview(event) {
    if (this._pendingCardPreview) {
      const { clientX, clientY } = this._extractPointer(event);
      this._pendingCardPreview.clientX = clientX;
      this._pendingCardPreview.clientY = clientY;
    }

    if (!this._cardPreviewElement?.classList.contains("is-visible")) return;
    const { clientX, clientY } = this._extractPointer(event);
    this._positionCardPreview(clientX, clientY);
  }

  _onHideCardPreview() {
    if (this._cardPreviewDelayHandle) {
      clearTimeout(this._cardPreviewDelayHandle);
      this._cardPreviewDelayHandle = null;
    }
    this._pendingCardPreview = null;
    this._cardPreviewElement?.classList.remove("is-visible");
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

    const el = target ?? event.currentTarget;
    const actorId = el?.dataset?.actorId;
    if (!actorId) return;

    const actor = game.actors?.get(actorId);
    if (!actor) return;
    if (!(game.user?.isGM || actor.isOwner)) return;

    const current = actor.system?.state?.activated ?? false;
    await actor.update({ "system.state.activated": !current });
  }

  async _onOpenItem(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const el = target ?? event.currentTarget;
    const actorId = el?.dataset?.actorId;
    const itemId = el?.dataset?.itemId;
    if (!actorId || !itemId) return;

    const actor = game.actors?.get(actorId);
    const item = actor?.items?.get(itemId);
    if (!item?.sheet) return;

    item.sheet.render(true);
  }

  async _onCycleItemState(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const el = target ?? event.currentTarget;
    const actorId = el?.dataset?.actorId;
    const itemId = el?.dataset?.itemId;
    if (!actorId || !itemId) return;

    const actor = game.actors?.get(actorId);
    if (!actor) return;
    if (!(game.user?.isGM || actor.isOwner)) return;

    const item = actor.items?.get(itemId);
    if (!item) return;

    const current = item.system?.cardState || "ready";
    const cycle = { ready: "exhausted", exhausted: "depleted", depleted: "ready" };
    await item.update({ "system.cardState": cycle[current] || "ready" });
  }

  _onPortalDragOver(event) {
    if (!game.user?.isGM) return;
    event.preventDefault();
  }

  async _onPortalDrop(event) {
    if (!game.user?.isGM) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    const actorId = target?.dataset?.actorId;
    const expectedType = target?.dataset?.itemType;
    if (!actorId || !expectedType) return;

    const actor = game.actors?.get(actorId);
    if (!actor) return;

    const dropped = TextEditor.getDragEventData(event.originalEvent ?? event);
    if (!dropped) return;

    let sourceItem = null;
    if (dropped.uuid) {
      sourceItem = await fromUuid(dropped.uuid);
    } else if (dropped.type === "Item" && dropped.id) {
      sourceItem = game.items?.get(dropped.id) ?? null;
    }

    if (!sourceItem || sourceItem.documentName !== "Item") return;
    if (sourceItem.type !== expectedType) {
      const expectedLabel = game.i18n.localize(`SWIA.Inventory.${expectedType === "gear" ? "Items" : `${expectedType.charAt(0).toUpperCase()}${expectedType.slice(1)}s`}`);
      ui.notifications?.warn(game.i18n.format("SWIA.Portal.DropWrongType", { expected: expectedLabel }));
      return;
    }

    const itemData = sourceItem.toObject();
    delete itemData._id;
    await actor.createEmbeddedDocuments("Item", [itemData]);
  }

  async close(options) {
    this._onHideCardPreview();
    this._unbindCardPreviewListeners();
    this._destroyCardPreviewElement();
    this._unregisterSyncHooks();
    return super.close?.(options);
  }
}
