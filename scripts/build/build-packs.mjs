#!/usr/bin/env node
/**
 * Compendium generator.
 *
 *   node scripts/build/build-packs.mjs            # write packs/_source/<pack>/*.json
 *   node scripts/build/build-packs.mjs --compile  # …and compile to packs/<pack> (LevelDB) via the Foundry CLI
 *
 * Inputs (all committed, all transcribed from card scans and verified):
 *   docs/class-cards.json          hero + imperial class cards
 *   docs/cards/deployment-cards.json, item-cards.json, agenda-cards.json,
 *   docs/cards/hero-sheets.json, companion-cards.json, form-cards.json
 *   docs/cards/image-index.json    card name → scan filename in the lvisintini dataset
 *
 * Card art is NOT committed: every document's `img` points at
 * systems/swia/assets/cards/<dataset path>. Drop the dataset's images/large/*
 * folders into assets/cards/ (see README) and the art appears; without it the
 * sheets show their placeholder.
 *
 * Output is deterministic: document ids are hashes of pack + name (+ variant),
 * so re-running after a JSON fix updates documents in place.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "packs/_source");
const ART = "systems/swia/assets/cards";
const load = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const id16 = (...parts) => crypto.createHash("sha1").update(parts.join("|")).digest("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 16).padEnd(16, "x");
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Notation → inline system icons (the same convention the sheets and chat cards use). */
const GLYPHS = [
  [/⊠/g, "Damage.png", "Damage"], [/✦/g, "Strain.png", "Strain"], [/⚡/g, "Surge.png", "Surge"],
  [/\[Block\]/g, "Block.png", "Block"], [/\[Evade\]/g, "Evade.png", "Evade"], [/\[Dodge\]/g, "Dodge.png", "Dodge"],
  [/◆/g, "Threat.png", "Threat"], [/⟶/g, "Action.png", "Action"],
  [/\[melee\]/gi, "Melee.png", "Melee"], [/\[ranged\]/gi, "Ranged.png", "Ranged"],
  [/\[Str\]/g, "Might.png", "Strength"], [/\[Ins\]/g, "Insight.png", "Insight"], [/\[Tech\]/g, "Tech.png", "Tech"],
  [/\[damage token\]/gi, "Power Damage Token.png", "Damage token"], [/\[surge token\]/gi, "Power Surge Token.png", "Surge token"],
  [/\[block token\]/gi, "Power Block Token.png", "Block token"], [/\[evade token\]/gi, "Power Evade Token.png", "Evade token"]
];
function iconize(text) {
  let out = esc(text).replace(/\s*\|\s*/g, "<br>");
  for (const [re, file, label] of GLYPHS) {
    out = out.replace(re, `<img class="swia-glyph" src="systems/swia/icons/${file}" alt="${label}" title="${label}" />`);
  }
  return out;
}

/** Structured weapon surge from printed text: "+1⊠" → damage 1, "+2 Accuracy" → accuracy 2, "Pierce 2" → pierce 2, else special. */
function weaponSurge(cost, text) {
  const t = String(text).trim();
  let m;
  if ((m = t.match(/^\+(\d+)\s*⊠\s*$/))) return { cost, effectType: "damage", effectValue: Number(m[1]), effectText: "", exhaustToUse: false };
  if ((m = t.match(/^\+(\d+)\s*Accuracy\s*$/i))) return { cost, effectType: "accuracy", effectValue: Number(m[1]), effectText: "", exhaustToUse: false };
  if ((m = t.match(/^Pierce\s*(\d+)\s*$/i))) return { cost, effectType: "pierce", effectValue: Number(m[1]), effectText: "", exhaustToUse: false };
  return { cost, effectType: "special", effectValue: 0, effectText: iconize(t), exhaustToUse: false };
}
const actorSurge = (cost, text) => ({ cost, effectText: iconize(text) });

/** Keyword line → {accuracy, pierce, blast, cleave, reach, rest[]} */
function parseKeywords(list) {
  const out = { accuracy: 0, pierce: 0, blast: 0, cleave: false, reach: false, rest: [] };
  for (const k of list ?? []) {
    let m;
    if ((m = k.match(/^\+(\d+)\s*Accuracy$/i))) out.accuracy += Number(m[1]);
    else if ((m = k.match(/^Pierce\s*(\d+)$/i))) out.pierce += Number(m[1]);
    else if ((m = k.match(/^Blast\s*(\d+)/i))) out.blast += Number(m[1]);
    else if (/^Cleave/i.test(k)) out.cleave = true;
    else if (/^Reach$/i.test(k)) out.reach = true;
    else out.rest.push(k);
  }
  return out;
}
const abilityRows = (text) => String(text ?? "").split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean).map((description) => ({ prefix: "none", description: iconize(description) }));
const diceOf = (d) => ({ red: d?.red ?? 0, blue: d?.blue ?? 0, green: d?.green ?? 0, yellow: d?.yellow ?? 0 });

/* ------------------------------------------------------------------ */
/* Image index                                                         */
/* ------------------------------------------------------------------ */

const IMG = load("docs/cards/image-index.json");
const imgLookup = (family, pred) => { const hit = IMG[family].find(pred); return hit ? `${ART}/${hit.image}` : ""; };

/* ------------------------------------------------------------------ */
/* Pack + folder plumbing                                              */
/* ------------------------------------------------------------------ */

class Pack {
  constructor(name, label, type) { Object.assign(this, { name, label, type, docs: [], folders: new Map() }); }
  folder(fname, parent = null) {
    const key = `${parent ?? ""}/${fname}`;
    if (!this.folders.has(key)) {
      const _id = id16(this.name, "folder", key);
      this.folders.set(key, { _id, name: fname, type: this.type, folder: parent, sorting: "a", sort: this.folders.size * 1000, color: null, flags: {}, _key: `!folders!${_id}` });
    }
    return this.folders.get(key)._id;
  }
  add(doc, folderId = null, sort = 0) {
    doc.folder = folderId; doc.sort = sort;
    doc._key = `!${this.type === "Actor" ? "actors" : "items"}!${doc._id}`;
    this.docs.push(doc);
  }
  write() {
    const dir = path.join(SRC, this.name);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (const f of this.folders.values()) fs.writeFileSync(path.join(dir, `folder__${f._id}.json`), JSON.stringify(f, null, 2));
    for (const d of this.docs) fs.writeFileSync(path.join(dir, `${slug(d.name)}__${d._id}.json`), JSON.stringify(d, null, 2));
    return { name: this.name, docs: this.docs.length, folders: this.folders.size };
  }
}
const slug = (s) => norm(s).slice(0, 40) || "doc";

function item(pack, name, type, system, { img = "", flags = {}, variant = "" } = {}) {
  const _id = id16(pack, type, name, variant);
  return { _id, name, type, img: img || `systems/swia/icons/Holocron.png`, system, effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: { swia: flags }, _stats: {} };
}
function actor(pack, name, type, system, { img = "", flags = {}, variant = "", items = [], linked = false } = {}) {
  const _id = id16(pack, type, name, variant);
  return {
    _id, name, type, img: img || "icons/svg/mystery-man.svg", system, items, effects: [],
    prototypeToken: { name, actorLink: linked, displayName: 20, displayBars: 40, disposition: type === "ally" ? 1 : -1,
      texture: { src: img || "icons/svg/mystery-man.svg" }, bar1: { attribute: "attributes.health" } },
    folder: null, sort: 0, ownership: { default: 0 }, flags: { swia: flags }, _stats: {}
  };
}

/* ------------------------------------------------------------------ */
/* Equipment builders (shared by item deck, class cards, hero starters) */
/* ------------------------------------------------------------------ */

const traitsOf = (t) => Array.isArray(t) ? t : String(t ?? "").split(/\s*[-,]\s*/).filter(Boolean);

function buildWeapon(pack, c, { img, flags, cost = 0 }) {
  const kw = parseKeywords(c.keywords);
  const traits = traitsOf(c.traits);
  const type = c.attack?.type || (/(Ranged|Blaster|Pistol|Rifle)/i.test(c.type ?? "") ? "ranged" : "melee");
  const sys = {
    description: "", cost, cardState: "ready",
    weaponClass: traits[0] ?? "", weaponSubtype: traits[1] ?? "",
    attackDice: diceOf(c.attack?.dice), poolAttribute: "", damage: 0,
    accuracy: kw.accuracy, range: type,
    keywords: { pierce: kw.pierce, blast: kw.blast, cleave: kw.cleave, reach: kw.reach },
    surgeAbilities: (c.surgeAbilities ?? []).map((s) => weaponSurge(s.cost, s.text)),
    exhaustAbilities: [],
    abilities: [...kw.rest.map((k) => ({ prefix: "none", description: iconize(k) })), ...abilityRows(c.text)],
    attachmentSlots: c.modSlots ?? 0, traits: traits.join(" - "),
    imageOffsetX: 50, imageOffsetY: 50, imageZoom: 1
  };
  return item(pack, c.name, "weapon", sys, { img, flags });
}
function buildArmor(pack, c, { img, flags, cost = 0 }) {
  const traits = traitsOf(c.traits);
  const kw = parseKeywords(c.keywords);
  const a = c.armor ?? {};
  // "+1 [Block]" may arrive as a keyword rather than in `armor`
  let block = a.block ?? 0, evade = a.evade ?? 0, health = a.health ?? 0;
  for (const k of kw.rest) { let m; if ((m = k.match(/^\+(\d+)\s*\[Block\]/))) block += +m[1]; else if ((m = k.match(/^\+(\d+)\s*\[Evade\]/))) evade += +m[1]; else if ((m = k.match(/^\+(\d+)\s*Health/))) health += +m[1]; }
  const sys = {
    description: "", cost, cardState: "ready", armorClass: "", traits: traits.join(" - "),
    bonusHealth: health, bonusBlock: block, bonusEvade: evade,
    abilities: [...kw.rest.filter((k) => !/^\+\d+\s*(\[Block\]|\[Evade\]|Health)/.test(k)).map((k) => ({ prefix: "none", description: iconize(k) })), ...abilityRows(c.text)],
    equipped: false, imageOffsetX: 50, imageOffsetY: 50, imageZoom: 1
  };
  return item(pack, c.name, "armor", sys, { img, flags });
}
function buildMod(pack, c, { img, flags, cost = 0 }) {
  const traits = traitsOf(c.traits);
  const kw = parseKeywords(c.keywords);
  let bonusDamage = 0; const rest = [];
  for (const k of kw.rest) { let m; if ((m = k.match(/^\+(\d+)\s*⊠$/))) bonusDamage += +m[1]; else rest.push(k); }
  const sys = {
    description: [...rest, ...String(c.text ?? "").split(/\s*\|\s*/)].filter(Boolean).map(iconize).join("<br>"),
    cost, cardState: "ready",
    modCompatType: /Melee/i.test(c.type ?? "") || /saber/i.test(c.notes ?? "") ? "melee" : "ranged",
    modSubtype: traits.find((t) => t !== "Modification") ?? "",
    attachedWeaponId: "", bonusDice: diceOf(c.dice?.add), bonusDamage, bonusAccuracy: kw.accuracy,
    surgeAbilities: (c.surgeAbilities ?? []).map((s) => weaponSurge(s.cost, s.text)),
    keywords: { pierce: kw.pierce, blast: kw.blast, cleave: kw.cleave, reach: kw.reach }
  };
  return item(pack, c.name, "weaponmod", sys, { img, flags });
}
function buildGear(pack, c, { img, flags, cost = 0 }) {
  const traits = traitsOf(c.traits);
  const sys = { description: [...(c.keywords ?? []), ...String(c.text ?? "").split(/\s*\|\s*/)].filter(Boolean).map(iconize).join("<br>"), cost, cardState: "ready", accessorySubtype: traits.find((t) => t !== "Accessory" && t !== "Equipment") ?? "" };
  return item(pack, c.name, "gear", sys, { img, flags });
}
const EQUIP = { weapon: buildWeapon, armor: buildArmor, weaponmod: buildMod, gear: buildGear };

/** Class-card equipment is free text: "Attack: [ranged] blue + red. Traits: Blaster - Heavy. ⚡: +1 Accuracy. +4 Health. …" */
function parseClassEquipment(c) {
  const t = c.text; const out = { name: c.name, type: c.type, traits: [], keywords: [], surgeAbilities: [], attack: { type: "", dice: {} }, armor: { health: 0, block: 0, evade: 0 }, modSlots: 0, text: "" };
  let m;
  // "Attack: [ranged] blue + red." | "Attack: blue + green [ranged]." | "Attack: blue + blue." (type from the card's type field)
  if ((m = t.match(/Attack:\s*(?:\[(melee|ranged)\]\s*)?([a-z +]+?)\s*(?:\[(melee|ranged)\])?\s*\./i))) {
    out.attack.type = (m[1] || m[3] || (/Ranged/i.test(c.type) ? "ranged" : "melee")).toLowerCase();
    for (const col of m[2].split("+").map((s) => s.trim()).filter(Boolean)) out.attack.dice[col] = (out.attack.dice[col] ?? 0) + 1;
  }
  if ((m = t.match(/Traits:\s*([^.]+)\./))) out.traits = m[1].split(/\s*-\s*/).map((s) => s.trim());
  const rest = [];
  for (const sentence of t.replace(/Attack:[^.]*\./i, "").replace(/Traits:[^.]*\./, "").split(/(?<=[.!])\s+/).map((s) => s.trim()).filter(Boolean)) {
    let s = sentence.replace(/\.$/, "");
    if ((m = s.match(/^((?:⚡\s*)+):\s*(.+)$/))) out.surgeAbilities.push({ cost: (m[1].match(/⚡/g) || []).length, text: m[2] });
    else if ((m = s.match(/^\+(\d+)\s*Health$/i))) out.armor.health += +m[1];
    else if (/^(\+\d+\s*(Accuracy|\[Block\]|\[Evade\])|Pierce \d+|Blast \d+|Cleave|Reach)$/i.test(s)) out.keywords.push(s);
    else rest.push(sentence);
  }
  out.text = rest.join(" ");
  return out;
}
function classKind(c) {
  if (/Modification/i.test(c.type)) return "weaponmod";
  if (/Weapon/i.test(c.type)) return "weapon";
  if (/Armor/i.test(c.type)) return "armor";
  return "gear";
}

/* ------------------------------------------------------------------ */
/* Packs                                                               */
/* ------------------------------------------------------------------ */

const packs = [];
const summary = [];

// --- Class cards (hero) ------------------------------------------------
{
  const P = new Pack("class-cards", "Class Cards (Hero)", "Item"); packs.push(P);
  const cards = load("docs/class-cards.json").filter((c) => c.kind === "hero");
  for (const c of cards) {
    const fid = P.folder(c.group);
    const img = imgLookup("hero-class-cards", (x) => x.hero === c.group && norm(x.name) === norm(c.name));
    const flags = { classXp: c.xp, heroClass: c.group, shape: c.shape, source: "hero-class-cards" };
    let doc;
    if (c.shape === "equipment") {
      const parsed = parseClassEquipment(c);
      doc = EQUIP[classKind(c)]("class-cards", parsed, { img, flags });
    } else {
      doc = item("class-cards", c.name, "classcard", { description: "", cost: 0, cardState: "ready", cooldown: 0, xpCost: c.xp ?? 0, heroClass: c.group, abilityText: iconize(c.text) }, { img, flags });
    }
    P.add(doc, fid, (c.xp ?? 0) * 100);
  }
}

// --- Imperial class cards ----------------------------------------------
{
  const P = new Pack("imperial-class-cards", "Class Cards (Imperial)", "Item"); packs.push(P);
  for (const c of load("docs/class-cards.json").filter((c) => c.kind === "imperial")) {
    const fid = P.folder(c.group);
    const img = imgLookup("imperial-class-cards", (x) => x.class === c.group && norm(x.name) === norm(c.name));
    const doc = item("imperial-class-cards", c.name, "imperialclasscard", { description: iconize(c.text), cost: c.xp ?? 0, cardState: "ready", cooldown: 0 }, { img, flags: { classXp: c.xp, imperialClass: c.group, shape: c.shape, source: "imperial-class-cards" } });
    P.add(doc, fid, (c.xp ?? 0) * 100);
  }
}

// --- Item deck + supply + rewards + form cards -------------------------
{
  const P = new Pack("items", "Items, Supply & Rewards", "Item"); packs.push(P);
  const items = load("docs/cards/item-cards.json");
  for (const c of items) {
    const family = c.family;
    const fam = `${family}-cards`;
    const img = imgLookup(fam, (x) => x.id === c.id) || imgLookup(fam, (x) => norm(x.name) === norm(c.name));
    const flags = { source: fam, tier: c.tier ?? null, credits: c.credits ?? null, shape: c.shape ?? "equipment" };
    let fid;
    if (family === "upgrade") fid = P.folder(`Tier ${c.tier}`, P.folder("Item Deck"));
    else if (family === "supply") fid = P.folder("Supply");
    else fid = P.folder("Rewards");
    let doc;
    if (c.kind === "feat") {
      doc = item("items", c.name, "heroability", { description: "", cost: 0, cardState: "ready", abilityText: iconize([...(c.keywords ?? []), c.text].filter(Boolean).join(" | ")) }, { img, flags });
    } else {
      doc = EQUIP[c.kind]("items", c, { img, flags, cost: c.credits ?? 0 });
    }
    P.add(doc, fid, (c.credits ?? 0));
  }
  const ff = P.folder("Form Cards");
  for (const c of load("docs/cards/form-cards.json")) {
    const img = imgLookup("form-cards", (x) => x.id === c.id);
    const doc = item("items", c.name, "formcard", {
      description: iconize(c.text ?? ""), cost: 0, cardState: "ready",
      surgeAbilities: (c.surgeAbilities ?? []).map((s) => actorSurge(s.cost, s.text)),
      specialAbilities: (c.abilities ?? []).map((a) => ({ name: a.name ?? "", description: iconize(a.text), surgeCost: 0 }))
    }, { img, flags: { source: "form-cards" } });
    P.add(doc, ff);
  }
}

// --- Agendas -------------------------------------------------------------
{
  const P = new Pack("agendas", "Agenda Cards", "Item"); packs.push(P);
  for (const c of load("docs/cards/agenda-cards.json")) {
    const fid = P.folder(c.deck || "Unknown deck");
    const img = imgLookup("agenda-cards", (x) => x.id === c.id);
    const doc = item("agendas", c.name, "agendacard", { description: iconize(c.text ?? ""), cost: 0, cardState: "ready", cooldown: 0, influenceCost: c.influence ?? 0, agendaType: c.timing ?? "", missionEffect: c.mission ? "Mission" : "" }, { img, flags: { source: "agenda-cards", mission: Boolean(c.mission), deck: c.deck } });
    P.add(doc, fid, (c.influence ?? 0) * 100);
  }
}

// --- Deployment groups → villain / ally actors ---------------------------
{
  const P = new Pack("deployment", "Deployment Groups", "Actor"); packs.push(P);
  for (const c of load("docs/cards/deployment-cards.json")) {
    if (c.kind !== "figure") continue;
    const type = c.affiliation === "Rebel" ? "ally" : "villain";
    const fid = P.folder(c.elite ? "Elite" : "Regular", P.folder(c.affiliation));
    const img = imgLookup("deployment-cards", (x) => x.id === c.id);
    const kw = parseKeywords(c.keywords);
    const special = [
      ...kw.rest.map((k) => ({ name: "", description: iconize(k), surgeCost: 0 })),
      ...(kw.accuracy ? [{ name: "", description: `+${kw.accuracy} Accuracy`, surgeCost: 0 }] : []),
      ...(kw.pierce ? [{ name: "", description: `Pierce ${kw.pierce}`, surgeCost: 0 }] : []),
      ...(c.abilities ?? []).map((a) => ({ name: a.name ?? "", description: iconize(a.text), surgeCost: 0 }))
    ];
    const sys = {
      biography: c.description ? `<p><em>${esc(c.description)}</em></p>` : "",
      attributes: {
        health: { value: c.health ?? 0, max: c.health ?? 0 }, speed: c.speed ?? 0,
        defense: { black: c.defense?.black ?? 0, white: c.defense?.white ?? 0 },
        attackType: c.attack?.type || "ranged", attack: diceOf(c.attack?.dice), surge: 0,
        surgeAbilities: (c.surgeAbilities ?? []).map((s) => actorSurge(s.cost, s.text))
      },
      groupSize: c.figures ?? c.deployment_group ?? 1, isElite: Boolean(c.elite), isUnique: Boolean(c.unique),
      affiliation: c.affiliation, deployCost: c.deployment_cost ?? 0, traits: (c.traits ?? []).join(", "),
      reinforceCost: c.reinforce_cost ?? 0, reward: "", specialAbilities: special, state: { activated: false }
    };
    if (type === "villain") Object.assign(sys, { hasShift: false, activeFormId: "" });
    else Object.assign(sys, { companionOf: "" });
    const variant = c.elite ? "elite" : "regular";
    const name = c.elite ? `${c.name} (Elite)` : c.name;
    const doc = actor("deployment", name, type, sys, { img, variant, linked: Boolean(c.unique), flags: { source: "deployment-cards", modes: c.modes, notes: c.notes ?? "" } });
    P.add(doc, fid, (c.deployment_cost ?? 0) * 100);
  }
}

// --- Heroes (with starting class-deck equipment embedded) ----------------
{
  const P = new Pack("heroes", "Heroes", "Actor"); packs.push(P);
  const classCards = load("docs/class-cards.json").filter((c) => c.kind === "hero");
  const side = (s) => ({
    health: { value: s.health, max: s.health }, endurance: { value: s.endurance, max: s.endurance }, speed: s.speed,
    strength: diceOf(s.strength), insight: diceOf(s.insight), tech: diceOf(s.tech)
  });
  const abil = (list) => (list ?? []).map((a) => ({ name: a.name ?? "", description: iconize(a.text), sourceUuid: "" }));
  for (const h of load("docs/cards/hero-sheets.json")) {
    const art = IMG.heroes.find((x) => norm(x.name) === norm(h.name)) ?? {};
    const healthy = side(h.healthy), wounded = side(h.wounded);
    const sys = {
      biography: "", title: h.title ?? "", archetype: "", affiliation: "Rebel", xp: 0,
      woundedTokenImage: art.wounded ? `${ART}/${art.wounded}` : "", healthyTokenImage: "", woundedBiography: "",
      heroAbilities: abil(h.healthy.abilities), woundedHeroAbilities: abil(h.wounded.abilities),
      attributes: { ...healthy, defense: { black: h.healthy.defense?.black ?? 0, white: h.healthy.defense?.white ?? 0 }, surge: 1, threat: 0 },
      woundedAttributes: { ...wounded },
      state: { wounded: false, activated: false, defeated: false }
    };
    // Starting class cards (no XP cost) travel with the hero.
    const starters = classCards.filter((c) => c.group === h.name && c.xp == null);
    const items = starters.map((c) => {
      const img = imgLookup("hero-class-cards", (x) => x.hero === c.group && norm(x.name) === norm(c.name));
      const flags = { classXp: null, heroClass: c.group, shape: c.shape, source: "hero-class-cards" };
      const doc = c.shape === "equipment"
        ? EQUIP[classKind(c)]("heroes", parseClassEquipment(c), { img, flags })
        : item("heroes", c.name, "classcard", { description: "", cost: 0, cardState: "ready", cooldown: 0, xpCost: 0, heroClass: c.group, abilityText: iconize(c.text) }, { img, flags });
      delete doc.folder; delete doc.sort;
      return doc;
    });
    const doc = actor("heroes", h.name, "hero", sys, { img: art.healthy ? `${ART}/${art.healthy}` : "", items, linked: true, flags: { source: "hero-sheets" } });
    for (const it of doc.items) it._key = `!actors.items!${doc._id}.${it._id}`;
    doc.prototypeToken.disposition = 1;
    P.add(doc, null, 0);
  }
  // Companions live here too (they are ally actors with companionOf blank).
  const cf = P.folder("Companions");
  for (const c of load("docs/cards/companion-cards.json")) {
    const img = imgLookup("companion-cards", (x) => x.id === c.id);
    const kw = parseKeywords(c.keywords);
    const sys = {
      biography: "", attributes: {
        health: { value: c.health ?? 0, max: c.health ?? 0 }, speed: c.speed ?? 0,
        defense: { black: c.defense?.black ?? 0, white: c.defense?.white ?? 0 },
        attackType: c.attack?.type || "ranged", attack: diceOf(c.attack?.dice), surge: 0,
        surgeAbilities: (c.surgeAbilities ?? []).map((s) => actorSurge(s.cost, s.text))
      },
      groupSize: 1, isElite: false, isUnique: true, affiliation: "Rebel", deployCost: 0, traits: (c.traits ?? []).join(", "),
      reinforceCost: 0, reward: "", companionOf: "",
      specialAbilities: [...kw.rest.map((k) => ({ name: "", description: iconize(k), surgeCost: 0 })), ...(c.abilities ?? []).map((a) => ({ name: a.name ?? "", description: iconize(a.text), surgeCost: 0 }))],
      state: { activated: false }
    };
    const doc = actor("heroes", c.name, "ally", sys, { img, linked: true, flags: { source: "companion-cards", companion: true } });
    P.add(doc, cf);
  }
}

/* ------------------------------------------------------------------ */
/* Write + optional compile                                            */
/* ------------------------------------------------------------------ */

fs.mkdirSync(SRC, { recursive: true });
for (const p of packs) summary.push(p.write());
console.table(summary);

const manifest = packs.map((p) => ({ name: p.name, label: p.label, path: `packs/${p.name}`, type: p.type, system: "swia", ownership: { PLAYER: "OBSERVER", ASSISTANT: "OWNER" } }));
fs.writeFileSync(path.join(SRC, "packs.manifest.json"), JSON.stringify(manifest, null, 2));

if (process.argv.includes("--compile")) {
  const { compilePack } = await import("@foundryvtt/foundryvtt-cli");
  for (const p of packs) {
    const dest = path.join(ROOT, "packs", p.name);
    fs.rmSync(dest, { recursive: true, force: true });
    await compilePack(path.join(SRC, p.name), dest, { log: false });
    console.log(`compiled packs/${p.name}`);
  }
}
