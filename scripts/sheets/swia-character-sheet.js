// Import base classes for V1/V2 compatibility (same pattern as SWIAActorSheet)
const BaseActorSheetV2 = foundry.applications?.sheets?.ActorSheetV2;
const BaseActorSheetV1 = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;

// Create V2 base with Handlebars mixin if available, otherwise use V1
const BaseActorSheet = BaseActorSheetV2 && HandlebarsApplicationMixin 
  ? HandlebarsApplicationMixin(BaseActorSheetV2)
  : BaseActorSheetV1;
const isV2 = !!BaseActorSheetV2;

// Character sheet class - simplified for non-combat NPCs
export class SWIACharacterSheet extends BaseActorSheet {
  constructor(...args) {
    super(...args);
    this._editMode = false;
  }

  // Configuration for V2: sheet layout, position, and action handlers
  static DEFAULT_OPTIONS = {
    classes: ["swia", "sheet", "actor", "character"],
    window: {
      resizable: true,
      controls: []
    },
    position: {
      width: 600,
      height: 500
    },
    form: {
      submitOnChange: true
    },
    actions: {
      toggleEdit: SWIACharacterSheet.prototype._onToggleEdit,
      editImage: SWIACharacterSheet.prototype._onEditImage,
      toggleDispositionShown: SWIACharacterSheet.prototype._onToggleDispositionShown
    }
  };

  static get defaultOptions() {
    if (isV2) return {};
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["swia", "sheet", "actor", "character"],
      template: "systems/swia/templates/actors/character-sheet.hbs",
      width: 600,
      height: 500,
      resizable: true,
      submitOnChange: true
    });
  }

  static PARTS = {
    form: {
      template: "systems/swia/templates/actors/character-sheet.hbs"
    }
  };

  // Return the template for Character sheets
  get template() {
    return "systems/swia/templates/actors/character-sheet.hbs";
  }

  /**
   * Prepare data context for template rendering.
   * Called on both V1 and V2 during render.
   */
  async _prepareContext(options = {}, baseContext = null) {
    const context = baseContext ?? (isV2 ? await super._prepareContext(options) : {});
    const actor = this.actor;
    const systemData = actor.system;
    const isGM = game.user.isGM;
    const rawDisposition = systemData.preferredDisposition ?? "neutral";
    const rawAffiliation = systemData.affiliation ?? "";
    const preferredDisposition = ["friendly", "neutral", "hostile"].includes(rawDisposition)
      ? rawDisposition
      : "neutral";
    const dispositionShown = actor.getFlag("swia", "dispositionShown") ?? false;
    const effectiveDisposition = dispositionShown ? preferredDisposition : "neutral";
    const affiliation = ["", "imperial", "rebel", "mercenary", "civilian"].includes(rawAffiliation)
      ? rawAffiliation
      : "";
    const currentAttributes = {
      health: {
        value: systemData.attributes?.health?.value ?? 0,
        max: systemData.attributes?.health?.max ?? 0
      },
      speed: systemData.attributes?.speed ?? 0
    };

    return foundry.utils.mergeObject(context, {
      actor,
      systemData,
      isGM,
      editMode: this._editMode,
      preferredDisposition,
      dispositionShown,
      affiliation,
      dispositionClass: `disposition-${effectiveDisposition}`,
      preferredDispositionLabel: game.i18n.localize(`SWIA.Character.Disposition.${preferredDisposition.charAt(0).toUpperCase()}${preferredDisposition.slice(1)}`),
      effectiveDispositionLabel: dispositionShown
        ? game.i18n.localize(`SWIA.Character.Disposition.${preferredDisposition.charAt(0).toUpperCase()}${preferredDisposition.slice(1)}`)
        : game.i18n.localize("SWIA.Character.Disposition.Unknown"),
      affiliationLabel: affiliation
        ? game.i18n.localize(`SWIA.Villain.Affiliation.${affiliation.charAt(0).toUpperCase()}${affiliation.slice(1)}`)
        : game.i18n.localize("SWIA.Villain.Affiliation.None"),
      currentAttributes,
      profileSrc: actor.img,
      tokenPreviewSrc: actor.prototypeToken?.texture?.src ?? actor.img
    });
  }

  /**
   * V1 API: Get sheet data for the template.
   * Merge our custom context prep into getData.
   */
  async getData(options = {}) {
    if (isV2) return this._prepareContext(options);

    const data = await super.getData(options);
    return this._prepareContext(options, data);
  }

  /**
   * Activate event listeners (V1 only; V2 uses actions)
   */
  activateListeners(html) {
    super.activateListeners(html);

    if (!isV2) {
      // V1: Manual event binding
      html.find('[data-action="toggleEdit"]').on("change", this._onToggleEdit.bind(this));
      html.find('[data-action="editImage"]').on("click", this._onEditImage.bind(this));
      html.find('[data-action="toggleDispositionShown"]').on("click", this._onToggleDispositionShown.bind(this));
    }
  }

  /**
   * Toggle edit mode for GM only
   */
  async _onToggleEdit(event, target) {
    event?.preventDefault?.();
    if (!game.user?.isGM) return;

    const checked = Boolean(target?.checked ?? event?.currentTarget?.checked ?? !this._editMode);
    const wasEditing = this._editMode;
    this._editMode = checked;

    // Persist current form values before leaving edit mode.
    if (!this._editMode && wasEditing) {
      await this._saveFormData();
    }

    this.render(false);
  }

  /**
   * Toggle disposition visibility (GM only). State persists via actor flag.
   */
  async _onToggleDispositionShown(event, target) {
    event?.preventDefault?.();
    if (!game.user?.isGM) return;

    const current = this.actor.getFlag("swia", "dispositionShown") ?? false;
    await this.actor.setFlag("swia", "dispositionShown", !current);
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData ?? {});
    const update = {};

    if (formData?.name !== undefined) update.name = formData.name;
    else if (expanded.name !== undefined) update.name = expanded.name;

    if (expanded.system !== undefined) update.system = expanded.system;

    return this.actor.update(update);
  }

  async _onSubmit(event) {
    event?.preventDefault?.();
    const formData = this._collectFormData();
    return this._updateObject(event, formData);
  }

  async _saveFormData() {
    const formData = this._collectFormData();
    if (!formData || Object.keys(formData).length === 0) return;
    await this._updateObject(null, formData);
  }

  _collectFormData() {
    if (typeof this._getSubmitData === "function") {
      try {
        return this._getSubmitData({ updateData: true });
      } catch (e) {
        console.warn("SWIA: Character sheet _getSubmitData failed, falling back to manual", e);
      }
    }

    const searchRoot = isV2 ? this.element : (this.element?.[0] ?? this.form);
    let formElem = null;
    if (searchRoot?.tagName === "FORM") formElem = searchRoot;
    else if (searchRoot) formElem = searchRoot.querySelector("form[data-application-part='form']") || searchRoot.querySelector("form");
    if (!formElem) return {};

    const result = {};
    const allInputs = formElem.querySelectorAll("input[name], textarea[name], select[name]");
    allInputs.forEach(input => {
      if (!input.name) return;
      if (input.type === "checkbox") result[input.name] = input.checked;
      else if (input.type === "number") result[input.name] = input.value ? Number(input.value) : 0;
      else result[input.name] = input.value;
    });
    return result;
  }

  /**
   * Handle image picker for profile or token image
   */
  async _onEditImage(event, target) {
    event?.preventDefault?.();
    if (!game.user?.isGM || !this._editMode) return;

    // V2 passes target as 2nd arg; V1 uses event.currentTarget
    const el = target ?? event?.currentTarget;
    const path = el?.dataset?.path;
    if (!path) return;

    const actor = this.document ?? this.actor;
    const current = foundry.utils.getProperty(actor, path) || "";

    const FilePickerClass = foundry?.applications?.apps?.FilePicker?.implementation
      ?? foundry?.applications?.api?.FilePicker;

    const fp = new FilePickerClass({
      type: "image",
      current,
      callback: async (url) => {
        const updateObj = {};
        if (path === "img" || path === "prototypeToken.texture.src") {
          updateObj.img = url;
          updateObj["prototypeToken.texture.src"] = url;
        } else {
          updateObj[path] = url;
        }
        await actor.update(updateObj);
        try { this.render(false); } catch (e) { /* noop */ }
      }
    });

    fp.render(true);
  }
}
