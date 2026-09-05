// SWIA item data models (Foundry v13+ TypeDataModel).
// Schemas mirror the legacy template.json structure so existing world data loads unchanged.
import { int, num, str, html, bool, attackDice, abilityList, surgeList, weaponSurgeList, keywords, toArray, modifierField, cardUseList } from "./common.js";

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

/**
 * Class-deck tag for equipment. A hero class deck carries real weapons,
 * armor, modifications and equipment (Repeating Blaster, Trophy Armor,
 * Vibrobayonet…). They stay their own item type so they fight/equip like
 * anything else, but `heroClass` marks the deck they belong to and
 * `classXp` is the printed XP cost (0 = starting card). The hero sheet's
 * Class Cards column lists tagged items alongside the feat cards.
 */
function classDeckFields() {
  return {
    heroClass: str(),
    classXp: int()
  };
}

/**
 * Earlier pack builds carried the class-deck tag only in
 * `flags.swia.{heroClass,classXp}`; the ready-hook migration in swia.js
 * lifts those into the schema for items already in a world.
 */

export class WeaponData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ...classDeckFields(),
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
      ...classDeckFields(),
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
      ...classDeckFields(),
      // House weight class (light/medium/heavy). Printed cards don't carry
      // this; it's a table convenience, so it stays optional.
      armorClass: str(),
      // The printed trait line ("Armor", "Armor, Rare"), free text like weapons.
      traits: str(),
      // Printed flat effects, in the shared modifier shape. Armor in
      // Imperial Assault never adds defense DICE — it adds Health
      // (`modifier.stats.health`, feeding the wearer's derived max) and
      // Block/Evade results (`modifier.defense`, seeding the defender's
      // bonus row in the combat window and on the solo defense card). The
      // other modifier slots exist for house-ruled pieces.
      modifier: modifierField(),
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
    // 0.1.8 stored the printed effects as three flat fields; fold them into
    // the shared modifier (only when the modifier itself carries nothing,
    // so a re-migration can't double them).
    const legacy = ["bonusHealth", "bonusBlock", "bonusEvade"].filter((k) => source[k] !== undefined);
    if (legacy.length) {
      const mod = source.modifier ?? {};
      const empty = !(Number(mod.stats?.health) || Number(mod.defense?.block) || Number(mod.defense?.evade));
      if (empty) {
        source.modifier = foundry.utils.mergeObject(mod, {
          stats: { health: Math.max(0, Number(source.bonusHealth) || 0) },
          defense: { block: Math.max(0, Number(source.bonusBlock) || 0), evade: Math.max(0, Number(source.bonusEvade) || 0) }
        }, { inplace: false });
      }
      for (const k of legacy) delete source[k];
    }
    return super.migrateData(source);
  }
}

export class GearData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ...classDeckFields(),
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
      abilityText: html(),
      // Always-on part of the card ("Apply +2 Health to your hero",
      // "+1 Accuracy", "+1 Evade"). Applied while the card is owned — a
      // purchased class card has no equip toggle. Declared, costed effects
      // ("exhaust this card while attacking…") are the `use` list.
      passive: modifierField(),
      use: cardUseList()
    };
  }

  static migrateData(source) {
    if (source.use !== undefined) source.use = toArray(source.use);
    return super.migrateData(source);
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

/**
 * Imperial class cards live in two places. The Imperial player's purchased
 * deck is the set of WORLD items of this type (the Imperial portal lists
 * them); a card there is class-wide — its passive and declared effects
 * apply to every villain (Sharpshooters, Find the Weakness, Shock
 * Troopers). An `attachment` card is instead dragged onto ONE deployment
 * group's actor, where its embedded copy carries the group's exhaust state
 * and its effects apply to that group alone (Reactive Armor, Combat
 * Veterans, Cloaking Device). See equipmentSourcesFor / cardUsesFor.
 */
export class ImperialclasscardData extends SWIAItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      cooldown: int(),
      // Printed "Attachment." cards go on a deployment group; everything
      // else is class-wide from the world deck.
      attachment: bool(),
      imperialClass: str(),
      classXp: int(),
      passive: modifierField(),
      use: cardUseList()
    };
  }

  static migrateData(source) {
    if (source.use !== undefined) source.use = toArray(source.use);
    return super.migrateData(source);
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
