// Foundry v13+ ApplicationV2 actor sheet
import { SWIARollDialog } from "../dice/roll-dialog.js";
import { escapeHTML, sanitizeLabelHTML, armorEffectsFor } from "../data/common.js";
import { bindCardPreviews, hideCardPreview, postItemCardFromElement } from "../item-cards.js";
import {
  getHealthyTokenSrc, getWoundedTokenSrc, syncActiveTokenTextures,
  requestWoundedState, setDefeatedState, adjustActorStat,
  toggleArmorEquipped, readyAllItemsWithNotice,
  powerTokenRows, grantPowerToken, removePowerToken,
  conditionRows, conditionChoices, hasEndOfActivationConditions,
  runConditionAction
} from "../actor-actions.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const BaseActorSheet = HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2);

export class SWIAActorSheet extends BaseActorSheet {
  static EDIT_COLLAPSE_DEFAULTS = {
    biography: true,
    heroAbilities: true,
    stats: false,
    weapons: true,
    armor: true,
    abilities: true,
    items: true,
    surgeAbilities: true,
    specialAbilities: true
  };

  static _diceArray(n) {
    return Array.from({ length: n || 0 }, (_, i) => i);
  }

  // Display label for a weaponSurgeList entry ({cost, effectType, effectValue,
  // effectText}). Mirrors surgeLabel() in roll-dialog.js so the sheet and the
  // combat window describe the same ability the same way.
  static _surgeEntryLabel(entry) {
    const type = entry?.effectType ?? "special";
    const value = Number(entry?.effectValue) || 0;
    const text = (entry?.effectText ?? "").trim();
    let base = "";
    if (type === "damage") base = `+${value} ${game.i18n.localize("SWIA.Dice.Damage")}`;
    else if (type === "accuracy") base = `+${value} ${game.i18n.localize("SWIA.Dice.Accuracy")}`;
    else if (type === "pierce") base = `${game.i18n.localize("SWIA.Keywords.Pierce")} ${value}`;
    if (base) return text ? `${base}, ${text}` : base;
    return text || game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Special");
  }

  static _surgeLines(item) {
    const raw = item.system?.surgeAbilities;
    const list = Array.isArray(raw) ? raw : Object.values(raw ?? {});
    return list.map((entry) => ({
      cost: Math.max(1, Number(entry?.cost) || 1),
      label: sanitizeLabelHTML(SWIAActorSheet._surgeEntryLabel(entry)),
      exhausts: !!entry?.exhaustToUse
    }));
  }

  // Track whether the sheet is in edit mode (GM only)
  constructor(...args) {
    super(...args);
    this._editMode = false;
    this._editStatTab = "healthy";
    // Compact inventory rows: ids of items whose details block is open.
    // Lives on the instance so it survives the sheet's frequent re-renders.
    this._expandedItems = new Set();
    // Hero abilities are reference text; collapsed by default in display
    // mode so the combat header and inventory get the height. Remembered
    // while the sheet stays open.
    this._abilitiesOpen = false;
    this._collapsedSections = foundry.utils.mergeObject({}, SWIAActorSheet.EDIT_COLLAPSE_DEFAULTS);
    this._enrichCache = new Map();
    this._enrichCacheMaxEntries = 256;
  }

  _hashContent(content) {
    const text = `${content ?? ""}`;
    let hash = 5381;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  _buildEnrichCacheKey({ actorId, fieldKey, contentHash, ownerFlag, relativeId }) {
    return [
      actorId || "unknown-actor",
      fieldKey || "unknown-field",
      contentHash,
      ownerFlag ? "owner" : "public",
      relativeId || "no-relative"
    ].join(":");
  }

  _getCachedEnrichment(cacheKey) {
    if (!this._enrichCache.has(cacheKey)) return undefined;
    const cached = this._enrichCache.get(cacheKey);
    // Touch key to keep most recently used entries.
    this._enrichCache.delete(cacheKey);
    this._enrichCache.set(cacheKey, cached);
    return cached;
  }

  _setCachedEnrichment(cacheKey, html) {
    if (this._enrichCache.has(cacheKey)) this._enrichCache.delete(cacheKey);
    this._enrichCache.set(cacheKey, html);

    if (this._enrichCache.size <= this._enrichCacheMaxEntries) return;
    const oldestKey = this._enrichCache.keys().next().value;
    if (oldestKey !== undefined) this._enrichCache.delete(oldestKey);
  }

  async _enrichWithCache(TextEditorClass, {
    actor,
    fieldKey,
    text,
    relativeTo,
    secrets,
    sanitize = false
  }) {
    const normalizedText = `${text ?? ""}`;
    if (!normalizedText) return "";

    const ownerFlag = Boolean(secrets);
    const target = relativeTo ?? actor;
    const cacheKey = this._buildEnrichCacheKey({
      actorId: actor?.id,
      fieldKey: sanitize ? `${fieldKey}::sanitized` : fieldKey,
      contentHash: this._hashContent(normalizedText),
      ownerFlag,
      relativeId: target?.id
    });

    const cached = this._getCachedEnrichment(cacheKey);
    if (cached !== undefined) return cached;

    const enriched = await TextEditorClass.enrichHTML(normalizedText, {
      async: true,
      secrets: ownerFlag,
      relativeTo: target
    });
    // enrichHTML resolves @-links/inline-rolls but trusts the stored HTML and does
    // not strip scripts. For attacker-controlled fields rendered raw via {{{ }}}
    // (notably names), run the enriched output through the label sanitizer so a
    // stored payload can't execute in the GM's session. Drops <a>/inline-roll
    // markup down to plain text, which is an acceptable tradeoff for name fields.
    const result = sanitize ? sanitizeLabelHTML(enriched) : enriched;
    this._setCachedEnrichment(cacheKey, result);
    return result;
  }

  // Configuration for V2: sheet layout, position, and action handlers
  static DEFAULT_OPTIONS = {
    classes: ["swia", "sheet", "actor"],
    window: {
      resizable: true,
      controls: []
    },
    position: {
      width: 980,
      height: 700
    },
    form: {
      submitOnChange: true
    },
    actions: {
      // Dice rolling (Phase 5)
      rollDice: SWIAActorSheet.prototype._onRollDice,
      // Health/endurance steppers (display mode)
      adjustStat: SWIAActorSheet.prototype._onAdjustStat,
      // Edit-mode stat set tabs (hero) + custom attribute slots
      setEditStatTab: SWIAActorSheet.prototype._onSetEditStatTab,
      addCustomAttribute: SWIAActorSheet.prototype._onAddCustomAttribute,
      // Combat state toggles
      toggleWounded: SWIAActorSheet.prototype._onToggleWounded,
      toggleDefeated: SWIAActorSheet.prototype._onToggleDefeated,
      toggleActivated: SWIAActorSheet.prototype._onToggleActivated,
      toggleEdit: SWIAActorSheet.prototype._onToggleEdit,
      toggleSectionCollapse: SWIAActorSheet.prototype._onToggleSectionCollapse,
      applyTokenFootprintPreset: SWIAActorSheet.prototype._onApplyTokenFootprintPreset,
      // Image and name editing
      editImage: SWIAActorSheet.prototype._onEditImage,
      changeName: SWIAActorSheet.prototype._onChangeName,
      // Item management
      toggleItemDetails: SWIAActorSheet.prototype._onToggleItemDetails,
      openItem: SWIAActorSheet.prototype._onOpenItem,
      deleteItem: SWIAActorSheet.prototype._onDeleteItem,
      cycleItemState: SWIAActorSheet.prototype._onCycleItemState,
      toggleEquipArmor: SWIAActorSheet.prototype._onToggleEquipArmor,
      adjustPowerToken: SWIAActorSheet.prototype._onAdjustPowerToken,
      conditionAction: SWIAActorSheet.prototype._onConditionAction,
      readyAllItems: SWIAActorSheet.prototype._onReadyAllItems,
      postItemCard: SWIAActorSheet.prototype._onPostItemCard,
      detachMod: SWIAActorSheet.prototype._onDetachMod,
      setAttackType: SWIAActorSheet.prototype._onSetAttackType,
      // Imperial/ally list management
      addSurgeAbility: SWIAActorSheet.prototype._onAddSurgeAbility,
      removeSurgeAbility: SWIAActorSheet.prototype._onRemoveSurgeAbility,
      addSpecialAbility: SWIAActorSheet.prototype._onAddSpecialAbility,
      removeSpecialAbility: SWIAActorSheet.prototype._onRemoveSpecialAbility,
      // Hero ability list management
      addHeroAbility: SWIAActorSheet.prototype._onAddHeroAbility,
      removeHeroAbility: SWIAActorSheet.prototype._onRemoveHeroAbility,
      // Villain form card (Shift) management
      toggleShift: SWIAActorSheet.prototype._onToggleShift,
      setActiveForm: SWIAActorSheet.prototype._onSetActiveForm,
      addFormCardSurgeAbility: SWIAActorSheet.prototype._onAddFormCardSurgeAbility,
      removeFormCardSurgeAbility: SWIAActorSheet.prototype._onRemoveFormCardSurgeAbility,
      addFormCardSpecialAbility: SWIAActorSheet.prototype._onAddFormCardSpecialAbility,
      removeFormCardSpecialAbility: SWIAActorSheet.prototype._onRemoveFormCardSpecialAbility
    }
  };

  static PARTS = {
    form: {
      template: "systems/swia/templates/actors/actor-sheet.hbs",
      // The form is the scroll container (core's window-content clips);
      // listing it keeps the scroll position across re-renders.
      scrollable: [""]
    }
  };

  get title() {
    const name = this.document?.name ?? this.actor?.name ?? "";
    return name || "";
  }

  // Health/endurance +/- stepper in display mode. Uses the wounded attribute
  // set for a wounded hero, mirroring healthPath() in combat-window.js.
  // Clamped to [0, max].
  async _onAdjustStat(event, target) {
    event.preventDefault();
    const actor = this.document ?? this.actor;
    await adjustActorStat(actor, target?.dataset?.stat, target?.dataset?.delta);
  }

  // Edit mode: pick which attribute set (healthy/wounded) the stat editors
  // write to, without touching the actor's actual wounded state.
  _onSetEditStatTab(event, target) {
    event.preventDefault();
    if (!this._editMode) return;
    const tab = target?.dataset?.tab === "wounded" ? "wounded" : "healthy";
    if (tab === this._editStatTab) return;
    this._editStatTab = tab;
    this.render(false);
  }

  // Edit mode: enable the next free custom attribute slot in the active set.
  async _onAddCustomAttribute(event) {
    event.preventDefault();
    const actor = this.document ?? this.actor;
    if (!actor || !this._editMode) return;
    const path = (actor.type === "hero" && this._editStatTab === "wounded")
      ? "woundedAttributes" : "attributes";
    const set = foundry.utils.getProperty(actor, `system.${path}`) ?? {};
    const key = ["custom1", "custom2", "custom3"].find((k) => !set?.[k]?.enabled);
    if (!key) return;
    await actor.update({ [`system.${path}.${key}.enabled`]: true });
  }

  // Open the roll dialog from a clicked dice block (Phase 5)
  _onRollDice(event, target) {
    event.preventDefault();
    const rollType = target?.dataset?.rollType || "attack";
    const attribute = target?.dataset?.attribute || null;
    SWIARollDialog.open({ actor: this.document ?? this.actor, rollType, attribute });
  }

  _getHealthyTokenSrc(actor) {
    return getHealthyTokenSrc(actor);
  }

  _getWoundedTokenSrc(actor) {
    return getWoundedTokenSrc(actor);
  }

  _getTokenPreviewSrc(actor, isWounded) {
    if (actor?.type === "hero" && isWounded) {
      return this._getWoundedTokenSrc(actor);
    }
    return actor?.prototypeToken?.texture?.src || this._getHealthyTokenSrc(actor);
  }

  _getTokenFootprint(actor) {
    const width = Number(actor?.prototypeToken?.width);
    const height = Number(actor?.prototypeToken?.height);
    const scaleX = Number(actor?.prototypeToken?.texture?.scaleX);
    const scaleY = Number(actor?.prototypeToken?.texture?.scaleY);

    return {
      width: Number.isFinite(width) && width > 0 ? width : 1,
      height: Number.isFinite(height) && height > 0 ? height : 1,
      scaleX: Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
      scaleY: Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1
    };
  }

  async _syncActiveTokenTextures(actor, src) {
    return syncActiveTokenTextures(actor, src);
  }

  async _syncActiveTokenFootprint(actor, footprint, linkedOnly = true) {
    if (!actor || !footprint) return;

    const tokenDocs = [];
    const pushDoc = (tokenDoc) => {
      if (!tokenDoc?.id) return;
      if (linkedOnly && !tokenDoc.actorLink) return;
      if (tokenDocs.some(existing => existing.id === tokenDoc.id && existing.parent?.id === tokenDoc.parent?.id)) return;
      tokenDocs.push(tokenDoc);
    };

    if (typeof actor.getActiveTokens === "function") {
      const activeTokens = actor.getActiveTokens(false, true) || [];
      for (const token of activeTokens) {
        pushDoc(token?.document ?? token);
      }
    }

    for (const scene of game.scenes?.contents ?? []) {
      for (const tokenDoc of scene.tokens?.contents ?? []) {
        if (tokenDoc?.actorId !== actor.id) continue;
        pushDoc(tokenDoc);
      }
    }

    if (!tokenDocs.length) return;

    const updates = [];
    for (const tokenDoc of tokenDocs) {
      const needsWidth = Number(tokenDoc.width) !== Number(footprint.width);
      const needsHeight = Number(tokenDoc.height) !== Number(footprint.height);
      const needsScaleX = Number(tokenDoc.texture?.scaleX) !== Number(footprint.scaleX);
      const needsScaleY = Number(tokenDoc.texture?.scaleY) !== Number(footprint.scaleY);
      if (!needsWidth && !needsHeight && !needsScaleX && !needsScaleY) continue;

      updates.push(tokenDoc.update({
        width: Number(footprint.width),
        height: Number(footprint.height),
        "texture.scaleX": Number(footprint.scaleX),
        "texture.scaleY": Number(footprint.scaleY)
      }));
    }

    if (updates.length) await Promise.allSettled(updates);
  }

  // Prepare rendering context
  // Converts dice counts to arrays for template iteration and handles wounded state
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document ?? this.actor;
    const system = actor.system;
    // Determine which attribute set to display based on wounded state
    const isWounded = system.state?.wounded ?? false;
    const currentAttrPath = isWounded ? "woundedAttributes" : "attributes";
    // Edit-mode stat tab (heroes edit healthy/wounded sets via tabs; other
    // types always edit the base attributes).
    const editStatTab = actor.type === "hero" ? (this._editStatTab ?? "healthy") : "healthy";
    const editAttrPath = editStatTab === "wounded" ? "woundedAttributes" : "attributes";
    const editAttributes = system[editAttrPath] ?? system.attributes;
    // health.max is DERIVED (stored base + equipped armor, see actors.js).
    // The edit input must show and write the stored base, or every save
    // would bake the armor bonus into the base and double-count it.
    const editSourceAttrs = actor._source?.system?.[editAttrPath] ?? actor._source?.system?.attributes ?? {};
    const editHealthBaseMax = Number(editSourceAttrs.health?.max ?? editAttributes.health?.baseMax ?? editAttributes.health?.max) || 0;
    const editHealthArmorBonus = Number(editAttributes.health?.armorBonus) || 0;
    const tokenSrc = actor?.prototypeToken?.texture?.src ?? "";
    const profileSrc = actor?.img || tokenSrc || "";
    const tokenPreviewSrc = this._getTokenPreviewSrc(actor, isWounded) || profileSrc;
    const woundedTokenPreviewSrc = actor?.system?.woundedTokenImage || tokenPreviewSrc;
    const tokenFootprint = this._getTokenFootprint(actor);

    // Extract dice pools from current (or wounded) attributes
    const defense = system.attributes?.defense || { black: 0, white: 0 };
    const attack = system.attributes?.attack || { red: 0, blue: 0, green: 0, yellow: 0 };
    const strength = system.attributes?.strength || { red: 0, blue: 0, green: 0, yellow: 0 };
    const insight = system.attributes?.insight || { red: 0, blue: 0, green: 0, yellow: 0 };
    const tech = system.attributes?.tech || { red: 0, blue: 0, green: 0, yellow: 0 };
    
    // Get wounded dice if wounded state is active
    const woundedStrength = isWounded && system.woundedAttributes?.strength ? system.woundedAttributes.strength : strength;
    const woundedInsight = isWounded && system.woundedAttributes?.insight ? system.woundedAttributes.insight : insight;
    const woundedTech = isWounded && system.woundedAttributes?.tech ? system.woundedAttributes.tech : tech;

    // Custom user-defined attribute slots (hero only). Resolve wounded-or-healthy
    // source per slot and build both raw values (edit inputs) and dice arrays (display).
    const customSlotKeys = ["custom1", "custom2", "custom3"];
    const customDefault = { enabled: false, label: "", icon: "", red: 0, blue: 0, green: 0, yellow: 0 };
    const attrSet = isWounded ? (system.woundedAttributes ?? system.attributes) : system.attributes;
    // Edit mode reads slots from the tab-selected set; display follows state.
    const slotSource = this._editMode ? editAttributes : attrSet;
    const customSlots = customSlotKeys.map((key) => {
      const slot = slotSource?.[key] ?? customDefault;
      return {
        key,
        enabled: !!slot.enabled,
        label: slot.label ?? "",
        icon: slot.icon ?? "",
        red: slot.red ?? 0,
        blue: slot.blue ?? 0,
        green: slot.green ?? 0,
        yellow: slot.yellow ?? 0,
        redDice: SWIAActorSheet._diceArray(slot.red),
        blueDice: SWIAActorSheet._diceArray(slot.blue),
        greenDice: SWIAActorSheet._diceArray(slot.green),
        yellowDice: SWIAActorSheet._diceArray(slot.yellow)
      };
    });

    // Get TextEditor with fallback for V1/V2 compatibility
    const TextEditorClass = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    
    // Enrich biography HTML
    const enrichedBiography = await this._enrichWithCache(TextEditorClass, {
      actor,
      fieldKey: "biography",
      text: system.biography,
      secrets: actor.isOwner,
      relativeTo: actor
    });

    let enrichedWoundedBiography = "";
    let enrichedHeroAbilities = [];
    let enrichedWoundedHeroAbilities = [];
    if (actor.type === "hero") {
      enrichedWoundedBiography = await this._enrichWithCache(TextEditorClass, {
        actor,
        fieldKey: "woundedBiography",
        text: system.woundedBiography,
        secrets: actor.isOwner,
        relativeTo: actor
      });
      enrichedHeroAbilities = await Promise.all(
        (Array.isArray(system.heroAbilities) ? system.heroAbilities : Object.values(system.heroAbilities ?? {})).map(async (a, i) => ({
          ...a,
          enrichedDescription: await this._enrichWithCache(TextEditorClass, {
            actor,
            fieldKey: `heroAbilities.${i}.description`,
            text: a.description,
            secrets: actor.isOwner,
            relativeTo: actor
          }),
          index: i
        }))
      );
      enrichedWoundedHeroAbilities = await Promise.all(
        (Array.isArray(system.woundedHeroAbilities) ? system.woundedHeroAbilities : Object.values(system.woundedHeroAbilities ?? {})).map(async (a, i) => ({
          ...a,
          enrichedDescription: await this._enrichWithCache(TextEditorClass, {
            actor,
            fieldKey: `woundedHeroAbilities.${i}.description`,
            text: a.description,
            secrets: actor.isOwner,
            relativeTo: actor
          }),
          index: i
        }))
      );
    }

    let enrichedSurgeAbilities = [];
    let enrichedSpecialAbilities = [];
    if (actor.type === "villain" || actor.type === "ally") {
      enrichedSurgeAbilities = await Promise.all(
        (Array.isArray(system.attributes?.surgeAbilities) ? system.attributes.surgeAbilities : Object.values(system.attributes?.surgeAbilities ?? {})).map(async (a, i) => ({
          ...a,
          enrichedEffectText: await this._enrichWithCache(TextEditorClass, {
            actor,
            fieldKey: `surgeAbilities.${i}.effectText`,
            text: a.effectText,
            secrets: actor.isOwner,
            relativeTo: actor
          }),
          index: i
        }))
      );
    }
    if (actor.type === "villain" || actor.type === "ally") {
      enrichedSpecialAbilities = await Promise.all(
        (Array.isArray(system.specialAbilities) ? system.specialAbilities : Object.values(system.specialAbilities ?? {})).map(async (a, i) => ({
          ...a,
          enrichedName: await this._enrichWithCache(TextEditorClass, {
            actor,
            fieldKey: `specialAbilities.${i}.name`,
            text: a.name,
            secrets: actor.isOwner,
            relativeTo: actor,
            sanitize: true
          }),
          enrichedDescription: await this._enrichWithCache(TextEditorClass, {
            actor,
            fieldKey: `specialAbilities.${i}.description`,
            text: a.description,
            secrets: actor.isOwner,
            relativeTo: actor
          }),
          index: i
        }))
      );
    }

    // Collect owned items grouped by type
    const ownedItems = actor.items?.contents ?? [];
    const abilities = ownedItems.filter(i => i.type === "classcard");
    const allMods = ownedItems.filter(i => i.type === "weaponmod");
    const modContext = (m) => ({
      id: m.id,
      name: m.name,
      img: m.img,
      cardState: m.system?.cardState ?? "ready",
      compatType: m.system?.modCompatType || "melee",
      bonusDamage: Number(m.system?.bonusDamage) || 0,
      bonusAccuracy: Number(m.system?.bonusAccuracy) || 0,
      bonusRedDice: SWIAActorSheet._diceArray(m.system?.bonusDice?.red),
      bonusBlueDice: SWIAActorSheet._diceArray(m.system?.bonusDice?.blue),
      bonusGreenDice: SWIAActorSheet._diceArray(m.system?.bonusDice?.green),
      bonusYellowDice: SWIAActorSheet._diceArray(m.system?.bonusDice?.yellow),
      surgeLines: SWIAActorSheet._surgeLines(m)
    });
    const weapons = await Promise.all(
      ownedItems.filter(i => i.type === "weapon").map(async w => {
        const dice = w.system?.attackDice || {};
        const abilitiesRaw = Array.isArray(w.system?.abilities)
          ? w.system.abilities
          : Object.values(w.system?.abilities || {});
        const enrichedAbilities = await Promise.all(
          abilitiesRaw.map(async (a, i) => ({
            ...a,
            enrichedDescription: await this._enrichWithCache(TextEditorClass, {
              actor,
              fieldKey: `weapon.${w.id}.abilities.${i}.description`,
              text: a.description,
              secrets: actor.isOwner,
              relativeTo: w
            })
          }))
        );
        // Attached mods: effective dice + flat-bonus tags + nested rows
        const attachedMods = allMods
          .filter((m) => m.system?.attachedWeaponId === w.id)
          .map(modContext);
        const modDice = { red: 0, blue: 0, green: 0, yellow: 0 };
        const modBonusTags = [];
        for (const m of attachedMods) {
          modDice.red += m.bonusRedDice.length;
          modDice.blue += m.bonusBlueDice.length;
          modDice.green += m.bonusGreenDice.length;
          modDice.yellow += m.bonusYellowDice.length;
          if (m.bonusDamage) modBonusTags.push(game.i18n.format("SWIA.Inventory.ModBonusDamage", { value: m.bonusDamage, name: m.name }));
          if (m.bonusAccuracy) modBonusTags.push(game.i18n.format("SWIA.Inventory.ModBonusAccuracy", { value: m.bonusAccuracy, name: m.name }));
        }
        // Mod surge lines join the weapon's list, tagged with their source
        const surgeLines = SWIAActorSheet._surgeLines(w).concat(
          attachedMods.flatMap((m) => m.surgeLines.map((s) => ({ ...s, source: m.name })))
        );
        const slotsTotal = Math.max(0, Number(w.system?.attachmentSlots) || 0);
        // Pool substitution: show the wielder's current attribute pool
        // (wounded-aware) as this weapon's base dice, with a note.
        const poolAttr = ["strength", "insight", "tech"].includes(w.system?.poolAttribute)
          ? w.system.poolAttribute : null;
        const baseDice = poolAttr ? (attrSet?.[poolAttr] ?? {}) : dice;
        const poolNote = poolAttr
          ? game.i18n.format("SWIA.Inventory.PoolNote", {
              attr: game.i18n.localize(`SWIA.Attributes.${poolAttr.charAt(0).toUpperCase()}${poolAttr.slice(1)}`)
            })
          : "";
        return {
          id: w.id,
          name: w.name,
          img: w.img,
          system: w.system,
          enrichedAbilities,
          poolNote,
          attackRedDice: SWIAActorSheet._diceArray(baseDice.red),
          attackBlueDice: SWIAActorSheet._diceArray(baseDice.blue),
          attackGreenDice: SWIAActorSheet._diceArray(baseDice.green),
          attackYellowDice: SWIAActorSheet._diceArray(baseDice.yellow),
          modRedDice: SWIAActorSheet._diceArray(modDice.red),
          modBlueDice: SWIAActorSheet._diceArray(modDice.blue),
          modGreenDice: SWIAActorSheet._diceArray(modDice.green),
          modYellowDice: SWIAActorSheet._diceArray(modDice.yellow),
          modBonusTags,
          attachedMods,
          surgeLines,
          slotsTotal,
          slotsUsed: attachedMods.length,
          showSlots: slotsTotal > 0 || attachedMods.length > 0,
          // attachmentSlots defaults to 0 = "no slots": such weapons are
          // always full, and pre-existing over-attachment shows a red badge.
          slotsFull: attachedMods.length >= slotsTotal,
          // Compact rows: surge text, printed abilities and attached mods sit
          // in a details block that opens on demand.
          hasDetails: surgeLines.length > 0 || attachedMods.length > 0
            || enrichedAbilities.some((a) => a?.enrichedDescription),
          expanded: this._expandedItems.has(w.id)
        };
      })
    );
    const gear = ownedItems.filter(i => i.type === "gear");

    // Unattached mods: owned weaponmods pointing at nothing (or a weapon the
    // actor no longer owns). Each gets an attach-target list with slot and
    // melee/ranged compatibility baked in.
    const weaponById = new Map(weapons.map((w) => [w.id, w]));
    const unattachedMods = allMods
      .filter((m) => !weaponById.has(m.system?.attachedWeaponId ?? ""))
      .map((m) => {
        const ctx = modContext(m);
        ctx.attachTargets = weapons.map((w) => ({
          id: w.id,
          label: `${w.name} (${w.slotsUsed}/${w.slotsTotal})`,
          disabled: w.slotsFull || (w.system?.range ?? "melee") !== ctx.compatType
        }));
        return ctx;
      });

    // Armor: printed Health/Block/Evade shown as chips; equipped pieces feed
    // the derived max health and the defender's Block/Evade seed.
    const armorItems = ownedItems.filter(i => i.type === "armor").map((a) => ({
      id: a.id,
      name: a.name,
      img: a.img,
      cardState: a.system?.cardState ?? "ready",
      equipped: a.system?.equipped ?? true,
      bonusHealth: Number(a.system?.bonusHealth) || 0,
      bonusBlock: Number(a.system?.bonusBlock) || 0,
      bonusEvade: Number(a.system?.bonusEvade) || 0
    }));
    const armorFx = armorEffectsFor(actor);

    // Form card (Shift) context — villain only
    let formCards = [];
    let activeForm = null;
    let enrichedFormSurgeAbilities = [];
    let enrichedFormSpecialAbilities = [];
    if (actor.type === "villain" && system.hasShift) {
      formCards = ownedItems.filter(i => i.type === "formcard");
      activeForm = system.activeFormId ? (actor.items.get(system.activeFormId) ?? null) : null;
      if (activeForm) {
        const fSurge = Array.isArray(activeForm.system?.surgeAbilities)
          ? activeForm.system.surgeAbilities
          : Object.values(activeForm.system?.surgeAbilities ?? {});
        enrichedFormSurgeAbilities = await Promise.all(
          fSurge.map(async (a, i) => ({
            ...a,
            enrichedEffectText: await this._enrichWithCache(TextEditorClass, {
              actor,
              fieldKey: `form.${activeForm.id}.surgeAbilities.${i}.effectText`,
              text: a.effectText,
              secrets: actor.isOwner,
              relativeTo: actor
            }),
            index: i
          }))
        );
        const fSpecial = Array.isArray(activeForm.system?.specialAbilities)
          ? activeForm.system.specialAbilities
          : Object.values(activeForm.system?.specialAbilities ?? {});
        enrichedFormSpecialAbilities = await Promise.all(
          fSpecial.map(async (a, i) => ({
            ...a,
            enrichedName: await this._enrichWithCache(TextEditorClass, {
              actor,
              fieldKey: `form.${activeForm.id}.specialAbilities.${i}.name`,
              text: a.name,
              secrets: actor.isOwner,
              relativeTo: actor,
              sanitize: true
            }),
            enrichedDescription: await this._enrichWithCache(TextEditorClass, {
              actor,
              fieldKey: `form.${activeForm.id}.specialAbilities.${i}.description`,
              text: a.description,
              secrets: actor.isOwner,
              relativeTo: actor
            }),
            index: i
          }))
        );
      }
    }

    return foundry.utils.mergeObject(context, {
      actor: actor,
      systemData: system,
      isWounded: isWounded,
      isDefeated: system.state?.defeated ?? false,
      isActivated: system.state?.activated ?? false,
      isGM: game.user?.isGM ?? false,
      editMode: this._editMode ?? false,
      isEditable: actor.isOwner ?? true,
      companionOwnerChoices: actor.type === "ally"
        ? (game.actors?.contents ?? [])
            .filter((a) => ["hero", "villain"].includes(a.type))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => ({
              id: a.id,
              label: `${a.name} (${game.i18n.localize(`SWIA.Actor.${a.type.charAt(0).toUpperCase()}${a.type.slice(1)}`)})`,
              selected: a.id === system.companionOf
            }))
        : [],
      currentAttrPath: currentAttrPath,
      currentAttributes: system[currentAttrPath] ?? system.attributes,
      editStatTab,
      editAttrPath,
      editAttributes,
      editHealthBaseMax,
      editHealthArmorBonus,
      hasFreeCustomSlot: customSlots.some((s) => !s.enabled),
      config: CONFIG.SWIA ?? {},
      profileSrc,
      tokenPreviewSrc,
      woundedTokenPreviewSrc,
      tokenFootprint,
      enrichedBiography: enrichedBiography,
      enrichedWoundedBiography: enrichedWoundedBiography,
      enrichedHeroAbilities: enrichedHeroAbilities,
      abilitiesOpen: this._abilitiesOpen,
      heroAbilityCount: (isWounded ? enrichedWoundedHeroAbilities : enrichedHeroAbilities)?.length ?? 0,
      enrichedWoundedHeroAbilities: enrichedWoundedHeroAbilities,
      enrichedSurgeAbilities: enrichedSurgeAbilities,
      enrichedSpecialAbilities: enrichedSpecialAbilities,
      abilities: abilities,
      weapons: weapons,
      gear: gear,
      armorItems,
      unattachedMods,
      hasUnattachedMods: unattachedMods.length > 0,
      hasItems: ownedItems.length > 0,
      sectionCollapse: this._collapsedSections,
      formCards: formCards,
      activeForm: activeForm,
      enrichedFormSurgeAbilities: enrichedFormSurgeAbilities,
      enrichedFormSpecialAbilities: enrichedFormSpecialAbilities,
      // Convert dice counts to arrays for Handlebars iteration (each loop)
      // This allows displaying individual dice blocks in the template
      defenseBlackDice: SWIAActorSheet._diceArray(defense.black),
      defenseWhiteDice: SWIAActorSheet._diceArray(defense.white),
      armorBlock: armorFx.block,
      armorEvade: armorFx.evade,
      powerTokens: powerTokenRows(actor, { editable: Boolean(game.user?.isGM) }),
      canEditTokens: Boolean(game.user?.isGM),
      conditions: conditionRows(actor),
      conditionChoices: conditionChoices(actor),
      hasActionStrain: conditionRows(actor).some((c) => c.actionStrain > 0),
      hasEndOfActivation: hasEndOfActivationConditions(actor),
      canManage: Boolean(game.user?.isGM || actor.isOwner),
      attackRedDice: SWIAActorSheet._diceArray(attack.red),
      attackBlueDice: SWIAActorSheet._diceArray(attack.blue),
      attackGreenDice: SWIAActorSheet._diceArray(attack.green),
      attackYellowDice: SWIAActorSheet._diceArray(attack.yellow),
      strengthRedDice: SWIAActorSheet._diceArray(woundedStrength.red),
      strengthBlueDice: SWIAActorSheet._diceArray(woundedStrength.blue),
      strengthGreenDice: SWIAActorSheet._diceArray(woundedStrength.green),
      strengthYellowDice: SWIAActorSheet._diceArray(woundedStrength.yellow),
      insightRedDice: SWIAActorSheet._diceArray(woundedInsight.red),
      insightBlueDice: SWIAActorSheet._diceArray(woundedInsight.blue),
      insightGreenDice: SWIAActorSheet._diceArray(woundedInsight.green),
      insightYellowDice: SWIAActorSheet._diceArray(woundedInsight.yellow),
      techRedDice: SWIAActorSheet._diceArray(woundedTech.red),
      techBlueDice: SWIAActorSheet._diceArray(woundedTech.blue),
      techGreenDice: SWIAActorSheet._diceArray(woundedTech.green),
      techYellowDice: SWIAActorSheet._diceArray(woundedTech.yellow),
      customSlots
    });
  }

  // Toggle active inventory panel (Abilities / Items / Weapons)
  // Compact rows: open/close an item's details block in place (no re-render).
  _onToggleItemDetails(event, target) {
    event?.preventDefault?.();
    const entry = (target ?? event?.currentTarget)?.closest?.("[data-item-id]");
    const itemId = entry?.dataset?.itemId;
    const details = entry?.querySelector?.(":scope > .weapon-details, :scope > .item-details");
    if (!itemId || !details) return;
    const open = details.hasAttribute("hidden");
    details.toggleAttribute("hidden", !open);
    entry.classList.toggle("expanded", open);
    entry.querySelector(".item-expand-btn")?.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) this._expandedItems.add(itemId); else this._expandedItems.delete(itemId);
  }

  // Toggle hero wounded state (heroes only)
  async _onToggleWounded(event, target) {
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "hero") return;
    // Works from either a checkbox (reads .checked) or the state pill button
    // (flips the current state).
    const el = target ?? event?.currentTarget;
    const next = el?.type === "checkbox" ? Boolean(el.checked) : !actor.system.state?.wounded;
    await requestWoundedState(actor, next);
  }

  // Toggle defeated state (heroes only, only valid when wounded)
  async _onToggleDefeated(event, target) {
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "hero") return;
    const el = target ?? event?.currentTarget;
    const next = el?.type === "checkbox" ? Boolean(el.checked) : !actor.system.state?.defeated;
    await setDefeatedState(actor, next);
  }

  // Toggle activation state (all actor types)
  async _onToggleActivated(event, target) {
    event.preventDefault();
    const actor = this.document ?? this.actor;
    
    const currentState = actor.system.state?.activated ?? false;
    await actor.update({ "system.state.activated": !currentState });
  }

  // Set attack type (ranged/melee) for ally and imperial actors
  async _onSetAttackType(event, target) {
    event.preventDefault();
    const actor = this.document ?? this.actor;
    if (!actor || (actor.type !== "ally" && actor.type !== "villain")) return;
    const el = target ?? event?.currentTarget;
    const type = el?.dataset?.value;
    if (!type) return;
    await actor.update({ "system.attributes.attackType": type });
  }

  _onToggleSectionCollapse(event, target) {
    event?.preventDefault?.();
    if (!this._editMode) return;

    const toggle = target ?? event?.currentTarget;
    const section = toggle?.dataset?.section;
    if (!section) return;

    const current = Boolean(this._collapsedSections?.[section]);
    const isCollapsed = !current;
    this._collapsedSections[section] = isCollapsed;

    const root = this.element;
    const sectionEl = toggle?.closest?.(".collapsible-section")
      ?? (root instanceof HTMLElement
        ? root.querySelector(`.collapsible-section [data-action='toggleSectionCollapse'][data-section='${section}']`)?.closest(".collapsible-section")
        : null);

    if (sectionEl instanceof HTMLElement) {
      sectionEl.classList.toggle("collapsed", isCollapsed);
      sectionEl.classList.toggle("expanded", !isCollapsed);
    }

    if (toggle instanceof HTMLElement) {
      toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      const indicator = toggle.querySelector(".section-toggle-indicator");
      if (indicator) indicator.textContent = isCollapsed ? "+" : "-";
    }
  }

  async _onApplyTokenFootprintPreset(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "villain") return;
    if (!game.user?.isGM || !this._editMode) return;

    const el = target ?? event?.currentTarget;
    const width = Number(el?.dataset?.width);
    const height = Number(el?.dataset?.height);
    const scale = Number(el?.dataset?.scale ?? "1");
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

    await actor.update({
      "prototypeToken.width": width,
      "prototypeToken.height": height,
      "prototypeToken.texture.scaleX": safeScale,
      "prototypeToken.texture.scaleY": safeScale
    });

    await this._syncActiveTokenFootprint(actor, {
      width,
      height,
      scaleX: safeScale,
      scaleY: safeScale
    }, true);
  }

  // Open an owned item's sheet
  async _onOpenItem(event, target) {
    event?.preventDefault?.();
    const el = target ?? event?.currentTarget;
    const itemId = el?.closest("[data-item-id]")?.dataset?.itemId;
    if (!itemId) return;
    const actor = this.document ?? this.actor;
    const item = actor.items.get(itemId);
    if (item) item.sheet.render(true);
  }

  // Delete an owned item
  async _onDeleteItem(event, target) {
    event?.preventDefault?.();
    const el = target ?? event?.currentTarget;
    const itemId = el?.closest("[data-item-id]")?.dataset?.itemId;
    if (!itemId) return;
    const actor = this.document ?? this.actor;
    const item = actor.items.get(itemId);
    if (!item) return;
    const safeItemName = escapeHTML(item.name);
    const safeActorName = escapeHTML(actor.name);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Delete ${safeItemName}` },
      content: `<p>Remove <strong>${safeItemName}</strong> from ${safeActorName}?</p>`,
      rejectClose: false
    });
    if (confirmed) await item.delete();
  }

  // Cycle card state on an owned item: ready → exhausted → depleted → ready
  async _onCycleItemState(event, target) {
    event?.preventDefault?.();
    const el = target ?? event?.currentTarget;
    const itemId = el?.closest("[data-item-id]")?.dataset?.itemId;
    if (!itemId) return;
    const actor = this.document ?? this.actor;
    const item = actor.items.get(itemId);
    if (!item) return;
    const current = item.system.cardState || "ready";
    const cycle = { ready: "exhausted", exhausted: "depleted", depleted: "ready" };
    await item.update({ "system.cardState": cycle[current] || "ready" });
  }

  async _onEditImage(event, target) {
    if (!game.user?.isGM || !this._editMode) return;
    const path = target?.dataset?.path || target?.dataset?.edit;
    if (!path) return;
    const doc = this.document ?? this.actor;
    const getProp = foundry.utils.getProperty;
    const current = getProp(doc, path) || "";

    const FilePickerClass = foundry?.applications?.apps?.FilePicker?.implementation
      ?? foundry?.applications?.api?.FilePicker;
    const sheet = this;
    const fp = new FilePickerClass({
      type: "image",
      current,
      callback: async (url) => {
        console.log(`Updating ${path} with ${url}`);
        const updateObj = {};
        // Portrait and healthy token images stay in sync unless editing wounded art.
        if (path === "system.woundedTokenImage") {
          updateObj[path] = url;
          if (doc.type === "hero" && (doc.system?.state?.wounded ?? false)) {
            updateObj["prototypeToken.texture.src"] = url;
          }
        } else if (path === "img" || path === "prototypeToken.texture.src") {
          updateObj.img = url;
          updateObj["prototypeToken.texture.src"] = url;
        } else {
          updateObj[path] = url;
        }
        await doc.update(updateObj);
        if (path === "system.woundedTokenImage" && doc.type === "hero" && (doc.system?.state?.wounded ?? false)) {
          await sheet._syncActiveTokenTextures(doc, url);
        }
        // Re-render to refresh the portrait immediately
        try { sheet.render(false); } catch (e) { /* noop */ }
      }
    });
    fp.render(true);
  }

  // Toggle edit mode (GM only) - enables field editing and image selection
  async _onToggleEdit(event, target) {
    const checked = Boolean(target?.checked);
    const wasEditing = this._editMode;
    this._editMode = checked && (game.user?.isGM ?? false);

    // If turning edit mode off, submit the form so name/fields persist
    if (!this._editMode && wasEditing) {
      await this._saveFormData();
    }

    // Re-render to reflect disabled/enabled fields
    this.render(false);
  }

  // Update actor name when changed in edit mode
  async _onChangeName(event, target) {
    const nameInput = target ?? event?.currentTarget;
    const value = nameInput?.value?.trim();
    const actor = this.document ?? this.actor;
    if (!actor) return;
    if (!value) return;
    if (value === actor.name) return;
    try {
      await actor.update({ name: value });
    } catch (err) {
      console.error("SWIA: Failed to update name", err);
    }
  }

  async close(options) {
    this._cardPreviewAbort?.abort();
    this._cardPreviewAbort = null;
    hideCardPreview();
    this._enrichCache?.clear?.();
    return super.close(options);
  }

  /**
   * Collect current form data and persist key fields, even if submit is skipped.
   */
  async _saveFormData() {
    const formData = this._collectFormData();
    if (!formData || Object.keys(formData).length === 0) return;

    const actor = this.document ?? this.actor;
    if (!actor) return;

    // Strip out dot-notation array-indexed keys (e.g. "system.attributes.surgeAbilities.0.cost").
    // Passing these flat to actor.update causes Foundry's internal expandObject to produce a plain
    // object like { "0": {...} } instead of a real JS array, which breaks .length checks in the
    // template. Instead, save those array fields via their dedicated handlers which build proper arrays.
    const ARRAY_PATH_PATTERNS = [
      /^system\.attributes\.surgeAbilities\.\d+\./,
      /^system\.specialAbilities\.\d+\./,
      /^system\.heroAbilities\.\d+\./,
      /^system\.woundedHeroAbilities\.\d+\./,
    ];

    const scalarData = {};
    for (const [key, value] of Object.entries(formData)) {
      if (!ARRAY_PATH_PATTERNS.some(re => re.test(key))) {
        scalarData[key] = value;
      }
    }

    try {
      if (Object.keys(scalarData).length > 0) await actor.update(scalarData);
      // Re-save array fields as proper arrays from the current DOM.
      // Only for actor types that own these fields.
      if (actor.type === "villain" || actor.type === "ally") await this._onSurgeAbilityChange(null);
      if (actor.type === "villain" || actor.type === "ally") await this._onSpecialAbilityChange(null);
      // Save active form card abilities if Shift is enabled
      if (actor.type === "villain" && actor.system.hasShift && actor.system.activeFormId) {
        await this._onFormCardSurgeAbilityChange(null);
        await this._onFormCardSpecialAbilityChange(null);
      }
    } catch (err) {
      console.error("SWIA: Failed to save form data", err);
    }
  }

  /**
   * Gather form data directly from the DOM.
   * Handles disabled inputs which are normally skipped by the FormData API.
   */
  _collectFormData() {
    const searchRoot = this.element;
    let formElem = null;
    if (searchRoot?.tagName === "FORM") {
      formElem = searchRoot;
    } else if (searchRoot) {
      formElem = searchRoot.querySelector("form[data-application-part='form']") || searchRoot.querySelector("form");
    }

    if (formElem) {
      // FormData skips disabled inputs, so we need to temporarily enable them or read manually
      // Read inputs manually to capture disabled fields
      const result = {};
      const allInputs = formElem.querySelectorAll("input[name], textarea[name], select[name]");
      allInputs.forEach(input => {
        if (input.name) {
          if (input.type === "checkbox") {
            result[input.name] = input.checked;
          } else if (input.type === "number") {
            result[input.name] = input.value ? Number(input.value) : 0;
          } else {
            result[input.name] = input.value;
          }
        }
      });
      
      return result;
    }

    // Final fallback: manually read key inputs
    const elem = formElem ?? searchRoot;
    if (!elem) return {};
    
    const nameInput = elem.querySelector("input[name='name']");
    const result = {};
    if (nameInput?.value) result.name = nameInput.value;
    
    // Gather system fields
    const inputs = elem.querySelectorAll("input[name^='system.'], textarea[name^='system.']");
    inputs.forEach(input => {
      if (input.name && input.value !== undefined) {
        result[input.name] = input.value;
      }
    });
    
    return result;
  }

  // Intercept item drops dispatched by core sheet drop handling
  async _onDropItem(event, data) {
    if (await this._interceptHeroAbilityDrop(data)) return;
    return super._onDropItem?.(event, data);
  }

  // Intercept change events for surge/special ability inputs and save directly.
  // This bypasses native form submission which can fail for nested array fields.
  _onChangeForm(formConfig, event) {
    if (event.target?.closest(".form-surge-ability-entry")) {
      this._onFormCardSurgeAbilityChange(event);
      return;
    }
    if (event.target?.closest(".form-special-ability-entry")) {
      this._onFormCardSpecialAbilityChange(event);
      return;
    }
    if (event.target?.closest(".surge-ability-entry")) {
      this._onSurgeAbilityChange(event);
      return;
    }
    if (event.target?.closest(".special-ability-entry")) {
      this._onSpecialAbilityChange(event);
      return;
    }
    super._onChangeForm(formConfig, event);
  }

  // Attach a native drop listener after each render
  // Grant / remove one power token (GM only; shared with the portal).
  async _onAdjustPowerToken(event, target) {
    event.preventDefault();
    if (!game.user?.isGM) return;
    const actor = this.document ?? this.actor;
    const type = target?.dataset?.token;
    const delta = Number(target?.dataset?.delta) || 0;
    if (delta > 0) await grantPowerToken(actor, type);
    else if (delta < 0) await removePowerToken(actor, type);
  }

  // Condition chips: discard / spend action / suffer strain / end activation /
  // add (GM or owner; shared helpers with the portal).
  async _onConditionAction(event, target) {
    event.preventDefault();
    const actor = this.document ?? this.actor;
    if (!(game.user?.isGM || actor?.isOwner)) return;
    await runConditionAction(actor, target, this.element);
  }

  // Armor equip toggle: flips system.equipped.
  async _onToggleEquipArmor(event, target) {
    event.preventDefault();
    const actor = this.document ?? this.actor;
    const itemId = target?.closest?.("[data-item-id]")?.dataset?.itemId;
    await toggleArmorEquipped(itemId ? actor?.items?.get(itemId) : null);
  }

  // Post an item's card to chat: the scan when the item has one, a generated
  // card otherwise.
  async _onPostItemCard(event, target) {
    event.preventDefault();
    hideCardPreview();
    await postItemCardFromElement(this.document ?? this.actor, target);
  }

  // Status phase helper: ready every exhausted card on this actor in one
  // click (weapons, mods, armor, class cards, gear). Depleted cards stay.
  async _onReadyAllItems(event) {
    event.preventDefault();
    await readyAllItemsWithNotice(this.document ?? this.actor);
  }

  // Detach a mod from its weapon (clears attachedWeaponId; mod moves to the
  // unattached pool).
  async _onDetachMod(event, target) {
    event.preventDefault();
    const actor = this.document ?? this.actor;
    const modId = target?.closest?.("[data-mod-id]")?.dataset?.modId;
    const mod = modId ? actor?.items?.get(modId) : null;
    if (!mod || mod.type !== "weaponmod") return;
    await mod.update({ "system.attachedWeaponId": "" });
  }

  // Attach a mod to a weapon, re-validating slots and melee/ranged
  // compatibility (the select already disables invalid targets, but the data
  // can change between render and change).
  async _attachMod(modId, weaponId) {
    const actor = this.document ?? this.actor;
    const mod = actor?.items?.get(modId);
    const weapon = actor?.items?.get(weaponId);
    if (!mod || mod.type !== "weaponmod" || !weapon || weapon.type !== "weapon") return;
    const compat = mod.system?.modCompatType || "melee";
    if ((weapon.system?.range ?? "melee") !== compat) {
      ui.notifications?.warn(game.i18n.format("SWIA.Inventory.ModIncompatible", { mod: mod.name, weapon: weapon.name }));
      return;
    }
    const slots = Math.max(0, Number(weapon.system?.attachmentSlots) || 0);
    const used = (actor.items?.contents ?? []).filter(
      (i) => i.type === "weaponmod" && i.system?.attachedWeaponId === weapon.id
    ).length;
    if (used >= slots) {
      ui.notifications?.warn(game.i18n.format("SWIA.Inventory.ModSlotsFull", { weapon: weapon.name }));
      return;
    }
    await mod.update({ "system.attachedWeaponId": weapon.id });
  }

  _onRender(context, options) {
    if (typeof super._onRender === "function") super._onRender(context, options);
    const el = this.element;
    // Hover previews rebind every render; the old listeners die with the
    // replaced DOM, and aborting drops any stale scroll handlers.
    this._cardPreviewAbort?.abort();
    this._cardPreviewAbort = new AbortController();
    bindCardPreviews(el, { signal: this._cardPreviewAbort.signal });

    // Hero-abilities disclosure: remember open/closed across re-renders.
    const disclosure = el?.querySelector?.("details.hero-ability-disclosure");
    disclosure?.addEventListener("toggle", () => { this._abilitiesOpen = disclosure.open; },
      { signal: this._cardPreviewAbort.signal });
    // Attach-mod selects re-render each pass; bind fresh every time.
    for (const select of el?.querySelectorAll?.(".mod-attach-select") ?? []) {
      select.addEventListener("change", (event) => {
        const weaponId = event.currentTarget.value;
        const modId = event.currentTarget.closest("[data-mod-id]")?.dataset?.modId;
        event.currentTarget.value = "";
        if (weaponId && modId) this._attachMod(modId, weaponId).catch((err) => console.error("SWIA | attach mod failed", err));
      });
    }
    if (!el || el._swiaHeroDropBound) return;
    el._swiaHeroDropBound = true;
    el.addEventListener("drop", async (event) => {
      let data;
      try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
      if (data?.type !== "Item") return;
      await this._interceptHeroAbilityDrop(data);
    });
  }

  // Shared: resolve dropped item, push onto the correct heroAbilities field
  async _interceptHeroAbilityDrop(data) {
    const actor = this.document ?? this.actor;
    if (actor?.type !== "hero") return false;

    let item;
    try { item = data?.uuid ? await fromUuid(data.uuid) : null; } catch { return false; }
    if (item?.type !== "heroability") return false;

    const isWounded = actor.system.state?.wounded ?? false;
    const field = isWounded ? "woundedHeroAbilities" : "heroAbilities";
    const raw = foundry.utils.deepClone(actor.system[field] ?? []);
    const current = Array.isArray(raw) ? raw : Object.values(raw);
    current.push({
      name: item.name,
      description: item.system.abilityText ?? item.system.description ?? "",
      sourceUuid: item.uuid
    });
    await actor.update({ [`system.${field}`]: current });
    return true;
  }

  // Add a blank hero ability (healthy or wounded)
  async _onAddHeroAbility(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "hero") return;
    const el = target ?? event?.currentTarget;
    const field = el?.dataset?.field ?? "heroAbilities";
    const raw = foundry.utils.deepClone(actor.system[field] ?? []);
    const current = Array.isArray(raw) ? raw : Object.values(raw);
    current.push({ name: "", description: "" });
    await actor.update({ [`system.${field}`]: current });
  }

  // Remove a hero ability by index (healthy or wounded)
  async _onRemoveHeroAbility(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "hero") return;
    const el = target ?? event?.currentTarget;
    const field = el?.dataset?.field ?? "heroAbilities";
    const idx = parseInt(el?.dataset?.index ?? "-1", 10);
    if (idx < 0) return;
    const raw = foundry.utils.deepClone(actor.system[field] ?? []);
    const current = Array.isArray(raw) ? raw : Object.values(raw);
    current.splice(idx, 1);
    await actor.update({ [`system.${field}`]: current });
  }

  // Add a blank surge ability to villain or ally
  async _onAddSurgeAbility(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || (actor.type !== "villain" && actor.type !== "ally")) return;
    const raw = foundry.utils.deepClone(actor.system.attributes?.surgeAbilities ?? []);
    const current = Array.isArray(raw) ? raw : Object.values(raw);
    current.push({ cost: 1, effectText: "" });
    await actor.update({ "system.attributes.surgeAbilities": current });
  }

  // Remove a surge ability by index from villain or ally
  async _onRemoveSurgeAbility(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || (actor.type !== "villain" && actor.type !== "ally")) return;
    const el = target ?? event?.currentTarget;
    const idx = parseInt(el?.dataset?.index ?? "-1", 10);
    if (idx < 0) return;
    const raw = foundry.utils.deepClone(actor.system.attributes?.surgeAbilities ?? []);
    const current = Array.isArray(raw) ? raw : Object.values(raw);
    current.splice(idx, 1);
    await actor.update({ "system.attributes.surgeAbilities": current });
  }

  // Save surge ability fields when any input changes
  async _onSurgeAbilityChange(event) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor) return;
    const container = event?.target?.closest("form") ?? this.form ?? this.element;
    if (!container) return;
    const entries = container.querySelectorAll(".surge-ability-entry");
    const updated = [];
    entries.forEach(entry => {
      const costInput = entry.querySelector("input.surge-cost-input");
      const effectInput = entry.querySelector("input.surge-effect-input");
      updated.push({
        cost: costInput ? (Number(costInput.value) || 1) : 1,
        effectText: effectInput?.value ?? ""
      });
    });
    await actor.update({ "system.attributes.surgeAbilities": updated });
  }

  // Save special ability fields when any input changes
  async _onSpecialAbilityChange(event) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor) return;
    const container = event?.target?.closest("form") ?? this.form ?? this.element;
    if (!container) return;
    const entries = container.querySelectorAll(".special-ability-entry");
    const updated = [];
    entries.forEach(entry => {
      const nameInput = entry.querySelector("input.special-ability-name");
      const descInput = entry.querySelector("textarea.special-ability-desc");
      updated.push({
        name: nameInput?.value ?? "",
        description: descInput?.value ?? ""
      });
    });
    await actor.update({ "system.specialAbilities": updated });
  }

  // Add a blank special ability to villain or ally
  async _onAddSpecialAbility(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || (actor.type !== "villain" && actor.type !== "ally")) return;
    const raw = foundry.utils.deepClone(actor.system.specialAbilities ?? []);
    const current = Array.isArray(raw) ? raw : Object.values(raw);
    current.push({ name: "", description: "", surgeCost: 0 });
    await actor.update({ "system.specialAbilities": current });
  }

  // Remove a special ability by index from villain or ally
  async _onRemoveSpecialAbility(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || (actor.type !== "villain" && actor.type !== "ally")) return;
    const el = target ?? event?.currentTarget;
    const idx = parseInt(el?.dataset?.index ?? "-1", 10);
    if (idx < 0) return;
    const raw = foundry.utils.deepClone(actor.system.specialAbilities ?? []);
    const current = Array.isArray(raw) ? raw : Object.values(raw);
    current.splice(idx, 1);
    await actor.update({ "system.specialAbilities": current });
  }

  // ── Form Card (Shift) methods ────────────────────────────────────────────

  // Resolve the currently active form card item document
  _getActiveFormItem() {
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "villain") return null;
    const formId = actor.system.activeFormId;
    if (!formId) return null;
    return actor.items.get(formId) ?? null;
  }

  // Toggle the hasShift flag on the villain
  async _onToggleShift(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "villain") return;
    const el = target ?? event?.currentTarget;
    const checked = Boolean(el?.checked ?? false);
    const update = { "system.hasShift": checked };
    if (!checked) update["system.activeFormId"] = "";
    await actor.update(update);
  }

  // Set the active form card from the dropdown
  async _onSetActiveForm(event, target) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "villain") return;
    const el = target ?? event?.currentTarget;
    const formId = el?.value ?? "";
    await actor.update({ "system.activeFormId": formId });
  }

  // Add a blank surge ability to the active form card
  async _onAddFormCardSurgeAbility(event, target) {
    event?.preventDefault?.();
    const formItem = this._getActiveFormItem();
    if (!formItem) return;
    const raw = Array.isArray(formItem.system.surgeAbilities)
      ? formItem.system.surgeAbilities
      : Object.values(formItem.system.surgeAbilities ?? {});
    await formItem.update({ "system.surgeAbilities": [...raw, { cost: 1, effectText: "" }] });
  }

  // Remove a surge ability by index from the active form card
  async _onRemoveFormCardSurgeAbility(event, target) {
    event?.preventDefault?.();
    const formItem = this._getActiveFormItem();
    if (!formItem) return;
    const el = target ?? event?.currentTarget;
    const idx = parseInt(el?.dataset?.index ?? "-1", 10);
    if (idx < 0) return;
    const raw = Array.isArray(formItem.system.surgeAbilities)
      ? formItem.system.surgeAbilities
      : Object.values(formItem.system.surgeAbilities ?? {});
    await formItem.update({ "system.surgeAbilities": raw.filter((_, i) => i !== idx) });
  }

  // Add a blank special ability to the active form card
  async _onAddFormCardSpecialAbility(event, target) {
    event?.preventDefault?.();
    const formItem = this._getActiveFormItem();
    if (!formItem) return;
    const raw = Array.isArray(formItem.system.specialAbilities)
      ? formItem.system.specialAbilities
      : Object.values(formItem.system.specialAbilities ?? {});
    await formItem.update({ "system.specialAbilities": [...raw, { name: "", description: "" }] });
  }

  // Remove a special ability by index from the active form card
  async _onRemoveFormCardSpecialAbility(event, target) {
    event?.preventDefault?.();
    const formItem = this._getActiveFormItem();
    if (!formItem) return;
    const el = target ?? event?.currentTarget;
    const idx = parseInt(el?.dataset?.index ?? "-1", 10);
    if (idx < 0) return;
    const raw = Array.isArray(formItem.system.specialAbilities)
      ? formItem.system.specialAbilities
      : Object.values(formItem.system.specialAbilities ?? {});
    await formItem.update({ "system.specialAbilities": raw.filter((_, i) => i !== idx) });
  }

  // Scrape form-surge-ability-entry rows from DOM and save to the active form card
  async _onFormCardSurgeAbilityChange(event) {
    event?.preventDefault?.();
    const formItem = this._getActiveFormItem();
    if (!formItem) return;
    const container = event?.target?.closest("form") ?? this.form ?? this.element;
    if (!container) return;
    const entries = container.querySelectorAll(".form-surge-ability-entry");
    const updated = [];
    entries.forEach(entry => {
      const costInput = entry.querySelector("input.surge-cost-input");
      const effectInput = entry.querySelector("input.surge-effect-input");
      updated.push({
        cost: costInput ? (Number(costInput.value) || 1) : 1,
        effectText: effectInput?.value ?? ""
      });
    });
    await formItem.update({ "system.surgeAbilities": updated });
  }

  // Scrape form-special-ability-entry rows from DOM and save to the active form card
  async _onFormCardSpecialAbilityChange(event) {
    event?.preventDefault?.();
    const formItem = this._getActiveFormItem();
    if (!formItem) return;
    const container = event?.target?.closest("form") ?? this.form ?? this.element;
    if (!container) return;
    const entries = container.querySelectorAll(".form-special-ability-entry");
    const updated = [];
    entries.forEach(entry => {
      const nameInput = entry.querySelector("input.special-ability-name");
      const descInput = entry.querySelector("textarea.special-ability-desc");
      updated.push({
        name: nameInput?.value ?? "",
        description: descInput?.value ?? ""
      });
    });
    await formItem.update({ "system.specialAbilities": updated });
  }
}
