// SWIA actor data models (Foundry v13+ TypeDataModel).
// Schemas mirror the legacy template.json structure so existing world data loads unchanged.
import { int, str, html, bool, resource, attackDice, defenseDice, customAttr, abilityList, surgeList, toArray, equipmentEffectsFor } from "./common.js";

const fields = foundry.data.fields;
const { TypeDataModel } = foundry.abstract;

/** Shared base: biography + core attributes (health, speed, defense). */
class SWIAActorBase extends TypeDataModel {
  static defineSchema() {
    return {
      biography: html(),
      attributes: new fields.SchemaField(this.defineAttributes())
    };
  }

  /** Subclasses extend this to add type-specific attributes. */
  static defineAttributes() {
    return {
      health: resource(10, 10),
      speed: int(4),
      defense: defenseDice()
    };
  }

  /**
   * Derived data: the always-on modifiers of equipped armor and owned
   * class-card passives ("+4 Health", "+1 Endurance", "+1 Speed") are added
   * on top of the STORED values. `health.max` / `endurance.max` / `speed`
   * are therefore the effective numbers everywhere they are read (sheet,
   * portals, steppers, wound/heal reset, Foundry token bars); the printed
   * base survives as `<resource>.baseMax` / `speedBase` and the gear share
   * as `<resource>.equipmentBonus` / `speedBonus` for display. Anything
   * that WRITES a max must write the base — the hero sheet's edit inputs
   * read from `_source` for exactly that reason. Subclasses with a second
   * attribute set (hero wounded side) call applyEquipmentStats on it too.
   */
  prepareDerivedData() {
    super.prepareDerivedData?.();
    this.equipmentEffects = equipmentEffectsFor(this.parent);
    this.applyEquipmentStats(this.attributes);
  }

  applyEquipmentStats(attrs) {
    if (!attrs) return;
    const stats = this.equipmentEffects?.stats ?? {};
    this.applyResourceBonus(attrs.health, Number(stats.health) || 0);
    this.applyResourceBonus(attrs.endurance, Number(stats.endurance) || 0);
    // Speed is a bare integer, so the base rides alongside it.
    if (typeof attrs.speed === "number") {
      const base = Math.max(0, Number(attrs.speedBase ?? attrs.speed) || 0);
      const bonus = Number(stats.speed) || 0;
      attrs.speedBase = base;
      attrs.speedBonus = bonus;
      attrs.speed = Math.max(0, base + bonus);
    }
  }

  applyResourceBonus(res, bonus) {
    if (!res) return;
    // baseMax is only ever set here, so on a fresh prepare it is undefined
    // and max IS the stored base. Reading it back makes a repeated prepare
    // on the same instance a no-op instead of stacking the bonus.
    const base = Math.max(0, Number(res.baseMax ?? res.max) || 0);
    res.baseMax = base;
    res.equipmentBonus = bonus;
    res.max = Math.max(0, base + bonus);
  }
}

export class HeroData extends SWIAActorBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      title: str(),
      archetype: str(),
      affiliation: str(),
      xp: int(),
      woundedTokenImage: str(),
      // Healthy token art, captured the moment a hero is wounded (wounding
      // overwrites prototypeToken.texture.src) so healing can restore it.
      healthyTokenImage: str(),
      woundedBiography: html(),
      heroAbilities: abilityList({ sourceUuid: str() }),
      woundedHeroAbilities: abilityList({ sourceUuid: str() }),
      woundedAttributes: new fields.SchemaField({
        health: resource(10, 10),
        endurance: resource(4, 4),
        speed: int(3),
        strength: attackDice(),
        insight: attackDice(),
        tech: attackDice(),
        custom1: customAttr(),
        custom2: customAttr(),
        custom3: customAttr()
      }),
      state: new fields.SchemaField({
        wounded: bool(),
        activated: bool(),
        defeated: bool()
      })
    };
  }

  static defineAttributes() {
    return {
      ...super.defineAttributes(),
      endurance: resource(4, 4),
      surge: int(1),
      threat: int(),
      strength: attackDice(),
      insight: attackDice(),
      tech: attackDice(),
      custom1: customAttr(),
      custom2: customAttr(),
      custom3: customAttr()
    };
  }

  static migrateData(source) {
    if (source.heroAbilities !== undefined) source.heroAbilities = toArray(source.heroAbilities);
    if (source.woundedHeroAbilities !== undefined) source.woundedHeroAbilities = toArray(source.woundedHeroAbilities);
    return super.migrateData(source);
  }

  /** Gear and passives apply to both hero sides; the wounded side has its own printed numbers. */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.applyEquipmentStats(this.woundedAttributes);
  }
}

/** Shared schema for deployable units (villain / ally). */
class UnitData extends SWIAActorBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      groupSize: int(1),
      isElite: bool(),
      isUnique: bool(),
      affiliation: str(),
      deployCost: int(6),
      traits: str(),
      reinforceCost: int(1),
      reward: str(),
      // surgeCost > 0 marks an ability that is spent as a surge during attacks
      specialAbilities: abilityList({ surgeCost: int() }),
      state: new fields.SchemaField({
        activated: bool()
      })
    };
  }

  static defineAttributes() {
    return {
      ...super.defineAttributes(),
      attackType: str("ranged"),
      attack: attackDice(),
      surge: int(),
      surgeAbilities: surgeList()
    };
  }

  static migrateData(source) {
    if (source.specialAbilities !== undefined) source.specialAbilities = toArray(source.specialAbilities);
    if (source.attributes?.surgeAbilities !== undefined) {
      source.attributes.surgeAbilities = toArray(source.attributes.surgeAbilities);
    }
    return super.migrateData(source);
  }
}

export class VillainData extends UnitData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      hasShift: bool(),
      activeFormId: str()
    };
  }
}

export class AllyData extends UnitData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      // Actor id of the hero or villain this ally is a companion of. Blank =
      // unassigned (lives in the Companion Area). Set explicitly rather than
      // inferred from ownership, so NPC companions work the same as player ones.
      companionOf: str()
    };
  }
}

export class CharacterData extends SWIAActorBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      affiliation: str(),
      preferredDisposition: str("neutral")
    };
  }
}

/** General-purpose map object: destructible props and/or interactive mission tokens. */
export class ObjectData extends SWIAActorBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      objectType: str(),
      traits: str(),
      interactable: bool(false),
      interactionText: html(),
      objectState: str("default")
    };
  }

  static defineAttributes() {
    return {
      health: resource(0, 0),
      defense: defenseDice()
    };
  }
}
