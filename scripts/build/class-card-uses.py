#!/usr/bin/env python3
"""Derive the `use` list (declared, costed roll effects) for each class card in
docs/class-cards.json from its survey `model`, with explicit overrides where
the model's flat bonus/dice needs a judgment call (choose-one cards, effects
that land on the other side, cards with no buildable effect).

Run:  python3 scripts/build/class-card-uses.py
Rewrites docs/class-cards.json in place (adds/replaces the `use` key; every
other field is left byte-identical). Cards that get no `use` have the key
removed. Reroll / swap / convert-only cards get nothing on purpose: rerolls
are already free until a surge spend, and the rest is table adjudication.

A `use` entry:
  when     attack | defense | test
  note     printed condition, shown on the button (never enforced)
  choice   entries sharing a non-empty choice are mutually exclusive
  cost     { exhaust, strain, deplete }
  modifier sparse modifier (attack / defense / dice) — attack shifts land on
           the attacker's layer and defense shifts on the defender's,
           whichever side declared the card
  surges   printed surge lines granted for this attack ("⚡: +2⊠")
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "docs/class-cards.json"
cards = json.load(open(PATH, encoding="utf-8"))

DICE = {"red", "blue", "green", "yellow", "black", "white"}

def cost_of(text):
    t = (text or "none").lower()
    out = {}
    if "exhaust" in t: out["exhaust"] = True
    if "deplete" in t: out["deplete"] = True
    m = re.search(r"strain\s*(\d+)", t)
    if m: out["strain"] = int(m.group(1))
    return out

def dice_of(model_dice):
    """{'add': [...], 'remove': [...]} → sparse modifier.dice, or None when a
    named colour isn't the whole story (the note carries it)."""
    out = {"attack": {}, "defense": {}}
    for sign, key in ((1, "add"), (-1, "remove")):
        for entry in model_dice.get(key, []):
            colour = entry.split()[0].lower().strip("(,)")
            if colour not in DICE:
                return None
            side = "defense" if colour in ("black", "white") else "attack"
            out[side][colour] = out[side].get(colour, 0) + sign
    return {k: v for k, v in out.items() if v}

def mod_from(bonus, dice):
    mod = {}
    attack = {k: v for k, v in (bonus or {}).items() if k in ("damage", "surge", "accuracy", "pierce") and v}
    defense = {k: v for k, v in (bonus or {}).items() if k in ("block", "evade") and v}
    if attack: mod["attack"] = attack
    if defense: mod["defense"] = defense
    d = dice_of(dice or {}) if dice else {}
    if d: mod["dice"] = d
    return mod

def entry(when, cost, note="", modifier=None, surges=None, choice=""):
    e = {"when": when, "cost": cost, "note": note}
    if choice: e["choice"] = choice
    if modifier: e["modifier"] = modifier
    if surges: e["surges"] = list(surges)
    return e

# ---------------------------------------------------------------------------
# Overrides, keyed by (group, name). None = no use (text only).
# A list = the exact use entries.
# ---------------------------------------------------------------------------
EX, ST1, EXST1, EXST2, ST2, DEP, NONE = ({"exhaust": True}, {"strain": 1}, {"exhaust": True, "strain": 1},
                                          {"exhaust": True, "strain": 2}, {"strain": 2}, {"deplete": True}, {})
OVERRIDES = {
    # --- hero: choose-one / cross-side / judgment calls ---
    ("Davith Elso", "Embody the Force"): [
        entry("attack", EX, "", {"attack": {"damage": 1}}),
        entry("defense", EX, "", {"defense": {"block": 1}})],
    ("Davith Elso", "Covert Operative"): [entry("defense", NONE, "discard the Hidden condition", {"defense": {"block": 1}})],
    ("Diala Passil", "Force Adept"): [entry("test", EX, "Strength or Tech test", {"dice": {"attack": {"blue": 1}}})],
    ("Diala Passil", "Dancing Weapon"): [entry("attack", ST1, "action: ranged attack with a melee weapon", {"dice": {"attack": {"blue": 1}}}, ["⚡: +2 Accuracy, +1⊠"])],
    ("Drokkatta", "Structural Exploitation"): [
        entry("attack", EX, "", {"attack": {"damage": 1, "accuracy": 1, "pierce": 1}}, choice="target"),
        entry("attack", EX, "target is an object", {"attack": {"damage": 2, "accuracy": 1, "pierce": 2}}, choice="target")],
    ("Fenn Signis", "Weapon Expert"): [entry("attack", ST1, "", {"attack": {"accuracy": 2, "pierce": 1}})],
    ("Gaarkhan", "Ferocity"): [entry("attack", NONE, "while Focused", {"dice": {"attack": {"red": 1, "green": -1}}}, ["⚡: Cleave 1⊠"])],
    ("Gaarkhan", "Unstoppable"): [entry("attack", NONE, "while wounded", {"attack": {"damage": 2}})],
    ("Gideon Argus", "Military Efficiency"): None,
    ("Jarrod Kelvin", "Scouts Loadout"): None,
    ("Jarrod Kelvin", "Explosive Reflexes"): None,
    ("Jyn Odan", "Smugglers Luck"): None,
    ("Jyn Odan", "Trick Shot"): None,
    ("Ko-Tun Feralo", "Auxiliary Training"): None,
    ("Ko-Tun Feralo", "Fire Support Specialist"): None,
    ("Loku Kanoloa", "Scouts Guidance"): [entry("defense", NONE, "friendly figure with a recon token is defending", {"defense": {"evade": 1}})],
    ("Loku Kanoloa", "Coordinated Attack"): [entry("attack", EXST2, "target has a recon token; add 1 die of your choice (use the pool steppers)")],
    ("Mak Eshka'rey", "Execute"): None,
    ("Mak Eshka'rey", "Decoy"): None,
    ("Murne Rin", "Professional Aide"): [
        entry("attack", EX, "another Rebel figure within 3 spaces is attacking", {"attack": {"surge": 1}}),
        entry("test", EX, "another Rebel figure within 3 spaces is testing", {"attack": {"surge": 1}})],
    ("Murne Rin", "Lead from the Front"): [
        entry("attack", NONE, "one ready activation token: +1 damage", {"attack": {"damage": 1}}),
        entry("attack", NONE, "one ready activation token: +2 Accuracy", {"attack": {"accuracy": 2}})],
    ("Onar Koma", "Get Down"): [
        entry("defense", EX, "pass a Strength test", {"defense": {"block": 1}}, choice="test"),
        entry("defense", EX, "pass an Insight test", {"defense": {"evade": 1}}, choice="test")],
    ("Onar Koma", "Mutual Destruction"): [entry("attack", NONE, "suffer 1 damage", {"attack": {"damage": 1}})],
    ("Onar Koma", "Stay Behind Me"): [entry("defense", NONE, "adjacent friendly figure is defending; you are healthy; suffer 1 damage", {"defense": {"block": 1}})],
    ("Onar Koma", "Hold Still"): [
        entry("attack", EX, "adjacent hostile figure is defending", {"defense": {"block": -1}}, choice="pick"),
        entry("attack", EX, "adjacent hostile figure is defending", {"defense": {"evade": -1}}, choice="pick")],
    ("Saska Teft", "Energy Shield"): [
        entry("defense", NONE, "discard 1 device token", {"defense": {"block": 1}}),
        entry("defense", NONE, "discard 1 device token", {"defense": {"evade": 1}})],
    ("Saska Teft", "Structural Weakness"): [
        entry("attack", EX, "target is a Droid or Vehicle", {"attack": {"damage": 1}}, choice="target"),
        entry("attack", EX, "target is an object", {"attack": {"damage": 2}}, choice="target")],
    ("Saska Teft", "Power Converter"): None,
    ("Shyla Varad", "Proximity Strike"): None,
    ("Shyla Varad", "Full Sweep"): None,
    ("Verena Talos", "Create Opening"): [
        entry("attack", EXST1, "adjacent hostile figure is defending", {"defense": {"block": -1}}, choice="pick"),
        entry("attack", EXST1, "adjacent hostile figure is defending", {"defense": {"evade": -1}}, choice="pick")],
    ("Verena Talos", "Point Blank Shot"): [entry("attack", NONE, "Pistol, adjacent target; replace 1 attack die with red (use the pool steppers)", {"attack": {"pierce": 1}})],
    ("Verena Talos", "Master Operative"): None,
    ("Vinto Hreeda", "Pinpoint Shot"): [entry("attack", EX, "ranged weapon; remove all results first, then", {"attack": {"damage": 1}})],
    ("Vinto Hreeda", "Battlefield Experience"): None,
    ("Vinto Hreeda", "Rapid Fire"): None,
    # --- imperial ---
    ("Armored Onslaught", "Explosive Munitions"): [entry("attack", EX, "ranged attack; remove 1 attack die first (pool steppers); gains Blast 1", {"dice": {"attack": {"red": 1}}})],
    ("Armored Onslaught", "Armor Corps"): None,
    ("Armored Onslaught", "Reactive Armor"): [entry("defense", NONE, "rolled an Evade on a black die", {"defense": {"block": 2}})],
    ("Armored Onslaught", "Power to Shields"): None,
    ("Hutt Mercenaries", "Wanted: Dead"): [
        entry("attack", EX, "defender has a Bounty token", {"attack": {"damage": 1}}, choice="pick"),
        entry("attack", EX, "defender has a Bounty token", {"attack": {"surge": 1}}, choice="pick")],
    ("Hutt Mercenaries", "Scouted"): None,
    ("Hutt Mercenaries", "Vendetta"): None,
    ("Hutt Mercenaries", "Nowhere to Run"): [
        entry("attack", EX, "target has 3+ strain", {"attack": {"damage": 1}}, choice="who"),
        entry("attack", EX, "target has 3+ strain; attacker is a Mercenary", {"attack": {"damage": 2}}, choice="who")],
    ("Hutt Mercenaries", "Most Wanted"): [
        entry("attack", EX, "a hero is defending", {"attack": {"damage": 2}}, choice="who"),
        entry("attack", EX, "a hero with a Bounty token is defending", {"attack": {"damage": 3}}, choice="who")],
    ("Imperial Black Ops", "Shadow Armor"): [
        entry("defense", EX, "", {"attack": {"damage": -1}}, choice="pick"),
        entry("defense", EX, "", {"attack": {"surge": -1}}, choice="pick"),
        entry("defense", EX, "", {"attack": {"accuracy": -2}}, choice="pick")],
    ("Imperial Black Ops", "True Shadow"): None,
    ("Inspiring Leadership", "Optimal Tactics"): [entry("attack", NONE, "other Imperial figures within 3 spaces of a friendly Leader", {"attack": {"damage": 1}})],
    ("Military Might", "Assault Armor"): None,
    ("Military Might", "Shock and Awe"): [entry("attack", NONE, "discard 1 strain token from this card", {"attack": {"damage": 1}})],
    ("Nemeses", "Inspirational"): [
        entry("attack", EX, "non-villain Imperial sharing a trait with the villain", {"attack": {"surge": 1}}),
        entry("defense", EX, "non-villain Imperial sharing a trait with the villain", {"defense": {"evade": 1}})],
    ("Nemeses", "Punishing Force"): None,
    ("Nemeses", "Devastating Legion"): [
        entry("attack", NONE, "Rebel within 3 spaces of a villain is defending", {"defense": {"block": -1}}, choice="pick"),
        entry("attack", NONE, "Rebel within 3 spaces of a villain is defending", {"defense": {"evade": -1}}, choice="pick")],
    ("Power of the Dark Side", "Embrace Anger"): [entry("attack", EX, "attacker suffers 1 damage", {"attack": {"damage": 1}})],
    ("Power of the Dark Side", "The Power of Passion"): None,
    ("Precision Training", "Strike Force"): None,
    ("Precision Training", "Pinpoint Accuracy"): None,
    ("Precision Training", "Knowledge of Attack"): [entry("defense", EX, "", {"attack": {"surge": -1}})],
    ("Precision Training", "Versatile Attack"): [entry("attack", EX, "costs 1 threat", {"dice": {"attack": {"yellow": 1}}}, ["⚡: Weaken", "⚡: +1⊠", "⚡: Pierce 2"])],
    ("Precision Training", "Assassins"): None,
    ("Precision Training", "Exacting Strike"): [entry("attack", EX, "costs 2 threat; remove 1 defense die (pool steppers)")],
    ("Precision Training", "Single Minded"): None,
    ("Subversive Tactics", "Prey Upon Doubt"): [entry("defense", EX, "Rebel attacker chose not to suffer 1 strain", {"defense": {"evade": 1}})],
    ("Subversive Tactics", "Executioner"): [
        entry("attack", EX, "costs 1 threat; hero with 1 strain", {"attack": {"damage": 1}}, choice="strain"),
        entry("attack", EX, "costs 1 threat; hero with 2 strain", {"attack": {"damage": 2}}, choice="strain"),
        entry("attack", EX, "costs 1 threat; hero with 3+ strain", {"attack": {"damage": 3}}, choice="strain")],
    ("Technological Superiority", "Experimental Arms"): [entry("attack", NONE, "suffer 1 damage after the attack", {"attack": {"surge": 1}})],
    ("Technological Superiority", "Adaptive Weapons"): None,
}

def derive(card):
    key = (card["group"], card["name"])
    if key in OVERRIDES:
        return OVERRIDES[key]
    m = card.get("model")
    if not m or card["shape"] == "equipment":
        return None
    is_declared = card["shape"] == "declared" or "declared" in (card.get("secondary") or "")
    if not is_declared:
        return None
    mod = mod_from(m.get("bonus"), m.get("dice"))
    surges = m.get("surges") or []
    if not mod and not surges:
        return None  # reroll / convert / text-only
    when = m.get("when")
    whens = {"attack": ["attack"], "defense": ["defense"], "test": ["test"], "both": ["attack", "defense"]}.get(when)
    if not whens:
        return None
    uses = []
    for w in whens:
        uses.append(entry(w, cost_of(m.get("cost")), m.get("condition") or "", mod or None, surges if w == "attack" else None))
    return uses

changed = 0
for c in cards:
    uses = derive(c)
    if uses:
        c["use"] = uses; changed += 1
    else:
        c.pop("use", None)

# keep the original formatting (indent=1, trailing newline)
out = json.dumps(cards, ensure_ascii=False, indent=1) + "\n"
open(PATH, "w", encoding="utf-8").write(out)
print(f"{changed} cards carry a use list")
