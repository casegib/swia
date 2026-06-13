// SWIA actor data models (Foundry v13+ TypeDataModel).
// Schemas mirror the legacy template.json structure so existing world data loads unchanged.
import { int, str, html, bool, resource, attackDice, defenseDice, abilityList, surgeList, toArray } from "./common.js";

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
        tech: attackDice()
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
      tech: attackDice()
    };
  }

  static migrateData(source) {
    if (source.heroAbilities !== undefined) source.heroAbilities = toArray(source.heroAbilities);
    if (source.woundedHeroAbilities !== undefined) source.woundedHeroAbilities = toArray(source.woundedHeroAbilities);
    return super.migrateData(source);
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

export class AllyData extends UnitData {}

export class CharacterData extends SWIAActorBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      affiliation: str(),
      preferredDisposition: str("neutral")
    };
  }
}
