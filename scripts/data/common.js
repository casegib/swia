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
