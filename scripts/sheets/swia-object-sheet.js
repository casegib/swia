// Foundry v13+ ApplicationV2 actor sheet for the general-purpose "object" type.
// Modeled on SWIACharacterSheet: simple view + GM-only inline edit mode.
const { HandlebarsApplicationMixin } = foundry.applications.api;
const BaseActorSheet = HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2);

export class SWIAObjectSheet extends BaseActorSheet {
  constructor(...args) {
    super(...args);
    this._editMode = false;
  }

  static DEFAULT_OPTIONS = {
    classes: ["swia", "sheet", "actor", "object"],
    window: {
      resizable: true,
      controls: []
    },
    position: {
      width: 480,
      height: 520
    },
    form: {
      submitOnChange: true
    },
    actions: {
      toggleEdit: SWIAObjectSheet.prototype._onToggleEdit,
      editImage: SWIAObjectSheet.prototype._onEditImage
    }
  };

  static PARTS = {
    form: {
      template: "systems/swia/templates/actors/object-sheet.hbs"
    }
  };

  /** Build an array of length n for iterating dice icons in the template. */
  static _diceArray(n) {
    const count = Math.max(0, parseInt(n) || 0);
    return Array.from({ length: count }, (_, i) => i);
  }

  async _prepareContext(options = {}) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const systemData = actor.system;
    const isGM = game.user.isGM;
    const defense = systemData.attributes?.defense ?? { black: 0, white: 0 };

    return foundry.utils.mergeObject(context, {
      actor,
      systemData,
      isGM,
      editMode: this._editMode,
      currentAttributes: {
        health: {
          value: systemData.attributes?.health?.value ?? 0,
          max: systemData.attributes?.health?.max ?? 0
        },
        defense: {
          black: defense.black ?? 0,
          white: defense.white ?? 0
        }
      },
      defenseBlackDice: SWIAObjectSheet._diceArray(defense.black),
      defenseWhiteDice: SWIAObjectSheet._diceArray(defense.white),
      profileSrc: actor.img,
      tokenPreviewSrc: actor.prototypeToken?.texture?.src ?? actor.img
    });
  }

  async _onToggleEdit(event, target) {
    event?.preventDefault?.();
    if (!game.user?.isGM) return;

    const checked = Boolean(target?.checked ?? event?.currentTarget?.checked ?? !this._editMode);
    const wasEditing = this._editMode;
    this._editMode = checked;

    if (!this._editMode && wasEditing) {
      await this._saveFormData();
    }

    this.render(false);
  }

  async _saveFormData() {
    const formData = this._collectFormData();
    if (!formData || Object.keys(formData).length === 0) return;

    const expanded = foundry.utils.expandObject(formData);
    const update = {};
    if (expanded.name !== undefined) update.name = expanded.name;
    if (expanded.system !== undefined) update.system = expanded.system;
    if (Object.keys(update).length === 0) return;

    await this.actor.update(update);
  }

  _collectFormData() {
    const searchRoot = this.element;
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

  async _onEditImage(event, target) {
    event?.preventDefault?.();
    if (!game.user?.isGM || !this._editMode) return;

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
