// Import base classes for V1/V2 compatibility
const BaseItemSheetV2 = foundry.applications?.sheets?.ItemSheetV2;
const BaseItemSheetV1 = foundry.appv1?.sheets?.ItemSheet ?? ItemSheet;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;

// Create V2 base with Handlebars mixin if available, otherwise use V1
const BaseItemSheet = BaseItemSheetV2 && HandlebarsApplicationMixin 
  ? HandlebarsApplicationMixin(BaseItemSheetV2)
  : BaseItemSheetV1;
const isV2 = !!BaseItemSheetV2;

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
      submitOnChange: true,
      handler: SWIAItemSheet.#onSubmitItemForm
    },
    actions: {
      editImage: SWIAItemSheet.#onEditImage,
      addSurgeAbility: SWIAItemSheet.#onAddSurgeAbility,
      removeSurgeAbility: SWIAItemSheet.#onRemoveSurgeAbility,
      toggleEdit: SWIAItemSheet.#onToggleEdit,
      cycleCardState: SWIAItemSheet.#onCycleCardState
    }
  };

  // V2 template parts configuration - we can't make this truly dynamic as static,
  // so we'll override _renderHTML instead
  static PARTS = {
    form: {
      template: "systems/swia/templates/items/ability-sheet.hbs",
      scrollable: [""]
    }
  };

  // Override V2's template loading to use the correct template based on item type
  async _renderHTML(context, options) {
    const itemType = this.document?.type ?? "ability";
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
      wrapper.replaceChildren(result.form);
    } else {
      content.replaceChildren(result.form);
    }
  }

  // V1 template getter
  get template() {
    const itemType = this.document?.type ?? this.item?.type ?? "ability";
    return `systems/swia/templates/items/${itemType}-sheet.hbs`;
  }

  // Handle form submission in V2
  static async #onSubmitItemForm(event, form, formData) {
    const submitData = foundry.utils.expandObject(formData.object);
    await this.document.update(submitData);
  }

  // Handle image editing in V2
  static async #onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const FilePickerClass = foundry?.applications?.apps?.FilePicker?.implementation
      ?? foundry?.applications?.api?.FilePicker;
    const fp = new FilePickerClass({
      type: "image",
      current: current,
      callback: path => {
        target.src = path;
        this.document.update({ [attr]: path });
      }
    });
    return fp.browse();
  }

  // Add surge ability to weapon (V2)
  static async #onAddSurgeAbility(event, target) {
    const item = this.document;
    if (item.type !== "weapon") return;
    
    const surgeAbilities = item.system.surgeAbilities || [];
    const newSurgeAbilities = [...surgeAbilities, { cost: 1, effect: "" }];
    
    await item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Remove surge ability from weapon (V2)
  static async #onRemoveSurgeAbility(event, target) {
    const item = this.document;
    if (item.type !== "weapon") return;
    
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    
    const surgeAbilities = item.system.surgeAbilities || [];
    const newSurgeAbilities = surgeAbilities.filter((_, i) => i !== index);
    
    await item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Toggle edit mode (V2)
  static async #onToggleEdit(event, target) {
    const currentEditMode = this.editMode ?? false;
    this.editMode = !currentEditMode;
    this.render();
  }

  // Cycle card state: ready → exhausted → depleted → ready (V2)
  static async #onCycleCardState(event, target) {
    const item = this.document;
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
      submitOnChange: true
    });
  }

  get title() {
    const name = this.document?.name ?? this.item?.name ?? "";
    return name || "Item";
  }

  // Prepare rendering context for both V1 and V2
  async _prepareContext(options) {
    const context = isV2 ? await super._prepareContext(options) : {};
    const item = this.document ?? this.item;
    const system = item.system;

    // Get TextEditor with fallback for V1/V2 compatibility
    const TextEditorClass = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;

    // Enrich HTML for description field
    const enrichedDescription = await TextEditorClass.enrichHTML(system.description || "", {
      async: true,
      secrets: item.isOwner,
      relativeTo: item
    });

    // Determine if a real card image has been uploaded (not the default mystery-man)
    const defaultImages = ["icons/svg/item-bag.svg", "icons/svg/sword.svg", "icons/svg/mystery-man.svg"];
    const hasCardImage = item.img && !defaultImages.includes(item.img);

    // Card state label for display
    const stateLabels = { ready: "SWIA.Item.CardState.Ready", exhausted: "SWIA.Item.CardState.Exhausted", depleted: "SWIA.Item.CardState.Depleted" };
    const cardState = system.cardState || "ready";
    const cardStateLabel = game.i18n.localize(stateLabels[cardState] || stateLabels.ready);

    return foundry.utils.mergeObject(context, {
      item: item,
      systemData: system,
      enrichedDescription: enrichedDescription,
      isEditable: this.isEditable !== false,
      hasCardImage: hasCardImage,
      cardStateLabel: cardStateLabel,
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

    // Determine if a real card image has been uploaded
    const defaultImages = ["icons/svg/item-bag.svg", "icons/svg/sword.svg", "icons/svg/mystery-man.svg"];
    const hasCardImage = data.item.img && !defaultImages.includes(data.item.img);

    // Card state label for display
    const stateLabels = { ready: "SWIA.Item.CardState.Ready", exhausted: "SWIA.Item.CardState.Exhausted", depleted: "SWIA.Item.CardState.Depleted" };
    const cardState = system.cardState || "ready";
    const cardStateLabel = game.i18n.localize(stateLabels[cardState] || stateLabels.ready);

    data.systemData = system;
    data.enrichedDescription = enrichedDescription;
    data.isEditable = this.isEditable !== false;
    data.hasCardImage = hasCardImage;
    data.cardStateLabel = cardStateLabel;
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
    html.find("[data-action='toggleEdit']").on("click", this._onToggleEdit.bind(this));
  }

  // Add surge ability to weapon (V1)
  async _onAddSurgeAbility(event) {
    event.preventDefault();
    if (this.item.type !== "weapon") return;
    
    const surgeAbilities = this.item.system.surgeAbilities || [];
    const newSurgeAbilities = [...surgeAbilities, { cost: 1, effect: "" }];
    
    await this.item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Remove surge ability from weapon (V1)
  async _onRemoveSurgeAbility(event) {
    event.preventDefault();
    const index = parseInt(event.currentTarget.dataset.index);
    if (isNaN(index) || this.item.type !== "weapon") return;
    
    const surgeAbilities = this.item.system.surgeAbilities || [];
    const newSurgeAbilities = surgeAbilities.filter((_, i) => i !== index);
    
    await this.item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Toggle edit mode (V1)
  _onToggleEdit(event) {
    event.preventDefault();
    const currentEditMode = this.editMode ?? false;
    this.editMode = !currentEditMode;
    this.render();
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
    const current = foundry.utils.getProperty(this.item, attr);
    const FilePickerClass = foundry?.applications?.apps?.FilePicker?.implementation
      ?? foundry?.applications?.api?.FilePicker;
    const fp = new FilePickerClass({
      type: "image",
      current: current,
      callback: path => {
        event.currentTarget.src = path;
        this.item.update({ [attr]: path });
      }
    });
    return fp.browse();
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData ?? {});
    const update = {};

    if (formData?.name !== undefined) update.name = formData.name;
    else if (expanded.name !== undefined) update.name = expanded.name;

    if (expanded.system !== undefined) update.system = expanded.system;

    return this.item.update(update);
  }
}
