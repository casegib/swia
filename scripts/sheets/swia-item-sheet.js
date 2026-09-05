// Foundry v13+ ApplicationV2 item sheet
const { HandlebarsApplicationMixin } = foundry.applications.api;
const BaseItemSheet = HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2);

import { modifierChips, modifierEffectHTML, cardUseCostLabels, toArray, CARD_USE_ITEM_TYPES } from "../data/common.js";

function resolveItemDocument(ctx) {
  return ctx?.document ?? ctx?.item ?? ctx?.object ?? ctx?.options?.document ?? null;
}

// Item types whose surge abilities use the structured weapon surge editor
// (cost / effect type / value / text / exhaust) and the DOM-scrape save path.
// Armor is deliberately absent: defenders never spend surges.
const STRUCTURED_SURGE_TYPES = ["weapon", "weaponmod"];
// Item types carrying the free-form printed ability rows.
const ABILITY_ROW_TYPES = ["weapon", "armor"];

function mapItemSheetType(sourceType) {
  if (sourceType === "agendacard" || sourceType === "imperialclasscard") return "classcard";
  return sourceType;
}

/** Build a human-readable effect label for a structured weapon surge entry. */
function weaponSurgeDisplayEffect(surge) {
  const value = Number(surge.effectValue) || 0;
  switch (surge.effectType) {
    case "damage":
      return `+${value} ${game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Damage")}`;
    case "accuracy":
      return `+${value} ${game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Accuracy")}`;
    case "pierce":
      return `${game.i18n.localize("SWIA.Item.Weapon.SurgeEffectType.Pierce")} ${value}`;
    case "condition":
    case "special":
      return surge.effectText || game.i18n.localize(`SWIA.Item.Weapon.SurgeEffectType.${surge.effectType === "condition" ? "Condition" : "Special"}`);
    default:
      return surge.effectText || "";
  }
}

/** Build a "Pierce 2 · Blast 1 · Cleave · Reach" line from a keywords block. */
function buildKeywordsLine(keywords) {
  if (!keywords) return "";
  const parts = [];
  if (keywords.pierce > 0) parts.push(`${game.i18n.localize("SWIA.Keywords.Pierce")} ${keywords.pierce}`);
  if (keywords.blast > 0) parts.push(`${game.i18n.localize("SWIA.Keywords.Blast")} ${keywords.blast}`);
  if (keywords.cleave) parts.push(game.i18n.localize("SWIA.Keywords.Cleave"));
  if (keywords.reach) parts.push(game.i18n.localize("SWIA.Keywords.Reach"));
  return parts.join(" · ");
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
      cycleCardState: SWIAItemSheet.#onCycleCardState,
      addFormSurgeAbility: SWIAItemSheet.#onAddFormSurgeAbility,
      removeFormSurgeAbility: SWIAItemSheet.#onRemoveFormSurgeAbility,
      addFormSpecialAbility: SWIAItemSheet.#onAddFormSpecialAbility,
      removeFormSpecialAbility: SWIAItemSheet.#onRemoveFormSpecialAbility,
      addUse: SWIAItemSheet.#onAddUse,
      removeUse: SWIAItemSheet.#onRemoveUse
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

    this.options.form ??= {};
    this.options.form.submitOnChange = false;
    this.options.form.handler = this._onSubmitItemForm.bind(this);
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

  // Handle form submission
  async _onSubmitItemForm(event, form, formData) {
    const raw = formData?.object ?? formData ?? {};
    const normalized = foundry.utils.flattenObject(foundry.utils.expandObject(raw));
    let update = this._extractItemUpdate(normalized);

    // Fallback: pull values from the live form if Foundry supplied an empty payload.
    if (!Object.keys(update).length) {
      update = this._collectUpdateFromForm(form);
    }

    const item = resolveItemDocument(this);
    if (!item) return;

    // Structured surge rows and printed ability rows are unnamed inputs; scrape them.
    if (STRUCTURED_SURGE_TYPES.includes(item.type)) {
      Object.assign(update, this._collectWeaponSurgeUpdate(form));
    }
    if (ABILITY_ROW_TYPES.includes(item.type)) {
      Object.assign(update, this._collectAbilityRowsUpdate(form));
    }
    if (CARD_USE_ITEM_TYPES.includes(item.type)) {
      Object.assign(update, this._collectCardUseUpdate(form));
    }
    if (item.type === "weapon") {
      Object.assign(update, this._collectExhaustRowsUpdate(form));
    }

    if (!Object.keys(update).length) return;
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
    if (!STRUCTURED_SURGE_TYPES.includes(item.type)) return;
    
    const surgeAbilities = item.system.surgeAbilities || [];
    const newSurgeAbilities = [...surgeAbilities, { cost: 1, effectType: "damage", effectValue: 0, effectText: "", exhaustToUse: false }];
    
    await item.update({ "system.surgeAbilities": newSurgeAbilities });
  }

  // Remove surge ability from weapon (V2)
  static async #onRemoveSurgeAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    if (!STRUCTURED_SURGE_TYPES.includes(item.type)) return;
    
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
    if (!ABILITY_ROW_TYPES.includes(item.type)) return;
    const abilities = Array.isArray(item.system.abilities) ? item.system.abilities : Object.values(item.system.abilities || {});
    await item.update({ "system.abilities": [...abilities, { prefix: "none", description: "" }] });
  }

  // Remove ability from weapon (V2)
  static async #onRemoveAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    if (!ABILITY_ROW_TYPES.includes(item.type)) return;
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

    const formEl = target?.closest?.("form") ?? null;
    const update = this._collectUpdateFromForm(formEl);
    const item = resolveItemDocument(this);
    if (!item) {
      ui.notifications?.error("SWIA | Unable to resolve item document for save.");
      return;
    }

    // For formcard, scrape array fields from DOM to avoid expandObject plain-object bug
    if (item.type === "formcard") {
      Object.assign(update, this._collectFormcardArrayUpdate(formEl));
    }

    // Same for structured surge abilities and printed ability rows
    if (STRUCTURED_SURGE_TYPES.includes(item.type)) {
      Object.assign(update, this._collectWeaponSurgeUpdate(formEl));
    }
    if (ABILITY_ROW_TYPES.includes(item.type)) {
      Object.assign(update, this._collectAbilityRowsUpdate(formEl));
    }
    if (CARD_USE_ITEM_TYPES.includes(item.type)) {
      Object.assign(update, this._collectCardUseUpdate(formEl));
    }
    if (item.type === "weapon") {
      Object.assign(update, this._collectExhaustRowsUpdate(formEl));
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

  // Declared card effects: add / remove a `use` row (class cards). The row
  // fields save through the DOM scrape below, so add/remove write directly.
  static async #onAddUse(event, target) {
    const item = resolveItemDocument(this);
    if (!item || !CARD_USE_ITEM_TYPES.includes(item.type)) return;
    const uses = toArray(item.system?.use).map((u) => foundry.utils.deepClone(u));
    uses.push({ when: "attack", scope: "self", note: "", choice: "", cost: { exhaust: true, strain: 0, deplete: false, threat: 0 }, modifier: {}, surgeAbilities: [] });
    await item.update({ "system.use": uses });
  }

  static async #onRemoveUse(event, target) {
    const item = resolveItemDocument(this);
    if (!item || !CARD_USE_ITEM_TYPES.includes(item.type)) return;
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    const uses = toArray(item.system?.use).map((u) => foundry.utils.deepClone(u));
    uses.splice(index, 1);
    await item.update({ "system.use": uses });
  }

  /**
   * Scrape the declared-effect rows (unnamed inputs carrying data-field
   * paths relative to the row). Surge grants are carried through from the
   * stored entry — the sheet shows but does not edit them.
   */
  _collectCardUseUpdate(formEl) {
    const root = formEl
      ?? this.element?.querySelector?.('[data-application-part="form"]')
      ?? this.element
      ?? null;
    if (!(root instanceof HTMLElement)) return {};
    if (!root.querySelector(".classcard-uses-edit")) return {};

    const item = resolveItemDocument(this);
    const stored = toArray(item?.system?.use);
    const uses = [];
    root.querySelectorAll(".classcard-uses-edit .use-row[data-index]").forEach((row) => {
      const index = parseInt(row.dataset.index);
      const entry = { when: "attack", scope: "self", note: "", choice: "", cost: { exhaust: false, strain: 0, deplete: false, threat: 0 }, modifier: {}, surgeAbilities: foundry.utils.deepClone(stored[index]?.surgeAbilities ?? []) };
      row.querySelectorAll("[data-field]").forEach((input) => {
        const path = input.dataset.field;
        let value;
        if (input.type === "checkbox") value = input.checked;
        else if (input.type === "number") value = Number(input.value) || 0;
        else value = input.value ?? "";
        foundry.utils.setProperty(entry, path, value);
      });
      uses.push(entry);
    });
    return { "system.use": uses };
  }

  /** Scrape the weapon's exhaust-ability rows (unnamed inputs, like the printed ability rows). */
  _collectExhaustRowsUpdate(formEl) {
    const root = formEl
      ?? this.element?.querySelector?.('[data-application-part="form"]')
      ?? this.element
      ?? null;
    if (!(root instanceof HTMLElement)) return {};
    if (!root.querySelector(".weapon-exhaust-list .exhaust-effect-input")) return {};
    const rows = [];
    root.querySelectorAll(".weapon-exhaust-list .weapon-exhaust-row").forEach((li) => {
      const effect = li.querySelector(".exhaust-effect-input");
      if (!effect) return;
      rows.push({ trigger: li.querySelector(".exhaust-trigger-input")?.value || "action", effect: effect.value ?? "" });
    });
    return { "system.exhaustAbilities": rows };
  }

  // Add surge ability to formcard (V2)
  static async #onAddFormSurgeAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item || item.type !== "formcard") return;
    const surgeAbilities = Array.isArray(item.system.surgeAbilities) ? item.system.surgeAbilities : [];
    await item.update({ "system.surgeAbilities": [...surgeAbilities, { cost: 1, effectText: "" }] });
  }

  // Remove surge ability from formcard (V2)
  static async #onRemoveFormSurgeAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item || item.type !== "formcard") return;
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    const surgeAbilities = Array.isArray(item.system.surgeAbilities) ? item.system.surgeAbilities : [];
    await item.update({ "system.surgeAbilities": surgeAbilities.filter((_, i) => i !== index) });
  }

  // Add special ability to formcard (V2)
  static async #onAddFormSpecialAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item || item.type !== "formcard") return;
    const specialAbilities = Array.isArray(item.system.specialAbilities) ? item.system.specialAbilities : [];
    await item.update({ "system.specialAbilities": [...specialAbilities, { name: "", description: "" }] });
  }

  // Remove special ability from formcard (V2)
  static async #onRemoveFormSpecialAbility(event, target) {
    const item = resolveItemDocument(this);
    if (!item || item.type !== "formcard") return;
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    const specialAbilities = Array.isArray(item.system.specialAbilities) ? item.system.specialAbilities : [];
    await item.update({ "system.specialAbilities": specialAbilities.filter((_, i) => i !== index) });
  }

  // Cycle card state: ready → exhausted → depleted → ready (V2)
  static async #onCycleCardState(event, target) {
    const item = resolveItemDocument(this);
    if (!item) return;
    const current = item.system.cardState || "ready";
    const cycle = { ready: "exhausted", exhausted: "depleted", depleted: "ready" };
    await item.update({ "system.cardState": cycle[current] || "ready" });
  }

  get title() {
    const name = this.document?.name ?? this.item?.name ?? "";
    return name || "Item";
  }

  // Prepare rendering context
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
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

    const enrichedAbilityText = ["heroability", "classcard"].includes(item.type)
      ? await TextEditorClass.enrichHTML(system.abilityText || "", { async: true, secrets: item.isOwner, relativeTo: item })
      : "";

    // Structured weapon/weaponmod surge abilities with display labels for view mode.
    // Normalize to array — Foundry can store new array fields as {} on existing documents.
    const isWeaponLike = ["weapon", "weaponmod"].includes(item.type);
    const surgeRaw = Array.isArray(system.surgeAbilities)
      ? system.surgeAbilities
      : Object.values(system.surgeAbilities || {});
    const weaponSurgeRows = STRUCTURED_SURGE_TYPES.includes(item.type)
      ? surgeRaw.map((surge) => ({ ...surge, displayEffect: weaponSurgeDisplayEffect(surge) }))
      : [];
    const keywordsLine = isWeaponLike ? buildKeywordsLine(system.keywords) : "";

    // Armor view-mode helpers: the weight-class line and whether the effects
    // badge has anything to show (an empty badge gets a "no effects" label).
    const armorClassLabel = item.type === "armor" && system.armorClass
      ? game.i18n.localize(`SWIA.Item.Armor.ArmorClass.${system.armorClass.charAt(0).toUpperCase()}${system.armorClass.slice(1)}`)
      : "";
    const armorChips = item.type === "armor" ? modifierChips(system.modifier) : [];
    const hasArmorEffects = armorChips.length > 0;
    const passiveChips = ["classcard", "imperialclasscard"].includes(item.type) ? modifierChips(system.passive) : [];
    const useRows = CARD_USE_ITEM_TYPES.includes(item.type)
      ? toArray(system.use).map((use, index) => ({
          index,
          ...use,
          whenLabel: game.i18n.localize(`SWIA.Item.ClassCard.UseWhen.${use.when ?? "attack"}`),
          scopeLabel: (use.scope && use.scope !== "self") ? game.i18n.localize(`SWIA.Item.ClassCard.UseScope.${use.scope}`) : "",
          effectHTML: modifierEffectHTML(use.modifier),
          costLabels: cardUseCostLabels(use.cost),
          surgeLines: toArray(use.surgeAbilities).map((sa) => {
            const v = Number(sa.effectValue) || 0;
            const text = sa.effectType === "damage" ? `+${v} ${game.i18n.localize("SWIA.Dice.Damage")}`
              : sa.effectType === "accuracy" ? `+${v} ${game.i18n.localize("SWIA.Dice.Accuracy")}`
              : sa.effectType === "pierce" ? `${game.i18n.localize("SWIA.Keywords.Pierce")} ${v}`
              : (sa.effectText ?? "");
            return { cost: Number(sa.cost) || 1, text };
          })
        }))
      : [];

    const hasClasscardDetails = (item.type === "classcard"
      && Boolean(system.heroClass || system.xpCost > 0 || system.abilityText))
      || item.type === "imperialclasscard"
      || passiveChips.length > 0 || useRows.length > 0;

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
      exhaustRows: item.type === "weapon" ? toArray(system.exhaustAbilities).map((row) => ({
        trigger: row.trigger || "action",
        effect: row.effect ?? "",
        triggerLabel: game.i18n.localize(`SWIA.Item.Weapon.ExhaustTrigger.${(row.trigger || "action").charAt(0).toUpperCase()}${(row.trigger || "action").slice(1)}`)
      })) : [],
      editMode: this.editMode ?? false,
      isEditable: this.isEditable !== false,
      isGM: game.user?.isGM ?? false,
      hasCardImage: hasCardImage,
      cardStateLabel: cardStateLabel,
      weaponSurgeRows: weaponSurgeRows,
      keywordsLine: keywordsLine,
      armorClassLabel: armorClassLabel,
      hasArmorEffects: hasArmorEffects,
      armorChips,
      passiveChips,
      useRows,
      hasClasscardDetails: hasClasscardDetails,
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

  _extractItemUpdate(source) {
    const update = {};

    for (const [key, value] of Object.entries(source ?? {})) {
      if (key === "name" || key.startsWith("system.")) {
        update[key] = value;
      }
    }

    return update;
  }

  // Scrape structured weapon/weaponmod surge rows directly from the DOM.
  // Same rationale as _collectFormcardArrayUpdate: bypasses the expandObject
  // plain-object bug for indexed array paths. Inputs intentionally have no
  // name attributes so _collectUpdateFromForm doesn't double-collect them.
  _collectWeaponSurgeUpdate(formEl) {
    const root = formEl
      ?? this.element?.querySelector?.('[data-application-part="form"]')
      ?? this.element
      ?? null;

    if (!(root instanceof HTMLElement)) return {};

    // Only scrape when the edit-mode list is rendered; otherwise an empty
    // query would wipe the stored array.
    if (!root.querySelector(".weapon-surge-list.edit-list")) return {};

    const surgeAbilities = [];
    root.querySelectorAll(".weapon-surge-entry[data-index]").forEach((li) => {
      const cost = parseInt(li.querySelector(".weapon-surge-cost")?.value) || 1;
      const effectType = li.querySelector(".weapon-surge-type")?.value || "damage";
      const effectValue = Number(li.querySelector(".weapon-surge-value")?.value) || 0;
      const effectText = li.querySelector(".weapon-surge-text")?.value ?? "";
      const exhaustToUse = li.querySelector(".weapon-surge-exhaust")?.checked ?? false;
      surgeAbilities.push({ cost, effectType, effectValue, effectText, exhaustToUse });
    });

    return { "system.surgeAbilities": surgeAbilities };
  }

  // Scrape the printed ability rows (weapon/armor) directly from the DOM.
  // Same rationale as _collectWeaponSurgeUpdate: indexed named paths like
  // "system.abilities.0.description" expand into a plain {"0": {…}} object
  // rather than an array, and they carry only the edited key, so `prefix`
  // would be re-defaulted on every save. Inputs are therefore unnamed.
  _collectAbilityRowsUpdate(formEl) {
    const root = formEl
      ?? this.element?.querySelector?.('[data-application-part="form"]')
      ?? this.element
      ?? null;

    if (!(root instanceof HTMLElement)) return {};

    // Only scrape when the edit inputs are actually rendered; the view-mode
    // list has none, and an empty query would wipe the stored array.
    if (!root.querySelector(".weapon-abilities-list .ability-desc-input")) return {};

    const item = resolveItemDocument(this);
    const stored = Array.isArray(item?.system?.abilities)
      ? item.system.abilities
      : Object.values(item?.system?.abilities ?? {});

    const abilities = [];
    root.querySelectorAll(".weapon-abilities-list .weapon-ability-row").forEach((li, index) => {
      const input = li.querySelector(".ability-desc-input");
      if (!input) return;
      abilities.push({
        // Carry the stored prefix through — nothing edits it yet.
        prefix: stored[index]?.prefix ?? "none",
        description: input.value ?? ""
      });
    });

    return { "system.abilities": abilities };
  }

  // Scrape formcard surge/special ability rows directly from the DOM.
  // Foundry's expandObject turns flat keys like "system.surgeAbilities.0.cost" into
  // plain JS objects ({ "0": {…} }) that have no .length, breaking array checks.
  // Calling this and merging into the update object bypasses that bug.
  _collectFormcardArrayUpdate(formEl) {
    const root = formEl
      ?? this.element?.querySelector?.('[data-application-part="form"]')
      ?? this.element
      ?? null;

    if (!(root instanceof HTMLElement)) return {};

    const surgeAbilities = [];
    root.querySelectorAll(".surge-ability-entry[data-index]").forEach((li) => {
      const cost = parseInt(li.querySelector(".surge-cost-input")?.value) || 1;
      const effectText = li.querySelector(".surge-effect-input")?.value ?? "";
      surgeAbilities.push({ cost, effectText });
    });

    const specialAbilities = [];
    root.querySelectorAll(".special-ability-entry[data-index]").forEach((li) => {
      const name = li.querySelector(".special-ability-name")?.value ?? "";
      const description = li.querySelector(".special-ability-desc")?.value ?? "";
      const surgeCost = Math.max(0, parseInt(li.querySelector(".special-ability-surge-cost-input")?.value) || 0);
      specialAbilities.push({ name, description, surgeCost });
    });

    return {
      "system.surgeAbilities": surgeAbilities,
      "system.specialAbilities": specialAbilities
    };
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
