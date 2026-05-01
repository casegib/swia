// Import base classes for V1/V2 compatibility
const BaseItemSheetV2 = foundry.applications?.sheets?.ItemSheetV2;
const BaseItemSheetV1 = foundry.appv1?.sheets?.ItemSheet ?? ItemSheet;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;

// Create V2 base with Handlebars mixin if available, otherwise use V1
const BaseItemSheet = BaseItemSheetV2 && HandlebarsApplicationMixin 
  ? HandlebarsApplicationMixin(BaseItemSheetV2)
  : BaseItemSheetV1;
const isV2 = !!BaseItemSheetV2;

function resolveItemDocument(ctx) {
  return ctx?.document ?? ctx?.item ?? ctx?.object ?? ctx?.options?.document ?? null;
}

function mapItemSheetType(sourceType) {
  if (sourceType === "agendacard" || sourceType === "imperialclasscard") return "classcard";
  return sourceType;
}

function resolveWeaponmodAttachmentName(item) {
  if (!item || item.type !== "weaponmod") return "";

  const attachedWeaponId = item.system?.attachedWeaponId || "";
  if (!attachedWeaponId) return game.i18n.localize("SWIA.Item.Weaponmod.AttachedWeaponNone");

  const actor = item.actor ?? item.parent;
  const attachedWeapon = actor?.items?.get?.(attachedWeaponId);
  return attachedWeapon?.name || attachedWeaponId;
}

// Main item sheet class supporting both V1 and V2 Foundry versions
export class SWIAItemSheet extends BaseItemSheet {
  // Configuration for V2: sheet layout and position
  static DEFAULT_OPTIONS = {
    classes: ["swia", "sheet", "item"],
    window: {
      resizable: true,
      controls: []
    },
    position: {
      width: 420,
      height: 580
    },
    form: {
      submitOnChange: false
    },
    actions: {
      editImage: SWIAItemSheet.#onEditImage,
      addSurgeAbility: SWIAItemSheet.#onAddSurgeAbility,
      removeSurgeAbility: SWIAItemSheet.#onRemoveSurgeAbility,
      addExhaustAbility: SWIAItemSheet.#onAddExhaustAbility,
      removeExhaustAbility: SWIAItemSheet.#onRemoveExhaustAbility,
      addAbility: SWIAItemSheet.#onAddAbility,
      removeAbility: SWIAItemSheet.#onRemoveAbility,
      toggleEdit: SWIAItemSheet.#onToggleEdit,
      saveItem: SWIAItemSheet.#onSaveItem,
      cycleCardState: SWIAItemSheet.#onCycleCardState
    }
  };

  // V2 template parts configuration - we can't make this truly dynamic as static,
  // so we'll override _renderHTML instead
  static PARTS = {
    form: {
      template: "systems/swia/templates/items/classcard-sheet.hbs",
      scrollable: [""]
    }
  };

  constructor(...args) {
    super(...args);

    if (isV2) {
      this.options.form ??= {};
      this.options.form.submitOnChange = false;
      this.options.form.handler = this._onSubmitItemForm.bind(this);
    }
  }

  // Override V2's template loading to use the correct template based on item type
  async _renderHTML(context, options) {
    const sourceType = this.document?.type ?? "classcard";
    const itemType = mapItemSheetType(sourceType);
    const templatePath = `systems/swia/templates/items/${itemType}-sheet.hbs`;
    
    // Manually load and compile the correct template
    const getTemplateFn = foundry.applications?.handlebars?.getTemplate ?? getTemplate;
    const compiledTemplate = await getTemplateFn(templatePath);
    
    // Get the context for the form part
    const formContext = await this._preparePartContext("form", {}, options);
    
    // Render the template with the context
    const renderedHTML = compiledTemplate(formContext);
    
    // Convert HTML string to DOM element for V2
    const parser = new DOMParser();
    const doc = parser.parseFromString(renderedHTML, "text/html");
    const formElement = doc.body.firstElementChild;
    
    // Return in the format V2 expects (DOM elements, not strings)
    return {
      form: formElement
    };
  }

  // Override V2's _replaceHTML to avoid duplication on re-render.
  // The default HandlebarsApplicationMixin._replaceHTML can fail to properly
  // swap content when _renderHTML returns custom DOM elements.
  _replaceHTML(result, content, options) {
    const wrapper = content.querySelector('[data-application-part="form"]');
    if (wrapper && result.form) {
      const resultTag = result.form.tagName?.toLowerCase?.();

      // Avoid nesting template <form> tags inside V2 wrappers.
      if (resultTag === "form") {
        const existingClass = wrapper.getAttribute("class") || "";
        const mergedClass = `${existingClass} ${result.form.className || ""}`.trim();
        if (mergedClass) wrapper.setAttribute("class", mergedClass);

        wrapper.replaceChildren(...Array.from(result.form.childNodes));
      } else {
        wrapper.replaceChildren(result.form);
      }

    } else {
      content.replaceChildren(result.form);
    }

  }

  // V1 template getter
  get template() {
    const sourceType = this.document?.type ?? this.item?.type ?? "classcard";
    const itemType = mapItemSheetType(sourceType);
    return `systems/swia/templates/items/${itemType}-sheet.hbs`;
  }

  // Handle form submission in V2
  async _onSubmitItemForm(event, form, formData) {
    const raw = formData?.object ?? formData ?? {};
    const normalized = foundry.utils.flattenObject(foundry.utils.expandObject(raw));
    let update = this._extractItemUpdate(normalized);

    // Fallback: pull values from the live form if Foundry supplied an empty payload.
    if (!Object.keys(update).length) {
      update = this._collectUpdateFromForm(form);
    }

    if (!Object.keys(update).length) return;

    const item = resolveItemDocument(this);
    if (!item) return;
    await item.update(update);
  }

  // Handle image editing in V2
  static async #onEditImage(event, target) {
    const attr = target.dataset.edit;
    const item = resolveItemDocument(this);
    if (!item) return;
    const current = foundry.utils.getProperty(item, attr);
    const FilePickerClass = foundry?.applications?.apps?.FilePicker?.implementation
      ?? foundry?.applications?.api?.FilePicker;
    const fp = new FilePickerClass({
      type: "image",
      current: current,
      callback: path => {
        target.src = path;
        item.update({ [attr]: path });
      }
    });
    return fp.browse();
  }

  // Add surge ability to weapon (V2)
  static async #onAddSurgeAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    if (!["weapon", "weaponmod"].includes(item.type)) return;
    
    const surgeAbilities = item.system.surgeAbilities || [];
    const newSurgeAbilities = [...surgeAbilities, { cost: 1, effectType: "damage", effectValue: 0, effectText: "" }];
    
    await item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Remove surge ability from weapon (V2)
  static async #onRemoveSurgeAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    if (!["weapon", "weaponmod"].includes(item.type)) return;
    
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    
    const surgeAbilities = item.system.surgeAbilities || [];
    const newSurgeAbilities = surgeAbilities.filter((_, i) => i !== index);
    
    await item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Add exhaust ability to weapon (V2)
  static async #onAddExhaustAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    if (item.type !== "weapon") return;

    const exhaustAbilities = item.system.exhaustAbilities || [];
    const newExhaustAbilities = [...exhaustAbilities, { trigger: "action", effect: "" }];

    await item.update({ "system.exhaustAbilities": newExhaustAbilities });
  }

  // Remove exhaust ability from weapon (V2)
  static async #onRemoveExhaustAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    if (item.type !== "weapon") return;

    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const exhaustAbilities = item.system.exhaustAbilities || [];
    const newExhaustAbilities = exhaustAbilities.filter((_, i) => i !== index);

    await item.update({ "system.exhaustAbilities": newExhaustAbilities });
  }

  // Add ability to weapon (V2)
  static async #onAddAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    if (item.type !== "weapon") return;
    const abilities = Array.isArray(item.system.abilities) ? item.system.abilities : Object.values(item.system.abilities || {});
    await item.update({ "system.abilities": [...abilities, { prefix: "none", description: "" }] });
  }

  // Remove ability from weapon (V2)
  static async #onRemoveAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    if (item.type !== "weapon") return;
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    const abilities = Array.isArray(item.system.abilities) ? item.system.abilities : Object.values(item.system.abilities || {});
    await item.update({ "system.abilities": abilities.filter((_, i) => i !== index) });
  }

  // Toggle edit mode (V2)
  static async #onToggleEdit(event, target) {
    const currentEditMode = this.editMode ?? false;
    this.editMode = !currentEditMode;
    this.render();
  }

  // Explicit save action (V2)
  static async #onSaveItem(event, target) {
    if (event?.preventDefault) event.preventDefault();

    const update = this._collectUpdateFromForm(target?.closest?.("form") ?? null);
    const item = resolveItemDocument(this);
    if (!item) {
      ui.notifications?.error("SWIA | Unable to resolve item document for save.");
      return;
    }

    if (!Object.keys(update).length) {
      ui.notifications?.warn(game.i18n.localize("SWIA.Item.NoChangesToSave"));
      return;
    }

    try {
      await item.update(update);
      ui.notifications?.info(game.i18n.localize("SWIA.Item.Saved"));
    } catch (error) {
      console.error("SWIA | Manual save failed", error);
      ui.notifications?.error(game.i18n.localize("SWIA.Item.SaveFailed"));
    }
  }

  // Cycle card state: ready → exhausted → depleted → ready (V2)
  static async #onCycleCardState(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    const current = item.system.cardState || "ready";
    const cycle = { ready: "exhausted", exhausted: "depleted", depleted: "ready" };
    await item.update({ "system.cardState": cycle[current] || "ready" });
  }

  static get defaultOptions() {
    if (isV2) return {};
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["swia", "sheet", "item"],
      width: 420,
      height: 580,
      resizable: true,
      submitOnChange: false
    });
  }

  get title() {
    const name = this.document?.name ?? this.item?.name ?? "";
    return name || "Item";
  }

  // Prepare rendering context for both V1 and V2
  async _prepareContext(options) {
    const context = isV2 ? await super._prepareContext(options) : {};
    const item = resolveItemDocument(this);
    if (!item) return context;
    const system = item.system;

    // Get TextEditor with fallback for V1/V2 compatibility
    const TextEditorClass = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;

    // Enrich HTML for description field
    const enrichedDescription = await TextEditorClass.enrichHTML(system.description || "", {
      async: true,
      secrets: item.isOwner,
      relativeTo: item
    });

    const enrichedAbilityText = item.type === "heroability"
      ? await TextEditorClass.enrichHTML(system.abilityText || "", { async: true, secrets: item.isOwner, relativeTo: item })
      : "";

    // Enrich weapon abilities (free-form ability rows with optional prefix icons)
    // Normalize to array — Foundry can store new array fields as {} on existing documents
    const abilitiesRaw = Array.isArray(system.abilities)
      ? system.abilities
      : Object.values(system.abilities || {});
    const enrichedAbilities = await Promise.all(
      abilitiesRaw.map(async (ability, index) => ({
        ...ability,
        enrichedDescription: await TextEditorClass.enrichHTML(ability.description || "", {
          async: true,
          secrets: item.isOwner,
          relativeTo: item
        })
      }))
    );

    // Determine if a real card image has been uploaded (not the default mystery-man)
    const defaultImages = ["icons/svg/item-bag.svg", "icons/svg/sword.svg", "icons/svg/mystery-man.svg"];
    const hasCardImage = item.img && !defaultImages.includes(item.img);

    // Card state label for display
    const stateLabels = { ready: "SWIA.Item.CardState.Ready", exhausted: "SWIA.Item.CardState.Exhausted", depleted: "SWIA.Item.CardState.Depleted" };
    const cardState = system.cardState || "ready";
    const cardStateLabel = game.i18n.localize(stateLabels[cardState] || stateLabels.ready);
    const weaponmodAttachedWeaponName = resolveWeaponmodAttachmentName(item);

    return foundry.utils.mergeObject(context, {
      item: item,
      systemData: system,
      enrichedDescription: enrichedDescription,
      enrichedAbilityText: enrichedAbilityText,
      enrichedAbilities: enrichedAbilities,
      editMode: this.editMode ?? false,
      isEditable: this.isEditable !== false,
      isGM: game.user?.isGM ?? false,
      hasCardImage: hasCardImage,
      cardStateLabel: cardStateLabel,
      weaponmodAttachedWeaponName: weaponmodAttachedWeaponName,
      config: CONFIG.SWIA ?? {}
    });
  }

  // V2 specific: prepare context for the form part
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext?.(partId, context, options) ?? context;
    
    if (partId === "form") {
      return await this._prepareContext(options);
    }
    
    return context;
  }

  async getData(options) {
    if (isV2) return this._prepareContext(options);
    
    const data = await super.getData(options);
    const system = data.item.system;

    // Get TextEditor with fallback for V1/V2 compatibility
    const TextEditorClass = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;

    // Enrich HTML for description
    const enrichedDescription = await TextEditorClass.enrichHTML(system.description || "", {
      async: true,
      secrets: data.item.isOwner,
      relativeTo: data.item
    });

    const enrichedAbilityText = data.item.type === "heroability"
      ? await TextEditorClass.enrichHTML(system.abilityText || "", { async: true, secrets: data.item.isOwner, relativeTo: data.item })
      : "";

    // Determine if a real card image has been uploaded
    const defaultImages = ["icons/svg/item-bag.svg", "icons/svg/sword.svg", "icons/svg/mystery-man.svg"];
    const hasCardImage = data.item.img && !defaultImages.includes(data.item.img);

    // Card state label for display
    const stateLabels = { ready: "SWIA.Item.CardState.Ready", exhausted: "SWIA.Item.CardState.Exhausted", depleted: "SWIA.Item.CardState.Depleted" };
    const cardState = system.cardState || "ready";
    const cardStateLabel = game.i18n.localize(stateLabels[cardState] || stateLabels.ready);
    const weaponmodAttachedWeaponName = resolveWeaponmodAttachmentName(data.item);

    // Enrich weapon abilities (V1 path)
    // Normalize to array — Foundry can store new array fields as {} on existing documents
    const abilitiesRaw = Array.isArray(system.abilities)
      ? system.abilities
      : Object.values(system.abilities || {});
    const enrichedAbilities = await Promise.all(
      abilitiesRaw.map(async (ability) => ({
        ...ability,
        enrichedDescription: await TextEditorClass.enrichHTML(ability.description || "", {
          async: true,
          secrets: data.item.isOwner,
          relativeTo: data.item
        })
      }))
    );

    data.systemData = system;
    data.enrichedDescription = enrichedDescription;
    data.enrichedAbilityText = enrichedAbilityText;
    data.enrichedAbilities = enrichedAbilities;
    data.editMode = this.editMode ?? false;
    data.isEditable = this.isEditable !== false;
    data.isGM = game.user?.isGM ?? false;
    data.hasCardImage = hasCardImage;
    data.cardStateLabel = cardStateLabel;
    data.weaponmodAttachedWeaponName = weaponmodAttachedWeaponName;
    data.config = CONFIG.SWIA ?? {};
    
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (isV2) return;

    // Card image click to edit (V1 only)
    html.find(".card-image[data-edit]").on("click", this._onEditImage.bind(this));

    // Card state cycling (V1 only)
    html.find("[data-action='cycleCardState']").on("click", this._onCycleCardState.bind(this));

    // Weapon-specific listeners (V1 only)
    html.find("[data-action='addSurgeAbility']").on("click", this._onAddSurgeAbility.bind(this));
    html.find("[data-action='removeSurgeAbility']").on("click", this._onRemoveSurgeAbility.bind(this));
    html.find("[data-action='addExhaustAbility']").on("click", this._onAddExhaustAbility.bind(this));
    html.find("[data-action='removeExhaustAbility']").on("click", this._onRemoveExhaustAbility.bind(this));
    html.find("[data-action='addAbility']").on("click", this._onAddAbility.bind(this));
    html.find("[data-action='removeAbility']").on("click", this._onRemoveAbility.bind(this));
    html.find("[data-action='toggleEdit']").on("click", this._onToggleEdit.bind(this));
    html.find("[data-action='saveItem']").on("click", this._onSaveItem.bind(this));

  }

  // Add surge ability to weapon (V1)
  async _onAddSurgeAbility(event) {
    event.preventDefault();
    if (!["weapon", "weaponmod"].includes(this.item.type)) return;
    
    const surgeAbilities = this.item.system.surgeAbilities || [];
    const newSurgeAbilities = [...surgeAbilities, { cost: 1, effectType: "damage", effectValue: 0, effectText: "" }];
    
    await this.item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Remove surge ability from weapon (V1)
  async _onRemoveSurgeAbility(event) {
    event.preventDefault();
    const index = parseInt(event.currentTarget.dataset.index);
    if (isNaN(index) || !["weapon", "weaponmod"].includes(this.item.type)) return;
    
    const surgeAbilities = this.item.system.surgeAbilities || [];
    const newSurgeAbilities = surgeAbilities.filter((_, i) => i !== index);
    
    await this.item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Add exhaust ability to weapon (V1)
  async _onAddExhaustAbility(event) {
    event.preventDefault();
    if (this.item.type !== "weapon") return;

    const exhaustAbilities = this.item.system.exhaustAbilities || [];
    const newExhaustAbilities = [...exhaustAbilities, { trigger: "action", effect: "" }];

    await this.item.update({ "system.exhaustAbilities": newExhaustAbilities });
  }

  // Remove exhaust ability from weapon (V1)
  async _onRemoveExhaustAbility(event) {
    event.preventDefault();
    const index = parseInt(event.currentTarget.dataset.index);
    if (isNaN(index) || this.item.type !== "weapon") return;

    const exhaustAbilities = this.item.system.exhaustAbilities || [];
    const newExhaustAbilities = exhaustAbilities.filter((_, i) => i !== index);

    await this.item.update({ "system.exhaustAbilities": newExhaustAbilities });
  }

  // Add ability to weapon (V1)
  async _onAddAbility(event) {
    event.preventDefault();
    if (this.item.type !== "weapon") return;
    const abilities = Array.isArray(this.item.system.abilities) ? this.item.system.abilities : Object.values(this.item.system.abilities || {});
    await this.item.update({ "system.abilities": [...abilities, { prefix: "none", description: "" }] });
  }

  // Remove ability from weapon (V1)
  async _onRemoveAbility(event) {
    event.preventDefault();
    const index = parseInt(event.currentTarget.dataset.index);
    if (isNaN(index) || this.item.type !== "weapon") return;
    const abilities = Array.isArray(this.item.system.abilities) ? this.item.system.abilities : Object.values(this.item.system.abilities || {});
    await this.item.update({ "system.abilities": abilities.filter((_, i) => i !== index) });
  }

  // Toggle edit mode (V1)
  async _onToggleEdit(event) {
    event.preventDefault();

    const currentEditMode = this.editMode ?? false;
    this.editMode = !currentEditMode;
    this.render();
  }

  // Explicit save action (V1)
  async _onSaveItem(event) {
    event.preventDefault();

    const update = this._collectUpdateFromForm(event.currentTarget?.closest?.("form") ?? null);
    const item = resolveItemDocument(this);
    if (!item) {
      ui.notifications?.error("SWIA | Unable to resolve item document for save.");
      return;
    }

    if (!Object.keys(update).length) {
      ui.notifications?.warn(game.i18n.localize("SWIA.Item.NoChangesToSave"));
      return;
    }

    try {
      await item.update(update);
      ui.notifications?.info(game.i18n.localize("SWIA.Item.Saved"));
    } catch (error) {
      console.error("SWIA | Manual save failed", error);
      ui.notifications?.error(game.i18n.localize("SWIA.Item.SaveFailed"));
    }
  }

  // Cycle card state: ready → exhausted → depleted → ready (V1)
  async _onCycleCardState(event) {
    event.preventDefault();
    const item = this.document ?? this.item;
    const current = item.system.cardState || "ready";
    const cycle = { ready: "exhausted", exhausted: "depleted", depleted: "ready" };
    await item.update({ "system.cardState": cycle[current] || "ready" });
  }

  // Handle image editing (V1)
  _onEditImage(event) {
    event.preventDefault();
    const attr = event.currentTarget.dataset.edit;
    const item = resolveItemDocument(this);
    if (!item) return;
    const current = foundry.utils.getProperty(item, attr);
    const FilePickerClass = foundry?.applications?.apps?.FilePicker?.implementation
      ?? foundry?.applications?.api?.FilePicker;
    const fp = new FilePickerClass({
      type: "image",
      current: current,
      callback: path => {
        event.currentTarget.src = path;
        item.update({ [attr]: path });
      }
    });
    return fp.browse();
  }

  async _updateObject(event, formData) {
    const normalized = foundry.utils.flattenObject(foundry.utils.expandObject(formData ?? {}));
    const update = this._extractItemUpdate(normalized);

    if (!Object.keys(update).length) return;

    const item = resolveItemDocument(this);
    if (!item) return;
    return item.update(update);
  }

  _extractItemUpdate(source) {
    const update = {};

    for (const [key, value] of Object.entries(source ?? {})) {
      if (key === "name" || key.startsWith("system.")) {
        update[key] = value;
      }
    }

    return update;
  }

  _collectUpdateFromForm(formEl) {
    const root = formEl
      ?? this.element?.querySelector?.('[data-application-part="form"]')
      ?? this.element
      ?? null;

    if (!(root instanceof HTMLElement)) return {};

    const update = {};
    const fields = root.querySelectorAll("input[name], select[name], textarea[name]");

    for (const el of fields) {
      if (el.disabled) continue;

      const name = el.name;
      if (!(name === "name" || name.startsWith("system."))) continue;

      if (el instanceof HTMLInputElement) {
        if (el.type === "radio" && !el.checked) continue;
        if (el.type === "checkbox") {
          update[name] = el.checked;
          continue;
        }
      }

      let value = el.value;
      const expectsNumber = el.dataset?.dtype === "Number" || (el instanceof HTMLInputElement && el.type === "number");

      if (expectsNumber) {
        if (value === "") continue;
        const num = Number(value);
        if (Number.isNaN(num)) continue;
        value = num;
      }

      update[name] = value;
    }

    return update;
  }

}
