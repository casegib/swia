// Import base classes for V1/V2 compatibility
const BaseActorSheetV2 = foundry.applications?.sheets?.ActorSheetV2;
const BaseActorSheetV1 = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;

// Create V2 base with Handlebars mixin if available, otherwise use V1
const BaseActorSheet = BaseActorSheetV2 && HandlebarsApplicationMixin 
  ? HandlebarsApplicationMixin(BaseActorSheetV2)
  : BaseActorSheetV1;
const isV2 = !!BaseActorSheetV2;

// Main actor sheet class supporting both V1 and V2 Foundry versions
export class SWIAActorSheet extends BaseActorSheet {
  static EDIT_COLLAPSE_DEFAULTS = {
    biography: true,
    heroAbilities: false,
    stats: false,
    weapons: false,
    abilities: true,
    items: true,
    surgeAbilities: false,
    specialAbilities: false
  };

  static _diceArray(n) {
    return Array.from({ length: n || 0 }, (_, i) => i);
  }

  // Track whether the sheet is in edit mode (GM only)
  constructor(...args) {
    super(...args);
    this._editMode = false;
    this._activeInventoryPanel = null;
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
    secrets
  }) {
    const normalizedText = `${text ?? ""}`;
    if (!normalizedText) return "";

    const ownerFlag = Boolean(secrets);
    const target = relativeTo ?? actor;
    const cacheKey = this._buildEnrichCacheKey({
      actorId: actor?.id,
      fieldKey,
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
    this._setCachedEnrichment(cacheKey, enriched);
    return enriched;
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
      toggleInventoryPanel: SWIAActorSheet.prototype._onToggleInventoryPanel,
      openItem: SWIAActorSheet.prototype._onOpenItem,
      deleteItem: SWIAActorSheet.prototype._onDeleteItem,
      cycleItemState: SWIAActorSheet.prototype._onCycleItemState,
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

  static get defaultOptions() {
    if (isV2) return {};
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["swia", "sheet", "actor"],
      template: "systems/swia/templates/actors/actor-sheet.hbs",
      width: 980,
      height: 700,
      resizable: true,
      submitOnChange: true
    });
  }

  static PARTS = {
    form: {
      template: "systems/swia/templates/actors/actor-sheet.hbs"
    }
  };

  get template() {
    return "systems/swia/templates/actors/actor-sheet.hbs";
  }

  get title() {
    const name = this.document?.name ?? this.actor?.name ?? "";
    return name || "";
  }

  _getHealthyTokenSrc(actor) {
    return actor?.img || actor?.prototypeToken?.texture?.src || "";
  }

  _getWoundedTokenSrc(actor) {
    return actor?.system?.woundedTokenImage || this._getHealthyTokenSrc(actor);
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
    if (!actor || !src) return;

    const tokenDocs = [];

    // Pull from canvas first when available, including both linked and unlinked tokens.
    if (typeof actor.getActiveTokens === "function") {
      const activeTokens = actor.getActiveTokens(false, true) || [];
      for (const token of activeTokens) {
        const tokenDoc = token?.document ?? token;
        if (tokenDoc?.id) tokenDocs.push(tokenDoc);
      }
    }

    // Fallback/coverage: scan scene token documents by actorId.
    for (const scene of game.scenes?.contents ?? []) {
      for (const tokenDoc of scene.tokens?.contents ?? []) {
        if (tokenDoc?.actorId !== actor.id) continue;
        if (tokenDocs.some(existing => existing.id === tokenDoc.id && existing.parent?.id === tokenDoc.parent?.id)) continue;
        tokenDocs.push(tokenDoc);
      }
    }

    if (!tokenDocs.length) return;

    const updates = [];
    for (const tokenDoc of tokenDocs) {
      if ((tokenDoc.texture?.src || "") === src) continue;
      updates.push(tokenDoc.update({ "texture.src": src }));
    }

    if (updates.length) await Promise.allSettled(updates);
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

  // Prepare rendering context for both V1 and V2
  // Converts dice counts to arrays for template iteration and handles wounded state
  async _prepareContext(options, baseContext = null) {
    const context = baseContext ?? (isV2 ? await super._prepareContext(options) : {});
    const actor = this.document ?? this.actor;
    const system = actor.system;
    // Determine which attribute set to display based on wounded state
    const isWounded = system.state?.wounded ?? false;
    const currentAttrPath = isWounded ? "woundedAttributes" : "attributes";
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
            relativeTo: actor
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
        return {
          id: w.id,
          name: w.name,
          img: w.img,
          system: w.system,
          enrichedAbilities,
          attackRedDice: SWIAActorSheet._diceArray(dice.red),
          attackBlueDice: SWIAActorSheet._diceArray(dice.blue),
          attackGreenDice: SWIAActorSheet._diceArray(dice.green),
          attackYellowDice: SWIAActorSheet._diceArray(dice.yellow),
        };
      })
    );
    const gear = ownedItems.filter(i => i.type === "gear");

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
              relativeTo: actor
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
      currentAttrPath: currentAttrPath,
      currentAttributes: system[currentAttrPath] ?? system.attributes,
      config: CONFIG.SWIA ?? {},
      profileSrc,
      tokenPreviewSrc,
      woundedTokenPreviewSrc,
      tokenFootprint,
      enrichedBiography: enrichedBiography,
      enrichedWoundedBiography: enrichedWoundedBiography,
      enrichedHeroAbilities: enrichedHeroAbilities,
      enrichedWoundedHeroAbilities: enrichedWoundedHeroAbilities,
      enrichedSurgeAbilities: enrichedSurgeAbilities,
      enrichedSpecialAbilities: enrichedSpecialAbilities,
      abilities: abilities,
      weapons: weapons,
      gear: gear,
      hasItems: ownedItems.length > 0,
      activeInventoryPanel: this._activeInventoryPanel,
      sectionCollapse: this._collapsedSections,
      formCards: formCards,
      activeForm: activeForm,
      enrichedFormSurgeAbilities: enrichedFormSurgeAbilities,
      enrichedFormSpecialAbilities: enrichedFormSpecialAbilities,
      // Convert dice counts to arrays for Handlebars iteration (each loop)
      // This allows displaying individual dice blocks in the template
      defenseBlackDice: SWIAActorSheet._diceArray(defense.black),
      defenseWhiteDice: SWIAActorSheet._diceArray(defense.white),
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
      techYellowDice: SWIAActorSheet._diceArray(woundedTech.yellow)
    });
  }

  async getData(options) {
    if (isV2) return this._prepareContext(options);

    const data = await super.getData(options);
    return this._prepareContext(options, data);
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Always bind name change (both V1 and V2) so the actor name persists immediately
    html.find("input[name='name']").on("change blur input", this._onChangeName.bind(this));

    if (isV2) return;
    // Bind wounded toggle for all users
    html.find("[data-action='toggleWounded']").on("change", this._onToggleWounded.bind(this));
    html.find("[data-action='toggleDefeated']").on("change", this._onToggleDefeated.bind(this));
    // Bind activation token click for all users
    html.find("[data-action='toggleActivated']").on("click", this._onToggleActivated.bind(this));
    // Bind edit toggle only for GM
    if (game.user?.isGM) {
      html.find("[data-action='toggleEdit']").on("change", this._onToggleEdit.bind(this));
    }
    html.find("[data-action='toggleSectionCollapse']").on("click", this._onToggleSectionCollapse.bind(this));
    html.find("[data-action='applyTokenFootprintPreset']").on("click", this._onApplyTokenFootprintPreset.bind(this));

    // Use event delegation for image clicks to handle edit mode changes
    html.on("click", ".profile-image.clickable, .token-image.clickable", (event) => {
      console.log("SWIA: Image clicked");
      this._onEditImageInstance(event, event.currentTarget);
    });

    html.find("[data-action='addEquipment']").on("click", this._onAddEquipment.bind(this));
    html.find("[data-action='removeRow']").on("click", this._onRemoveRow.bind(this));

    // Item management (V1)
    html.find("[data-action='openItem']").on("click", this._onOpenItem.bind(this));
    html.find("[data-action='deleteItem']").on("click", this._onDeleteItem.bind(this));
    html.find("[data-action='cycleItemState']").on("click", this._onCycleItemState.bind(this));
    html.find("[data-action='setAttackType']").on("click", this._onSetAttackType.bind(this));
    // Imperial/ally list actions (V1)
    html.find("[data-action='addSurgeAbility']").on("click", this._onAddSurgeAbility.bind(this));
    html.find("[data-action='removeSurgeAbility']").on("click", this._onRemoveSurgeAbility.bind(this));
    html.find("[data-action='addSpecialAbility']").on("click", this._onAddSpecialAbility.bind(this));
    html.find("[data-action='removeSpecialAbility']").on("click", this._onRemoveSpecialAbility.bind(this));
    html.find("[data-action='addHeroAbility']").on("click", this._onAddHeroAbility.bind(this));
    html.find("[data-action='removeHeroAbility']").on("click", this._onRemoveHeroAbility.bind(this));
    // Surge/special ability field editing (V1) - bypass form submission for array fields
    html.on("change", ".surge-ability-entry input", this._onSurgeAbilityChange.bind(this));
    html.on("change", ".special-ability-entry input, .special-ability-entry textarea", this._onSpecialAbilityChange.bind(this));
    // Form card (Shift) ability editing (V1)
    html.find("[data-action='toggleShift']").on("change", this._onToggleShift.bind(this));
    html.find("[data-action='setActiveForm']").on("change", this._onSetActiveForm.bind(this));
    html.find("[data-action='addFormCardSurgeAbility']").on("click", this._onAddFormCardSurgeAbility.bind(this));
    html.find("[data-action='removeFormCardSurgeAbility']").on("click", this._onRemoveFormCardSurgeAbility.bind(this));
    html.find("[data-action='addFormCardSpecialAbility']").on("click", this._onAddFormCardSpecialAbility.bind(this));
    html.find("[data-action='removeFormCardSpecialAbility']").on("click", this._onRemoveFormCardSpecialAbility.bind(this));
    html.on("change", ".form-surge-ability-entry input", this._onFormCardSurgeAbilityChange.bind(this));
    html.on("change", ".form-special-ability-entry input, .form-special-ability-entry textarea", this._onFormCardSpecialAbilityChange.bind(this));
    // Inventory panel tab switching (V1)
    html.find(".inv-tab-btn").on("click", this._onToggleInventoryPanel.bind(this));
  }

  // Toggle active inventory panel (Abilities / Items / Weapons)
  _onToggleInventoryPanel(event, target) {
    event?.preventDefault?.();
    const btn = target ?? event?.currentTarget;
    const panel = btn?.dataset?.panel;
    if (!panel) return;

    const wasSame = this._activeInventoryPanel === panel;
    this._activeInventoryPanel = wasSame ? null : panel;

    // Resize the Foundry window to accommodate the panel
    const targetWidth = this._activeInventoryPanel ? 900 : 620;
    try { this.setPosition({ width: targetWidth }); } catch (e) { /* noop */ }

    // Update panel/toggle classes directly to avoid re-running full sheet context preparation.
    const root = this.element?.[0] ?? this.element;
    if (!(root instanceof HTMLElement)) return;

    const panelClasses = ["inv-open-abilities", "inv-open-gear", "inv-open-weapons"];
    root.classList.remove(...panelClasses);
    root.classList.toggle("inv-panel-open", Boolean(this._activeInventoryPanel));
    if (this._activeInventoryPanel) {
      root.classList.add(`inv-open-${this._activeInventoryPanel}`);
    }

    const tabButtons = root.querySelectorAll(".inv-tab-btn[data-panel]");
    for (const tab of tabButtons) {
      const isActive = tab.dataset.panel === this._activeInventoryPanel;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  }

  // Toggle hero wounded state (heroes only)
  async _onToggleWounded(event, target) {
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "hero") return;

    const checkbox = target ?? event?.currentTarget;
    const isChecked = Boolean(checkbox?.checked);
    const nextTokenSrc = isChecked ? this._getWoundedTokenSrc(actor) : this._getHealthyTokenSrc(actor);
    const update = { "system.state.wounded": isChecked };
    if (!isChecked) update["system.state.defeated"] = false;

    // Reset the active health pool to its maximum when toggling between states
    if (isChecked) {
      const wMax = actor.system.woundedAttributes?.health?.max ?? actor.system.woundedAttributes?.health?.value ?? 0;
      update["system.woundedAttributes.health.value"] = wMax;
    } else {
      const hMax = actor.system.attributes?.health?.max ?? actor.system.attributes?.health?.value ?? 0;
      update["system.attributes.health.value"] = hMax;
    }

    if (nextTokenSrc) {
      update["prototypeToken.texture.src"] = nextTokenSrc;
    }

    try {
      await actor.update(update);
    } catch (error) {
      console.error("SWIA: Failed to toggle wounded state", error);
      ui.notifications?.error("Failed to toggle wounded state. Check console for validation errors.");
      return;
    }

    if (nextTokenSrc) {
      await this._syncActiveTokenTextures(actor, nextTokenSrc);
    }
  }

  // Toggle defeated state (heroes only, only valid when wounded)
  async _onToggleDefeated(event, target) {
    const actor = this.document ?? this.actor;
    if (!actor || actor.type !== "hero") return;
    if (!actor.system.state?.wounded) return;

    const checkbox = target ?? event?.currentTarget;
    const isChecked = Boolean(checkbox?.checked);
    await actor.update({ "system.state.defeated": isChecked });
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

    const root = this.element?.[0] ?? this.element;
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
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Delete ${item.name}` },
      content: `<p>Remove <strong>${item.name}</strong> from ${actor.name}?</p>`,
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

  // Open file picker for image selection (edit mode only)
  // Updates both profile and token images simultaneously
  async _onEditImageInstance(event, target) {
    event.preventDefault();
    if (!game.user?.isGM || !this._editMode) return;
    const path = target?.dataset?.path;
    if (!path) return;
    
    // Use this.actor for V1 compatibility
    const actor = this.actor || this.document;
    if (!actor) {
      console.error("SWIA: No actor found", { actor: this.actor, document: this.document });
      return;
    }
    
    const current = foundry.utils.getProperty(actor, path) || "";
    console.log(`SWIA: FilePicker opened for path: ${path}, current: ${current}`);

    // Use namespaced FilePicker to avoid deprecated global
    const FilePickerClass = foundry?.applications?.apps?.FilePicker?.implementation
      ?? foundry?.applications?.api?.FilePicker;
    const sheet = this;
    const callback = async (url) => {
      console.log(`SWIA: FilePicker selected URL: ${url}`);
      const updateObj = {};
      // Portrait and healthy token images stay in sync unless editing wounded art.
      if (path === "system.woundedTokenImage") {
        updateObj[path] = url;
        if (actor.type === "hero" && (actor.system?.state?.wounded ?? false)) {
          updateObj["prototypeToken.texture.src"] = url;
        }
      } else if (path === "img" || path === "prototypeToken.texture.src") {
        updateObj.img = url;
        updateObj["prototypeToken.texture.src"] = url;
      } else {
        updateObj[path] = url;
      }
      console.log(`SWIA: Calling actor.update() with:`, updateObj);
      
      try {
        const result = await actor.update(updateObj);
        console.log(`SWIA: Update result:`, result);
        if (path === "system.woundedTokenImage" && actor.type === "hero" && (actor.system?.state?.wounded ?? false)) {
          await sheet._syncActiveTokenTextures(actor, url);
        }
        // Ensure the sheet reflects the new image
        try { sheet.render(false); } catch (e) { /* noop */ }
      } catch (err) {
        console.error(`SWIA: Update error:`, err);
      }
    };

    const fp = new FilePickerClass({
      type: "image",
      current: current,
      callback: callback
    });
    fp.render(true);
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

  /**
   * Ensure name and system data persist when the form is submitted.
   */
  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData ?? {});
    const update = {};

    // Prefer direct formData name if present; fall back to expanded
    if (formData?.name !== undefined) update.name = formData.name;
    else if (expanded.name !== undefined) update.name = expanded.name;

    if (expanded.system !== undefined) update.system = expanded.system;

    return this.actor.update(update);
  }

  /**
   * Explicitly submit data to ensure name/system changes save across V1/V2.
   */
  async _onSubmit(event) {
    event?.preventDefault?.();
    const formData = this._collectFormData();
    return this._updateObject(event, formData);
  }

  async close(options) {
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
   * Gather form data safely across V1/V2 without relying on _getSubmitData.
   * Handles disabled inputs which are normally skipped by FormData API.
   */
  _collectFormData() {
    if (typeof this._getSubmitData === "function") {
      try {
        return this._getSubmitData({ updateData: true });
      } catch (e) {
        console.warn("SWIA: _getSubmitData failed, falling back to manual", e);
      }
    }

    // Find the actual form element - V2 uses this.element directly, V1 uses jQuery collection
    let searchRoot = null;
    if (isV2) {
      // V2: this.element is a DOM element
      searchRoot = this.element;
    } else {
      // V1: this.element is a jQuery collection
      searchRoot = this.element?.[0] ?? this.form;
    }
    
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

  // V1: Intercept item drops dispatched by ActorSheet._onDrop
  async _onDropItem(event, data) {
    if (await this._interceptHeroAbilityDrop(data)) return;
    return super._onDropItem(event, data);
  }

  // V2: Intercept change events for surge/special ability inputs and save directly
  // This bypasses V2's native form submission which can fail for nested array fields
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

  // V2: Attach a native drop listener after each render
  _onRender(context, options) {
    if (typeof super._onRender === "function") super._onRender(context, options);
    if (!isV2) return;
    const el = this.element;
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

  // Save surge ability fields when any input changes (V1 + V2 fallback)
  async _onSurgeAbilityChange(event) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor) return;
    // V2: this.element is a raw DOM element; V1: this.element is a jQuery collection
    const sheetEl = this.element instanceof Element ? this.element : this.element?.[0];
    const container = event?.target?.closest("form") ?? this.form ?? sheetEl;
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

  // Save special ability fields when any input changes (V1 + V2 fallback)
  async _onSpecialAbilityChange(event) {
    event?.preventDefault?.();
    const actor = this.document ?? this.actor;
    if (!actor) return;
    const sheetEl = this.element instanceof Element ? this.element : this.element?.[0];
    const container = event?.target?.closest("form") ?? this.form ?? sheetEl;
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
    current.push({ name: "", description: "" });
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
    const sheetEl = this.element instanceof Element ? this.element : this.element?.[0];
    const container = event?.target?.closest("form") ?? this.form ?? sheetEl;
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
    const sheetEl = this.element instanceof Element ? this.element : this.element?.[0];
    const container = event?.target?.closest("form") ?? this.form ?? sheetEl;
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
