// SWIA item data models (Foundry v13+ TypeDataModel).
// Schemas mirror the legacy template.json structure so existing world data loads unchanged.
import { int, num, str, html, attackDice, defenseDice, abilityList, surgeList, weaponSurgeList, keywords, toArray } from "./common.js";

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
      armorClass: str(),
      defenseDice: defenseDice()
    };
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
