const BaseActorSheetV2 = foundry.applications?.sheets?.ActorSheetV2;
const BaseActorSheetV1 = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;

// Create V2 base with Handlebars mixin if available, otherwise use V1
const BaseActorSheet = BaseActorSheetV2 && HandlebarsApplicationMixin 
  ? HandlebarsApplicationMixin(BaseActorSheetV2)
  : BaseActorSheetV1;
const isV2 = !!BaseActorSheetV2;

export class SWIAActorSheet extends BaseActorSheet {
  constructor(...args) {
    super(...args);
    this._editMode = false;
  }

  static DEFAULT_OPTIONS = {
    classes: ["swia", "sheet", "actor"],
    position: {
      width: 620,
      height: 640
    },
    actions: {
      toggleWounded: this._onToggleWounded,
      toggleEdit: this._onToggleEdit,
      addAbility: this._onAddAbility,
      addEquipment: this._onAddEquipment,
      removeRow: this._onRemoveRow,
      // Ensure image editing works in V2 by binding the action
      editImage: this._onEditImage,
      changeName: this._onChangeName
    }
  };

  static get defaultOptions() {
    if (isV2) return {};
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["swia", "sheet", "actor"],
      template: "systems/swia/templates/actors/actor-sheet.hbs",
      width: 620,
      height: 640
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

  async _prepareContext(options) {
    const context = isV2 ? await super._prepareContext(options) : {};
    const actor = this.document ?? this.actor;
    const system = actor.system;
    const isWounded = system.state?.wounded ?? false;
    const currentAttrPath = isWounded ? "woundedAttributes" : "attributes";
    const tokenSrc = actor?.prototypeToken?.texture?.src ?? "";
    const profileSrc = actor?.img || tokenSrc || "";

    // Create arrays for dice block rendering
    const defense = system.attributes?.defense || { black: 0, white: 0 };
    const attack = system.attributes?.attack || { red: 0, blue: 0, green: 0, yellow: 0 };
    const strength = system.attributes?.strength || { red: 0, blue: 0, green: 0, yellow: 0 };
    const insight = system.attributes?.insight || { red: 0, blue: 0, green: 0, yellow: 0 };
    const tech = system.attributes?.tech || { red: 0, blue: 0, green: 0, yellow: 0 };
    
    // Get wounded dice if wounded
    const woundedStrength = isWounded && system.woundedAttributes?.strength ? system.woundedAttributes.strength : strength;
    const woundedInsight = isWounded && system.woundedAttributes?.insight ? system.woundedAttributes.insight : insight;
    const woundedTech = isWounded && system.woundedAttributes?.tech ? system.woundedAttributes.tech : tech;
    
    return foundry.utils.mergeObject(context, {
      actor: actor,
      systemData: system,
      isWounded: isWounded,
      isGM: game.user?.isGM ?? false,
      editMode: this._editMode ?? false,
      currentAttrPath: currentAttrPath,
      currentAttributes: system[currentAttrPath] ?? system.attributes,
      config: CONFIG.SWIA ?? {},
      profileSrc,
      // Dice arrays for rendering blocks
      defenseBlackDice: Array.from({ length: defense.black || 0 }, (_, i) => i),
      defenseWhiteDice: Array.from({ length: defense.white || 0 }, (_, i) => i),
      attackRedDice: Array.from({ length: attack.red || 0 }, (_, i) => i),
      attackBlueDice: Array.from({ length: attack.blue || 0 }, (_, i) => i),
      attackGreenDice: Array.from({ length: attack.green || 0 }, (_, i) => i),
      attackYellowDice: Array.from({ length: attack.yellow || 0 }, (_, i) => i),
      strengthRedDice: Array.from({ length: woundedStrength.red || 0 }, (_, i) => i),
      strengthBlueDice: Array.from({ length: woundedStrength.blue || 0 }, (_, i) => i),
      strengthGreenDice: Array.from({ length: woundedStrength.green || 0 }, (_, i) => i),
      strengthYellowDice: Array.from({ length: woundedStrength.yellow || 0 }, (_, i) => i),
      insightRedDice: Array.from({ length: woundedInsight.red || 0 }, (_, i) => i),
      insightBlueDice: Array.from({ length: woundedInsight.blue || 0 }, (_, i) => i),
      insightGreenDice: Array.from({ length: woundedInsight.green || 0 }, (_, i) => i),
      insightYellowDice: Array.from({ length: woundedInsight.yellow || 0 }, (_, i) => i),
      techRedDice: Array.from({ length: woundedTech.red || 0 }, (_, i) => i),
      techBlueDice: Array.from({ length: woundedTech.blue || 0 }, (_, i) => i),
      techGreenDice: Array.from({ length: woundedTech.green || 0 }, (_, i) => i),
      techYellowDice: Array.from({ length: woundedTech.yellow || 0 }, (_, i) => i)
    });
  }

  async getData(options) {
    if (isV2) return this._prepareContext(options);
    
    const data = await super.getData(options);
    const system = data.actor.system;
    const isWounded = system.state?.wounded ?? false;
    const currentAttrPath = isWounded ? "woundedAttributes" : "attributes";
    const tokenSrc = data.actor?.prototypeToken?.texture?.src ?? "";
    const profileSrc = data.actor?.img || tokenSrc || "";

    // Create arrays for dice block rendering
    const defense = system.attributes?.defense || { black: 0, white: 0 };
    const attack = system.attributes?.attack || { red: 0, blue: 0, green: 0, yellow: 0 };
    const strength = system.attributes?.strength || { red: 0, blue: 0, green: 0, yellow: 0 };
    const insight = system.attributes?.insight || { red: 0, blue: 0, green: 0, yellow: 0 };
    const tech = system.attributes?.tech || { red: 0, blue: 0, green: 0, yellow: 0 };

    // Get wounded dice if wounded
    const woundedStrength = isWounded && system.woundedAttributes?.strength ? system.woundedAttributes.strength : strength;
    const woundedInsight = isWounded && system.woundedAttributes?.insight ? system.woundedAttributes.insight : insight;
    const woundedTech = isWounded && system.woundedAttributes?.tech ? system.woundedAttributes.tech : tech;

    data.systemData = system;
    data.isWounded = isWounded;
    data.isGM = game.user?.isGM ?? false;
    data.editMode = this._editMode ?? false;
    data.currentAttrPath = currentAttrPath;
    data.currentAttributes = system[currentAttrPath] ?? system.attributes;
    data.config = CONFIG.SWIA ?? {};
    data.profileSrc = profileSrc;
    // Dice arrays for rendering blocks
    data.defenseBlackDice = Array.from({ length: defense.black || 0 }, (_, i) => i);
    data.defenseWhiteDice = Array.from({ length: defense.white || 0 }, (_, i) => i);
    data.attackRedDice = Array.from({ length: attack.red || 0 }, (_, i) => i);
    data.attackBlueDice = Array.from({ length: attack.blue || 0 }, (_, i) => i);
    data.attackGreenDice = Array.from({ length: attack.green || 0 }, (_, i) => i);
    data.attackYellowDice = Array.from({ length: attack.yellow || 0 }, (_, i) => i);
    data.strengthRedDice = Array.from({ length: woundedStrength.red || 0 }, (_, i) => i);
    data.strengthBlueDice = Array.from({ length: woundedStrength.blue || 0 }, (_, i) => i);
    data.strengthGreenDice = Array.from({ length: woundedStrength.green || 0 }, (_, i) => i);
    data.strengthYellowDice = Array.from({ length: woundedStrength.yellow || 0 }, (_, i) => i);
    data.insightRedDice = Array.from({ length: woundedInsight.red || 0 }, (_, i) => i);
    data.insightBlueDice = Array.from({ length: woundedInsight.blue || 0 }, (_, i) => i);
    data.insightGreenDice = Array.from({ length: woundedInsight.green || 0 }, (_, i) => i);
    data.insightYellowDice = Array.from({ length: woundedInsight.yellow || 0 }, (_, i) => i);
    data.techRedDice = Array.from({ length: woundedTech.red || 0 }, (_, i) => i);
    data.techBlueDice = Array.from({ length: woundedTech.blue || 0 }, (_, i) => i);
    data.techGreenDice = Array.from({ length: woundedTech.green || 0 }, (_, i) => i);
    data.techYellowDice = Array.from({ length: woundedTech.yellow || 0 }, (_, i) => i);
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Always bind name change (both V1 and V2) so the actor name persists immediately
    html.find("input[name='name']").on("change blur input", this._onChangeName.bind(this));

    if (isV2) return;
    // Bind wounded toggle for all users
    html.find("[data-action='toggleWounded']").on("change", SWIAActorSheet._onToggleWounded.bind(this));
    // Bind edit toggle only for GM
    if (game.user?.isGM) {
      html.find("[data-action='toggleEdit']").on("change", SWIAActorSheet._onToggleEdit.bind(this));
    }

    // Use event delegation for image clicks to handle edit mode changes
    html.on("click", ".profile-image.clickable, .token-image.clickable", (event) => {
      console.log("SWIA: Image clicked");
      this._onEditImageInstance(event, event.currentTarget);
    });

    html.find("[data-action='addAbility']").on("click", SWIAActorSheet._onAddAbility.bind(this));
    html.find("[data-action='addEquipment']").on("click", SWIAActorSheet._onAddEquipment.bind(this));
    html.find("[data-action='removeRow']").on("click", SWIAActorSheet._onRemoveRow.bind(this));
  }

  static async _onToggleWounded(event, target) {
    const isChecked = Boolean(target?.checked);
    await this.document.update({ "system.state.wounded": isChecked });
  }

  static async _onAddAbility(event, target) {
    if (!game.user?.isGM || !this._editMode) return;
    const abilities = this.document.system.abilities ?? [];
    abilities.push({ name: "New Ability", text: "" });
    await this.document.update({ "system.abilities": abilities });
  }

  static async _onAddEquipment(event, target) {
    if (!game.user?.isGM || !this._editMode) return;
    const equipment = this.document.system.equipment ?? [];
    equipment.push({ name: "New Gear", note: "" });
    await this.document.update({ "system.equipment": equipment });
  }

  static async _onRemoveRow(event, target) {
    if (!game.user?.isGM || !this._editMode) return;
    const row = target.closest("[data-index]");
    if (!row) return;
    const index = Number(row.dataset.index);
    const collection = row.dataset.collection;
    if (!Number.isInteger(index) || !collection) return;

    const path = `system.${collection}`;
    const data = foundry.utils.duplicate(this.document.system[collection] ?? []);
    data.splice(index, 1);
    await this.document.update({ [path]: data });
  }

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
      const updateObj = {
        // Always sync portrait and token
        img: url,
        "prototypeToken.texture.src": url
      };
      // Also ensure the specific clicked path updates for safety
      updateObj[path] = url;
      console.log(`SWIA: Calling actor.update() with:`, updateObj);
      
      try {
        const result = await actor.update(updateObj);
        console.log(`SWIA: Update result:`, result);
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

  static async _onEditImage(event, target) {
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
        const updateObj = {
          // Always sync portrait and token
          img: url,
          "prototypeToken.texture.src": url
        };
        updateObj[path] = url;
        await doc.update(updateObj);
        // Re-render to refresh the portrait immediately
        try { sheet.render(false); } catch (e) { /* noop */ }
      }
    });
    fp.render(true);
  }

  static async _onToggleEdit(event, target) {
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

  static async _onChangeName(event, target) {
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

  /**
   * Collect current form data and persist key fields, even if submit is skipped.
   */
  async _saveFormData() {
    const formData = this._collectFormData();
    const expanded = foundry.utils.expandObject(formData ?? {});
    const update = {};

    if (formData?.name !== undefined) update.name = formData.name;
    else if (expanded.name !== undefined) update.name = expanded.name;

    if (expanded.system !== undefined) update.system = expanded.system;

    if (Object.keys(update).length === 0) return;
    
    const actor = this.document ?? this.actor;
    if (!actor) return;
    
    try {
      await actor.update(update);
    } catch (err) {
      console.error("SWIA: Failed to save form data", err);
    }
  }

  /**
   * Gather form data safely across V1/V2 without relying on _getSubmitData.
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
}
