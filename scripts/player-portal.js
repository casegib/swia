import { CAMPAIGN_RESOURCES_KEY } from "./campaign-tracker.js";
import { SWIARollDialog, weaponModsFor } from "./dice/roll-dialog.js";
import { equipmentEffectsFor, modifierChips } from "./data/common.js";
import { bindCardPreviews, hideCardPreview, destroyCardPreview, postItemCardFromElement } from "./item-cards.js";
import {
  canManageActor, requestWoundedState, setDefeatedState, adjustActorStat,
  adjustActorXp, toggleArmorEquipped, readyAllItemsWithNotice, READY_ALL_TYPES,
  powerTokenRows, grantPowerToken, removePowerToken,
  conditionRows, conditionChoices, hasEndOfActivationConditions, runConditionAction, settleClassCardPurchase, chargeClassCardPurchase } from "./actor-actions.js";

// Foundry v13+ ApplicationV2 base
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApplication = HandlebarsApplicationMixin(ApplicationV2);

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
      cycleItemState: SWIAPlayerPortal.prototype._onCycleItemState,
      rollDice: SWIAPlayerPortal.prototype._onRollDice,
      adjustStat: SWIAPlayerPortal.prototype._onAdjustStat,
      adjustXp: SWIAPlayerPortal.prototype._onAdjustXp,
      toggleWounded: SWIAPlayerPortal.prototype._onToggleWounded,
      toggleDefeated: SWIAPlayerPortal.prototype._onToggleDefeated,
      toggleEquipArmor: SWIAPlayerPortal.prototype._onToggleEquipArmor,
      adjustPowerToken: SWIAPlayerPortal.prototype._onAdjustPowerToken,
      conditionAction: SWIAPlayerPortal.prototype._onConditionAction,
      readyAllItems: SWIAPlayerPortal.prototype._onReadyAllItems,
      postItemCard: SWIAPlayerPortal.prototype._onPostItemCard
    }
  };

  // Open the roll dialog from a clicked dice block (Phase 5)
  _onRollDice(event, target) {
    event.preventDefault();
    const actorId = target?.dataset?.actorId
      ?? target?.closest?.("[data-actor-id]")?.dataset?.actorId;
    const actor = game.actors?.get(actorId);
    if (!actor) return;
    SWIARollDialog.open({
      actor,
      rollType: target?.dataset?.rollType || "attack",
      attribute: target?.dataset?.attribute || null
    });
  }

  static PARTS = {
    main: {
      template: "systems/swia/templates/actors/player-portal.hbs"
    }
  };

  constructor(...args) {
    super(...args);
    this._syncHooks = [];
    this._refreshHandle = null;
    this._cardPreviewEventsController = null;
    this._registerSyncHooks();
  }

  get title() {
    return game.i18n.localize("SWIA.Portal.Title");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const portalContext = await this._buildContext();
    return foundry.utils.mergeObject(context, portalContext);
  }

  async _buildContext() {
    const orderedActors = this._getOrderedPlayerActors();
    const built = await Promise.all(orderedActors.map(actor => this._toPortalActor(actor)));
    const byId = new Map(built.map((a) => [a.id, a]));

    // Companions (allies) sit inside their owner's hero column rather than
    // floating on their own — a companion out of context is meaningless.
    const nestedIds = new Set();
    for (const candidate of built) {
      if (candidate.type !== "ally") continue;
      // Explicit link only: no ownership guessing, and it behaves the same for
      // player and NPC companions. An ally pinned to a figure this user cannot
      // see simply stays a top-level card.
      const ownerId = game.actors?.get(candidate.id)?.system?.companionOf;
      const owner = ownerId ? byId.get(ownerId) : null;
      if (!owner || !owner.isHero) continue;
      owner.companions.push(candidate);
      nestedIds.add(candidate.id);
    }

    const actors = built.filter((a) => !nestedIds.has(a.id));
    return {
      actors,
      hasActors: actors.length > 0
    };
  }

  /** Non-GM user ids that own this actor. */
  _playerOwnerIds(actor) {
    if (!actor) return [];
    const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const ownership = actor.ownership ?? {};
    // testUserPermission handles INHERIT (-1), which ?? treats as present and
    // would misclassify an inheriting owner as a non-owner.
    const isOwner = (user) => {
      if (typeof actor.testUserPermission === "function") return actor.testUserPermission(user, "OWNER");
      const raw = ownership[user.id];
      const level = (raw === undefined || raw === -1) ? (ownership.default ?? 0) : raw;
      return level >= ownerLevel;
    };
    return (game.users?.contents ?? [])
      .filter((user) => !user.isGM && isOwner(user))
      .map((user) => user.id);
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

    // Power tokens are active effects; the tray on each card reads them live.
    for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
      watch(hook, (effect) => {
        const parent = effect?.parent;
        if (parent?.documentName !== "Actor" || !this._isPortalActor(parent)) return;
        this._queueRefresh();
      });
    }

    watch("updateUser", () => {
      // Ownership or GM/player toggles can change portal visibility/order.
      this._queueRefresh();
    });

    watch("updateSetting", (setting) => {
      if (setting?.key !== `swia.${CAMPAIGN_RESOURCES_KEY}`) return;
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
    return ["hero", "villain", "ally"].includes(actor?.type);
  }

  _isPortalItem(item) {
    if (!item?.parent) return false;
    if (item.parent.documentName !== "Actor") return false;
    if (!["weapon", "classcard", "gear", "armor", "weaponmod"].includes(item.type)) return false;
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

    // Can a specific user observe this actor? Prefers the document API and
    // falls back to reading ownership directly.
    const canObserve = (actor, user) => {
      if (!user) return false;
      if (typeof actor.testUserPermission === "function") {
        return actor.testUserPermission(user, "OBSERVER");
      }
      const ownership = actor.ownership ?? {};
      return (ownership[user.id] ?? ownership.default ?? 0) >= observerLevel;
    };

    // Any actor some player can observe — the GM's view of the player roster.
    const hasPlayerAccess = (actor) => nonGmUsers.some((user) => canObserve(actor, user));

    // Allies are companions: they earn a spot in the Player Area only by being
    // a player's own figure (owned, not merely observable) or by being pinned
    // to a hero via companionOf. Everything else stays in the Companion Area,
    // so an NPC ally the players can see doesn't clutter their roster.
    const heroIds = new Set(
      (game.actors?.contents ?? []).filter((a) => a.type === "hero").map((a) => a.id)
    );
    const belongsInPlayerArea = (actor) => {
      if (actor.type !== "ally") return true;
      if (heroIds.has(actor.system?.companionOf)) return true;
      return this._playerOwnerIds(actor).length > 0;
    };

    // A player only sees actors they themselves can observe; the GM keeps the
    // full player-facing roster. Without this, every client renders every
    // player's hero because Foundry ships all world actors to all clients.
    const isPlayerActor = (actor) => {
      if (currentUser?.isGM) return hasPlayerAccess(actor);
      return canObserve(actor, currentUser);
    };

    const isMine = (actor) => {
      const ownership = actor.ownership ?? {};
      const userPermission = ownership[currentUser?.id] ?? ownership.default ?? 0;
      return userPermission >= ownerLevel;
    };

    return (game.actors?.contents ?? [])
      .filter(actor => ["hero", "villain", "ally"].includes(actor.type))
      .filter(actor => isPlayerActor(actor))
      .filter(actor => belongsInPlayerArea(actor))
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
    const isDefeated = isHero && isWounded && (system.state?.defeated ?? false);
    const tokenImage = isWounded
      ? (system.woundedTokenImage || actor.prototypeToken?.texture?.src || actor.img)
      : (actor.prototypeToken?.texture?.src || actor.img);
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
    const armorItems = ownedItems.filter(item => item.type === "armor");

    // Armor and class-card passives add no dice by default; their printed
    // Block/Evade ride beside the defense dice as chips, and their Health /
    // Endurance / Speed are already folded into the derived attributes.
    const armorFx = equipmentEffectsFor(actor).defense;

    const hasReadyableCards = ownedItems.some(
      (item) => item.system?.cardState === "exhausted" && READY_ALL_TYPES.includes(item.type)
    );

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

    const TextEditorClass = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;

    let enrichedHeroAbilities = [];
    if (isHero) {
      const abilitiesSource = isWounded
        ? (Array.isArray(system.woundedHeroAbilities) ? system.woundedHeroAbilities : Object.values(system.woundedHeroAbilities ?? {}))
        : (Array.isArray(system.heroAbilities) ? system.heroAbilities : Object.values(system.heroAbilities ?? {}));
      enrichedHeroAbilities = await Promise.all(
        abilitiesSource.map(async (a) => ({
          name: a.name || "",
          enrichedDescription: await TextEditorClass.enrichHTML(a.description || "", {
            async: true,
            secrets: actor.isOwner,
            relativeTo: actor
          })
        }))
      );
    }

    // Attached mods ride along on their weapon's card as small chips.
    const modChipsFor = (weapon) => weaponModsFor(actor, weapon).map((mod) => ({
      id: mod.id,
      name: mod.name,
      redDice: Array.from({ length: mod.system?.bonusDice?.red || 0 }, (_, i) => i),
      blueDice: Array.from({ length: mod.system?.bonusDice?.blue || 0 }, (_, i) => i),
      greenDice: Array.from({ length: mod.system?.bonusDice?.green || 0 }, (_, i) => i),
      yellowDice: Array.from({ length: mod.system?.bonusDice?.yellow || 0 }, (_, i) => i)
    }));

    return {
      id: actor.id,
      name: actor.name,
      img: actor.img,
      tokenImage,
      companions: [],
      xp: Number(system.xp) || 0,
      canEditXp: Boolean(game.user?.isGM),
      hasReadyableCards,
      type: actor.type,
      typeLabel: game.i18n.localize(`SWIA.Actor.${actor.type.charAt(0).toUpperCase()}${actor.type.slice(1)}`),
      isHero,
      isWounded,
      isDefeated,
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
      enrichedHeroAbilities,
      defenseBlackDice: Array.from({ length: defense.black || 0 }, (_, i) => i),
      defenseWhiteDice: Array.from({ length: defense.white || 0 }, (_, i) => i),
      armorBlock: armorFx.block,
      armorEvade: armorFx.evade,
      powerTokens: powerTokenRows(actor, { editable: Boolean(game.user?.isGM) }),
      canEditTokens: Boolean(game.user?.isGM),
      conditions: conditionRows(actor),
      conditionChoices: conditionChoices(actor),
      hasActionStrain: conditionRows(actor).some((c) => c.actionStrain > 0),
      hasEndOfActivation: hasEndOfActivationConditions(actor),
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
      weapons: weaponItems.map((item) => ({ ...toPortalItem(item), mods: modChipsFor(item) })),
      abilities: classcardItems.map(toPortalItem),
      gear: gearItems.map(toPortalItem),
      armor: armorItems.map((item) => {
        const chips = modifierChips(item.system?.modifier);
        return { ...toPortalItem(item), equipped: item.system?.equipped ?? true, chips, hasEffects: chips.length > 0 };
      }),
      weaponCount: weaponItems.length,
      abilityCount: classcardItems.length,
      gearCount: gearItems.length,
      armorCount: armorItems.length,
      hasInventory: ownedItems.length > 0
    };
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element?.[0] ?? this.element;
    this._bindCardPreviewListeners(root);
  }

  _unbindCardPreviewListeners() {
    this._cardPreviewEventsController?.abort();
    this._cardPreviewEventsController = null;
  }

  /**
   * Hover previews come from the shared item-cards helper (identical to the
   * actor sheet); the portal layers its drag-and-drop wiring on top.
   */
  _bindCardPreviewListeners(root) {
    if (!root?.querySelectorAll) return;
    this._unbindCardPreviewListeners();

    const controller = new AbortController();
    const signal = controller.signal;
    this._cardPreviewEventsController = controller;

    bindCardPreviews(root, { signal });

    for (const dropZone of root.querySelectorAll(".portal-drop-zone")) {
      dropZone.addEventListener("dragover", this._onPortalDragOver.bind(this), { signal });
      dropZone.addEventListener("drop", this._onPortalDrop.bind(this), { signal });
    }
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

  /** Resolve the actor a control belongs to, enforcing GM-or-owner. */
  _manageableActor(target) {
    const actorId = target?.dataset?.actorId ?? target?.closest?.("[data-actor-id]")?.dataset?.actorId;
    const actor = actorId ? game.actors?.get(actorId) : null;
    if (!actor || !canManageActor(actor)) return null;
    return actor;
  }

  async _onAdjustStat(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const actor = this._manageableActor(target ?? event.currentTarget);
    if (!actor) return;
    await adjustActorStat(actor, target?.dataset?.stat, target?.dataset?.delta);
  }

  // Grant or remove one power token. GM-only: tokens come from card text
  // the GM adjudicates, and this replaces hunting through the token HUD.
  async _onAdjustPowerToken(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user?.isGM) return;
    const actor = this._manageableActor(target ?? event.currentTarget);
    if (!actor) return;
    const type = target?.dataset?.token;
    const delta = Number(target?.dataset?.delta) || 0;
    if (delta > 0) await grantPowerToken(actor, type);
    else if (delta < 0) await removePowerToken(actor, type);
  }

  // Condition chips (shared helpers with the actor sheet).
  async _onConditionAction(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const actor = this._manageableActor(target ?? event.currentTarget);
    if (!actor) return;
    await runConditionAction(actor, target, target?.closest?.(".condition-tray") ?? this.element);
  }

  async _onAdjustXp(event, target) {
    event.preventDefault();
    event.stopPropagation();
    // XP is spent between missions under GM supervision; players see it but
    // do not edit it here. The Campaign Tracker writes the same field.
    if (!game.user?.isGM) return;
    const actorId = target?.dataset?.actorId ?? target?.closest?.("[data-actor-id]")?.dataset?.actorId;
    const actor = actorId ? game.actors?.get(actorId) : null;
    if (!actor) return;
    await adjustActorXp(actor, target?.dataset?.delta);
  }

  async _onToggleWounded(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const actor = this._manageableActor(target ?? event.currentTarget);
    if (!actor) return;
    await requestWoundedState(actor, !actor.system.state?.wounded);
  }

  async _onToggleDefeated(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const actor = this._manageableActor(target ?? event.currentTarget);
    if (!actor) return;
    await setDefeatedState(actor, !actor.system.state?.defeated);
  }

  async _onToggleEquipArmor(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const actor = this._manageableActor(target ?? event.currentTarget);
    if (!actor) return;
    const itemId = target?.dataset?.itemId ?? target?.closest?.("[data-item-id]")?.dataset?.itemId;
    await toggleArmorEquipped(itemId ? actor.items?.get(itemId) : null);
  }

  async _onPostItemCard(event, target) {
    event.preventDefault();
    event.stopPropagation();
    hideCardPreview();
    const el = target ?? event.currentTarget;
    const actorId = el?.dataset?.actorId ?? el?.closest?.("[data-actor-id]")?.dataset?.actorId;
    const actor = actorId ? game.actors?.get(actorId) : null;
    if (!actor) return;
    await postItemCardFromElement(actor, el);
  }

  async _onReadyAllItems(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const actor = this._manageableActor(target ?? event.currentTarget);
    if (!actor) return;
    await readyAllItemsWithNotice(actor);
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

    const TextEditorClass = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const dropped = TextEditorClass.getDragEventData(event.originalEvent ?? event);
    if (!dropped) return;

    let sourceItem = null;
    if (dropped.uuid) {
      sourceItem = await fromUuid(dropped.uuid);
    } else if (dropped.type === "Item" && dropped.id) {
      sourceItem = game.items?.get(dropped.id) ?? null;
    }

    if (!sourceItem || sourceItem.documentName !== "Item") return;
    if (sourceItem.type !== expectedType) {
      const expectedLabelKey = {
        weapon: "SWIA.Inventory.Weapons",
        classcard: "SWIA.Inventory.Abilities",
        gear: "SWIA.Inventory.Items",
        armor: "SWIA.Inventory.Armor",
        weaponmod: "SWIA.Inventory.WeaponMods"
      }[expectedType] ?? "SWIA.Inventory.Items";
      const expectedLabel = game.i18n.localize(expectedLabelKey);
      ui.notifications?.warn(game.i18n.format("SWIA.Portal.DropWrongType", { expected: expectedLabel }));
      return;
    }

    const itemData = sourceItem.toObject();
    delete itemData._id;
    const { allow, deduct } = await settleClassCardPurchase(actor, itemData);
    if (!allow) return;
    await actor.createEmbeddedDocuments("Item", [itemData]);
    await chargeClassCardPurchase(actor, itemData, deduct);
  }

  async close(options) {
    hideCardPreview();
    this._unbindCardPreviewListeners();
    destroyCardPreview();
    this._unregisterSyncHooks();
    return super.close?.(options);
  }
}
