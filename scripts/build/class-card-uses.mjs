#!/usr/bin/env node
/**
 * Derive the `use` list (declared, costed roll effects) for each class card in
 * docs/class-cards.json from its survey `model`, with explicit overrides where
 * the model's flat bonus/dice needs a judgment call (choose-one cards, effects
 * that land on the other side, cards with no buildable effect).
 *
 * Run:  node scripts/build/class-card-uses.mjs   (npm run uses)
 * Rewrites docs/class-cards.json in place (adds/replaces the `use` key; every
 * other field is left byte-identical). Cards that get no `use` have the key
 * removed. Reroll / swap / convert-only cards get nothing on purpose: rerolls
 * are already free until a surge spend, and the rest is table adjudication.
 *
 * A `use` entry:
 *   when     attack | defense | test
 *   note     printed condition, shown on the button (never enforced)
 *   choice   entries sharing a non-empty choice are mutually exclusive
 *   cost     { exhaust, strain, deplete, threat }
 *   modifier sparse modifier (attack / defense / dice) — attack shifts land on
 *            the attacker's layer and defense shifts on the defender's,
 *            whichever side declared the card
 *   surges   printed surge lines granted for this attack ("⚡: +2⊠")
 *   scope    self | friendly | any — whose roll offers it (owner always pays)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PATH = path.join(ROOT, "docs/class-cards.json");
const cards = JSON.parse(fs.readFileSync(PATH, "utf8"));

const DICE = new Set(["red", "blue", "green", "yellow", "black", "white"]);

function costOf(text) {
  const t = String(text ?? "none").toLowerCase();
  const out = {};
  if (t.includes("exhaust")) out.exhaust = true;
  if (t.includes("deplete")) out.deplete = true;
  const m = t.match(/strain\s*(\d+)/);
  if (m) out.strain = Number(m[1]);
  return out;
}

/** {add: [...], remove: [...]} → sparse modifier.dice, or null when a named colour isn't the whole story. */
function diceOf(modelDice) {
  const out = { attack: {}, defense: {} };
  for (const [sign, key] of [[1, "add"], [-1, "remove"]]) {
    for (const entry of modelDice?.[key] ?? []) {
      const colour = String(entry).split(/\s+/)[0].toLowerCase().replace(/[(),]/g, "");
      if (!DICE.has(colour)) return null;
      const side = colour === "black" || colour === "white" ? "defense" : "attack";
      out[side][colour] = (out[side][colour] ?? 0) + sign;
    }
  }
  const res = {};
  for (const [k, v] of Object.entries(out)) if (Object.keys(v).length) res[k] = v;
  return res;
}

function modFrom(bonus, dice) {
  const mod = {};
  const attack = {}; const defense = {};
  for (const [k, v] of Object.entries(bonus ?? {})) {
    if (!v) continue;
    if (["damage", "surge", "accuracy", "pierce"].includes(k)) attack[k] = v;
    else if (["block", "evade"].includes(k)) defense[k] = v;
  }
  if (Object.keys(attack).length) mod.attack = attack;
  if (Object.keys(defense).length) mod.defense = defense;
  const d = dice && Object.keys(dice).length ? diceOf(dice) : {};
  if (d && Object.keys(d).length) mod.dice = d;
  return mod;
}

function entry(when, cost, note = "", modifier = null, surges = null, choice = "", scope = "self") {
  const e = { when, cost, note };
  if (scope && scope !== "self") e.scope = scope;
  if (choice) e.choice = choice;
  if (modifier && Object.keys(modifier).length) e.modifier = modifier;
  if (surges && surges.length) e.surges = [...surges];
  return e;
}

// ---------------------------------------------------------------------------
// Overrides, keyed by "group|name". null = no use (text only).
// An array = the exact use entries.
// ---------------------------------------------------------------------------
const EX = { exhaust: true }, ST1 = { strain: 1 }, EXST1 = { exhaust: true, strain: 1 },
  EXST2 = { exhaust: true, strain: 2 }, ST2 = { strain: 2 }, DEP = { deplete: true }, NONE = {};
const OVERRIDES = {
    // --- hero: choose-one / cross-side / judgment calls ---
    "Davith Elso|Embody the Force": [
        entry("attack", EX, "", {"attack": {"damage": 1}}),
        entry("defense", EX, "", {"defense": {"block": 1}})],
    "Davith Elso|Covert Operative": [entry("defense", NONE, "discard the Hidden condition", {"defense": {"block": 1}})],
    "Diala Passil|Force Adept": [entry("test", EX, "Strength or Tech test", {"dice": {"attack": {"blue": 1}}})],
    "Diala Passil|Dancing Weapon": [entry("attack", ST1, "action: ranged attack with a melee weapon", {"dice": {"attack": {"blue": 1}}}, ["⚡: +2 Accuracy, +1⊠"])],
    "Drokkatta|Structural Exploitation": [
        entry("attack", EX, "", {"attack": {"damage": 1, "accuracy": 1, "pierce": 1}}, null, "target"),
        entry("attack", EX, "target is an object", {"attack": {"damage": 2, "accuracy": 1, "pierce": 2}}, null, "target")],
    "Fenn Signis|Weapon Expert": [entry("attack", ST1, "", {"attack": {"accuracy": 2, "pierce": 1}})],
    "Gaarkhan|Ferocity": [entry("attack", NONE, "while Focused", {"dice": {"attack": {"red": 1, "green": -1}}}, ["⚡: Cleave 1⊠"])],
    "Gaarkhan|Unstoppable": [entry("attack", NONE, "while wounded", {"attack": {"damage": 2}})],
    "Gideon Argus|Military Efficiency": null,
    "Jarrod Kelvin|Scouts Loadout": null,
    "Jarrod Kelvin|Explosive Reflexes": null,
    "Jyn Odan|Smugglers Luck": null,
    "Jyn Odan|Trick Shot": null,
    "Ko-Tun Feralo|Auxiliary Training": null,
    "Ko-Tun Feralo|Fire Support Specialist": null,
    "Loku Kanoloa|Scouts Guidance": [entry("defense", NONE, "friendly figure with a recon token is defending", {"defense": {"evade": 1}}, null, "", "friendly")],
  "Gideon Argus|Called Shot": [entry("attack", EX, "target in your line of sight", {"attack": {"surge": 1}}, null, "", "any")],
  "Gaarkhan|Wookiee Loyalty": [entry("defense", EX, "you or an adjacent friendly figure", {"defense": {"block": 1}}, null, "", "any")],
  "Ko-Tun Feralo|Dig In": [entry("defense", EXST1, "friendly figure within 2 spaces is defending", {"defense": {"block": 2}}, null, "", "friendly")],
  "MHD-19|Adrenal Vapor": [entry("attack", ST2, "another friendly figure within 2 spaces declares an attack", {"dice": {"attack": {"yellow": 1}}}, ["⚡: Recover 1⊠"], "", "friendly")],
  "Nemeses|Ringleader": [entry("attack", NONE, "adjacent friendly figure is attacking (Ringleader's group is adjacent)", {"attack": {"damage": 1, "accuracy": 1}}, null, "", "friendly")],
    "Loku Kanoloa|Coordinated Attack": [entry("attack", EXST2, "target has a recon token; add 1 die of your choice (use the pool steppers)", null, null, "", "any")],
    "Mak Eshka'rey|Execute": null,
    "Mak Eshka'rey|Decoy": null,
    "Murne Rin|Professional Aide": [
        entry("attack", EX, "another Rebel figure within 3 spaces is attacking", {"attack": {"surge": 1}}, null, "", "friendly"),
        entry("test", EX, "another Rebel figure within 3 spaces is testing", {"attack": {"surge": 1}}, null, "", "friendly")],
    "Murne Rin|Lead from the Front": [
        entry("attack", NONE, "one ready activation token: +1 damage", {"attack": {"damage": 1}}),
        entry("attack", NONE, "one ready activation token: +2 Accuracy", {"attack": {"accuracy": 2}})],
    "Onar Koma|Get Down": [
        entry("defense", EX, "pass a Strength test; you or a friendly figure within 2 spaces", {"defense": {"block": 1}}, null, "test", "any"),
        entry("defense", EX, "pass an Insight test; you or a friendly figure within 2 spaces", {"defense": {"evade": 1}}, null, "test", "any")],
    "Onar Koma|Mutual Destruction": [entry("attack", NONE, "suffer 1 damage", {"attack": {"damage": 1}})],
    "Onar Koma|Stay Behind Me": [entry("defense", NONE, "adjacent friendly figure is defending; you are healthy; suffer 1 damage", {"defense": {"block": 1}}, null, "", "friendly")],
    "Onar Koma|Hold Still": [
        entry("attack", EX, "adjacent hostile figure is defending", {"defense": {"block": -1}}, null, "pick"),
        entry("attack", EX, "adjacent hostile figure is defending", {"defense": {"evade": -1}}, null, "pick")],
    "Saska Teft|Energy Shield": [
        entry("defense", NONE, "discard 1 device token", {"defense": {"block": 1}}),
        entry("defense", NONE, "discard 1 device token", {"defense": {"evade": 1}})],
    "Saska Teft|Structural Weakness": [
        entry("attack", EX, "target is a Droid or Vehicle", {"attack": {"damage": 1}}, null, "target"),
        entry("attack", EX, "target is an object", {"attack": {"damage": 2}}, null, "target")],
    "Saska Teft|Power Converter": null,
    "Shyla Varad|Proximity Strike": null,
    "Shyla Varad|Full Sweep": null,
    "Verena Talos|Create Opening": [
        entry("attack", EXST1, "adjacent hostile figure is defending", {"defense": {"block": -1}}, null, "pick"),
        entry("attack", EXST1, "adjacent hostile figure is defending", {"defense": {"evade": -1}}, null, "pick")],
    "Verena Talos|Point Blank Shot": [entry("attack", NONE, "Pistol, adjacent target; replace 1 attack die with red (use the pool steppers)", {"attack": {"pierce": 1}})],
    "Verena Talos|Master Operative": null,
    "Vinto Hreeda|Pinpoint Shot": [entry("attack", EX, "ranged weapon; remove all results first, then", {"attack": {"damage": 1}})],
    "Vinto Hreeda|Battlefield Experience": null,
    "Vinto Hreeda|Rapid Fire": null,
    // --- imperial ---
    "Armored Onslaught|Explosive Munitions": [entry("attack", EX, "ranged attack; remove 1 attack die first (pool steppers); gains Blast 1", {"dice": {"attack": {"red": 1}}})],
    "Armored Onslaught|Armor Corps": null,
    "Armored Onslaught|Reactive Armor": [entry("defense", NONE, "rolled an Evade on a black die", {"defense": {"block": 2}})],
    "Armored Onslaught|Power to Shields": null,
    "Hutt Mercenaries|Wanted: Dead": [
        entry("attack", EX, "defender has a Bounty token", {"attack": {"damage": 1}}, null, "pick"),
        entry("attack", EX, "defender has a Bounty token", {"attack": {"surge": 1}}, null, "pick")],
    "Hutt Mercenaries|Scouted": null,
    "Hutt Mercenaries|Vendetta": null,
    "Hutt Mercenaries|Nowhere to Run": [
        entry("attack", EX, "target has 3+ strain", {"attack": {"damage": 1}}, null, "who"),
        entry("attack", EX, "target has 3+ strain; attacker is a Mercenary", {"attack": {"damage": 2}}, null, "who")],
    "Hutt Mercenaries|Most Wanted": [
        entry("attack", EX, "a hero is defending", {"attack": {"damage": 2}}, null, "who"),
        entry("attack", EX, "a hero with a Bounty token is defending", {"attack": {"damage": 3}}, null, "who")],
    "Imperial Black Ops|Shadow Armor": [
        entry("defense", EX, "", {"attack": {"damage": -1}}, null, "pick"),
        entry("defense", EX, "", {"attack": {"surge": -1}}, null, "pick"),
        entry("defense", EX, "", {"attack": {"accuracy": -2}}, null, "pick")],
    "Imperial Black Ops|true Shadow": null,
    "Inspiring Leadership|Optimal Tactics": [entry("attack", NONE, "other Imperial figures within 3 spaces of a friendly Leader", {"attack": {"damage": 1}})],
    "Military Might|Assault Armor": null,
    "Military Might|Shock and Awe": [entry("attack", NONE, "discard 1 strain token from this card", {"attack": {"damage": 1}})],
    "Nemeses|Inspirational": [
        entry("attack", EX, "non-villain Imperial sharing a trait with the villain", {"attack": {"surge": 1}}),
        entry("defense", EX, "non-villain Imperial sharing a trait with the villain", {"defense": {"evade": 1}})],
    "Nemeses|Punishing Force": null,
    "Nemeses|Devastating Legion": [
        entry("attack", NONE, "Rebel within 3 spaces of a villain is defending", {"defense": {"block": -1}}, null, "pick"),
        entry("attack", NONE, "Rebel within 3 spaces of a villain is defending", {"defense": {"evade": -1}}, null, "pick")],
    "Power of the Dark Side|Embrace Anger": [entry("attack", EX, "attacker suffers 1 damage", {"attack": {"damage": 1}})],
    "Power of the Dark Side|The Power of Passion": null,
    "Precision Training|Strike Force": null,
    "Precision Training|Pinpoint Accuracy": null,
    "Precision Training|Knowledge of Attack": [entry("defense", EX, "", {"attack": {"surge": -1}})],
    "Precision Training|Versatile Attack": [entry("attack", { exhaust: true, threat: 1 }, "", {"dice": {"attack": {"yellow": 1}}}, ["⚡: Weaken", "⚡: +1⊠", "⚡: Pierce 2"])],
    "Precision Training|Assassins": null,
    "Precision Training|Exacting Strike": [entry("attack", { exhaust: true, threat: 2 }, "remove 1 defense die (pool steppers)")],
    "Precision Training|Single Minded": null,
    "Subversive Tactics|Prey Upon Doubt": [entry("defense", EX, "Rebel attacker chose not to suffer 1 strain", {"defense": {"evade": 1}})],
    "Subversive Tactics|Executioner": [
        entry("attack", { exhaust: true, threat: 1 }, "hero with 1 strain", {"attack": {"damage": 1}}, null, "strain"),
        entry("attack", { exhaust: true, threat: 1 }, "hero with 2 strain", {"attack": {"damage": 2}}, null, "strain"),
        entry("attack", { exhaust: true, threat: 1 }, "hero with 3+ strain", {"attack": {"damage": 3}}, null, "strain")],
    "Reactive Defenses|Targeting Sensors": [
    entry("attack", EX, "", {"attack": {"damage": 1}}),
    entry("attack", NONE, "another Imperial figure within 2 spaces of 88-Z declares an attack", {"attack": {"damage": 1, "accuracy": 1}}, null, "", "friendly")],
  "Technological Superiority|Experimental Arms": [entry("attack", NONE, "suffer 1 damage after the attack", {"attack": {"surge": 1}})],
    "Technological Superiority|Adaptive Weapons": null,
};

function derive(card) {
  const key = `${card.group}|${card.name}`;
  if (key in OVERRIDES) return OVERRIDES[key];
  const m = card.model;
  if (!m || card.shape === "equipment") return null;
  const isDeclared = card.shape === "declared" || String(card.secondary ?? "").includes("declared");
  if (!isDeclared) return null;
  const mod = modFrom(m.bonus, m.dice);
  const surges = m.surges ?? [];
  if (!Object.keys(mod).length && !surges.length) return null; // reroll / convert / text-only
  const whens = { attack: ["attack"], defense: ["defense"], test: ["test"], both: ["attack", "defense"] }[m.when];
  if (!whens) return null;
  return whens.map((w) => entry(w, costOf(m.cost), m.condition ?? "", Object.keys(mod).length ? mod : null, w === "attack" ? surges : null));
}

let changed = 0;
for (const c of cards) {
  const uses = derive(c);
  if (uses && uses.length) { c.use = uses; changed += 1; }
  else delete c.use;
}

// Keep the original formatting (indent 1, trailing newline).
fs.writeFileSync(PATH, JSON.stringify(cards, null, 1) + "\n");
console.log(`${changed} cards carry a use list`);
