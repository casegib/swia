// Shared field builders for SWIA data models.
// Field options are chosen to be tolerant of legacy data created under template.json:
// no `choices` restrictions, blank strings allowed, numbers coerced from strings.
const fields = foundry.data.fields;

/** Non-negative integer field. */
export function int(initial = 0, options = {}) {
  return new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial, ...options });
}

/** General numeric field (fractional values allowed). */
export function num(initial = 0, options = {}) {
  return new fields.NumberField({ required: true, nullable: false, initial, ...options });
}

/** Plain string field, blank allowed. */
export function str(initial = "") {
  return new fields.StringField({ required: true, blank: true, initial });
}

/** Rich text / HTML string field. */
export function html() {
  return new fields.HTMLField({ required: true, blank: true, initial: "" });
}

/** Boolean field. */
export function bool(initial = false) {
  return new fields.BooleanField({ initial });
}

/** A {value, max} resource pool (health, endurance). */
export function resource(value, max) {
  return new fields.SchemaField({ value: int(value), max: int(max) });
}

/** Attack/attribute dice pool: red/blue/green/yellow counts. */
export function attackDice() {
  return new fields.SchemaField({ red: int(), blue: int(), green: int(), yellow: int() });
}

/** Defense dice pool: black/white counts. */
export function defenseDice() {
  return new fields.SchemaField({ black: int(), white: int() });
}

/**
 * User-definable custom attribute slot: a toggle, a free-text label, and an
 * attack-style dice pool. Defaults to disabled/blank/empty so existing actors
 * load unchanged.
 */
export function customAttr() {
  return new fields.SchemaField({
    enabled: bool(false),
    label: str(),
    icon: str(),
    red: int(), blue: int(), green: int(), yellow: int()
  });
}

/** List of {name, description} ability entries (special abilities, etc.). */
export function abilityList(extraFields = {}) {
  return new fields.ArrayField(new fields.SchemaField({
    name: str(),
    description: str(),
    ...extraFields
  }));
}

/** List of {cost, effectText} surge ability entries (actors, form cards). */
export function surgeList() {
  return new fields.ArrayField(new fields.SchemaField({
    cost: int(1),
    effectText: str()
  }));
}

/** List of structured weapon surge entries: {cost, effectType, effectValue, effectText}. */
export function weaponSurgeList() {
  return new fields.ArrayField(new fields.SchemaField({
    cost: int(1),
    effectType: str("damage"),
    effectValue: num(0),
    effectText: str()
  }));
}

/** Weapon keyword block. */
export function keywords() {
  return new fields.SchemaField({
    pierce: int(),
    blast: int(),
    cleave: bool(),
    reach: bool()
  });
}

/**
 * Coerce legacy plain-object "arrays" ({"0": {...}, "1": {...}}) back into real arrays.
 * Older saves produced these via expandObject on dot-notation indexed keys.
 */
export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

/** Escape raw text for safe HTML interpolation. */
export function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const LABEL_ALLOWED_TAGS = new Set(["img", "strong", "em", "br", "span"]);
const LABEL_ALLOWED_ATTRS = {
  img: new Set(["src", "alt", "title", "class"]),
  strong: new Set(["class", "title"]),
  em: new Set(["class", "title"]),
  br: new Set([]),
  span: new Set(["class", "title"])
};

function isSafeLabelUrl(value) {
  const normalized = String(value ?? "").trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (lower.startsWith("javascript:")) return false;
  if (lower.startsWith("data:")) return /^data:image\//i.test(normalized);
  return true;
}

function sanitizeLabelNode(node, doc) {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent ?? "");
  if (node.nodeType !== 1) return doc.createDocumentFragment();

  const tag = node.tagName.toLowerCase();
  if (!LABEL_ALLOWED_TAGS.has(tag)) {
    const fragment = doc.createDocumentFragment();
    for (const child of node.childNodes) fragment.appendChild(sanitizeLabelNode(child, doc));
    return fragment;
  }

  if (tag === "img") {
    const src = node.getAttribute("src") ?? "";
    if (!isSafeLabelUrl(src)) return doc.createDocumentFragment();
  }

  const clean = doc.createElement(tag);
  const allowedAttrs = LABEL_ALLOWED_ATTRS[tag] ?? new Set();
  for (const attr of node.attributes) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) continue;
    if (!allowedAttrs.has(name)) continue;
    if (tag === "img" && name === "src" && !isSafeLabelUrl(attr.value)) continue;
    clean.setAttribute(name, attr.value);
  }

  for (const child of node.childNodes) clean.appendChild(sanitizeLabelNode(child, doc));
  return clean;
}

/** Sanitize limited rich HTML used in surge labels while preserving icon markup. */
export function sanitizeLabelHTML(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value ?? "");
  const container = document.createElement("div");
  for (const child of template.content.childNodes) container.appendChild(sanitizeLabelNode(child, document));
  return container.innerHTML;
}
