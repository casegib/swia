// SWIA actor data models (Foundry v13+ TypeDataModel).
// Schemas mirror the legacy template.json structure so existing world data loads unchanged.
import { int, str, html, bool, resource, attackDice, defenseDice, customAttr, abilityList, surgeList, toArray, armorEffectsFor } from "./common.js";

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
   * Derived data: equipped armor's printed "+N Health" is added on top of
   * the STORED max. `health.max` is therefore the effective max everywhere
   * it is read (sheet, portals, steppers, wound/heal reset, Foundry token
   * bars); the printed base survives as `health.baseMax` and the armor share
   * as `health.armorBonus` for display. Anything that WRITES max must write
   * the base — the hero sheet's edit inputs read from `_source` for exactly
   * that reason. Subclasses with a second attribute set (hero wounded side)
   * call applyArmorHealth on it too.
   */
  prepareDerivedData() {
    super.prepareDerivedData?.();
    this.armorEffects = armorEffectsFor(this.parent);
    this.applyArmorHealth(this.attributes?.health);
  }

  applyArmorHealth(health) {
    if (!health) return;
    const bonus = Math.max(0, Number(this.armorEffects?.health) || 0);
    // baseMax is only ever set by this method, so on a fresh prepare it is
    // undefined and max IS the stored base. Reading it back makes a repeated
    // prepare on the same instance a no-op instead of stacking the bonus.
    const base = Math.max(0, Number(health.baseMax ?? health.max) || 0);
    health.baseMax = base;
    health.armorBonus = bonus;
    health.max = base + bonus;
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

  /** Wounded doesn't change printed Health, so armor applies to both sides. */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.applyArmorHealth(this.woundedAttributes?.health);
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
