// SWIA item data models (Foundry v13+ TypeDataModel).
// Schemas mirror the legacy template.json structure so existing world data loads unchanged.
import { int, num, str, html, bool, attackDice, abilityList, surgeList, weaponSurgeList, keywords, toArray } from "./common.js";

const fields = foundry.data.fields;
const { TypeDataModel } = foundry.abstract;

/** Shared base: description, cost, card state (ready/exhausted/depleted). */
class SWIAItemBase extends TypeDataModel {
  static defineSchema() {
    return {
      description: html(),
      cost: int(),
      cardState: str("ready")
    };
  }
}

export class WeaponData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      weaponClass: str(),
      weaponSubtype: str(),
      attackDice: attackDice(),
      // "" = use printed attackDice; strength|insight|tech = the wielder's
      // attribute pool substitutes for the printed dice (Ancient Lightsaber)
      poolAttribute: str(),
      damage: int(),
      accuracy: int(),
      range: str("melee"),
      keywords: keywords(),
      surgeAbilities: weaponSurgeList(),
      exhaustAbilities: new fields.ArrayField(new fields.SchemaField({
        trigger: str("action"),
        effect: str()
      })),
      abilities: new fields.ArrayField(new fields.SchemaField({
        prefix: str("none"),
        description: str()
      })),
      attachmentSlots: int(),
      traits: str(),
      imageOffsetX: num(50),
      imageOffsetY: num(50),
      imageZoom: num(1)
    };
  }

  static migrateData(source) {
    if (source.surgeAbilities !== undefined) source.surgeAbilities = toArray(source.surgeAbilities);
    if (source.exhaustAbilities !== undefined) source.exhaustAbilities = toArray(source.exhaustAbilities);
    if (source.abilities !== undefined) source.abilities = toArray(source.abilities);
    return super.migrateData(source);
  }
}

export class WeaponmodData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      modCompatType: str("melee"),
      modSubtype: str(),
      attachedWeaponId: str(),
      bonusDice: attackDice(),
      bonusDamage: int(),
      bonusAccuracy: int(),
      surgeAbilities: weaponSurgeList(),
      keywords: keywords()
    };
  }

  static migrateData(source) {
    if (source.surgeAbilities !== undefined) source.surgeAbilities = toArray(source.surgeAbilities);
    return super.migrateData(source);
  }
}

export class ArmorData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      // House weight class (light/medium/heavy). Printed cards don't carry
      // this; it's a table convenience, so it stays optional.
      armorClass: str(),
      // The printed trait line ("Armor", "Armor, Rare"), free text like weapons.
      traits: str(),
      // Printed flat effects. Armor in Imperial Assault never adds defense
      // DICE — it adds Health, and Block/Evade results that apply on top of
      // whatever the defender rolls. Health feeds the wearer's derived max
      // (see actors.js); Block/Evade seed the defender's bonus row in the
      // combat window and the solo defense card.
      bonusHealth: int(),
      bonusBlock: int(),
      bonusEvade: int(),
      // Conditional / one-off printed text ("+1 Block against Ranged attacks",
      // rerolls). Read by a human at the table, not the engine.
      abilities: new fields.ArrayField(new fields.SchemaField({
        prefix: str("none"),
        description: str()
      })),
      // Only equipped armor contributes any of the above. Defaults true so
      // armor that predates this field keeps working without a migration.
      equipped: bool(true),
      imageOffsetX: num(50),
      imageOffsetY: num(50),
      imageZoom: num(1)
    };
  }

  static migrateData(source) {
    // Earlier builds modeled armor as defense dice (and briefly as surge
    // abilities). Neither exists on the printed cards; drop them so they
    // can't be resurrected by a stale sheet or import.
    delete source.defenseDice;
    delete source.surgeAbilities;
    if (source.abilities !== undefined) source.abilities = toArray(source.abilities);
    return super.migrateData(source);
  }
}

export class GearData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      accessorySubtype: str()
    };
  }
}

export class ClasscardData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      cooldown: int(),
      xpCost: int(),
      heroClass: str(),
      abilityText: html()
    };
  }
}

export class AgendacardData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      cooldown: int(),
      influenceCost: int(),
      agendaType: str(),
      missionEffect: str()
    };
  }
}

export class ImperialclasscardData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      cooldown: int()
    };
  }
}

export class HeroabilityData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      abilityText: html()
    };
  }
}

export class FormcardData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      surgeAbilities: surgeList(),
      // surgeCost > 0 marks an ability that is spent as a surge during attacks
      specialAbilities: abilityList({ surgeCost: int() })
    };
  }

  static migrateData(source) {
    if (source.surgeAbilities !== undefined) source.surgeAbilities = toArray(source.surgeAbilities);
    if (source.specialAbilities !== undefined) source.specialAbilities = toArray(source.specialAbilities);
    return super.migrateData(source);
  }
}
