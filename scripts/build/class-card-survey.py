#!/usr/bin/env python3
"""Regenerate docs/CLASS_CARD_SURVEY.md from docs/class-cards.json.

class-cards.json is the source of truth for class-card text and classification
(transcribed from the lvisintini/imperial-assault-data scans, then verified at 2x
against an icon legend). Edit the JSON, re-run this, commit both.
"""
import json, re, collections, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
cards = json.load(open(ROOT / "docs/class-cards.json", encoding="utf-8"))
hero_order = []; imp_order = []
for c in cards:
    lst = hero_order if c["kind"] == "hero" else imp_order
    if c["group"] not in lst: lst.append(c["group"])
byg = collections.defaultdict(list)
for c in cards: byg[c["group"]].append(c)
cnt = lambda sub: collections.Counter(c["shape"] for c in sub)
H = [c for c in cards if c["kind"] == "hero"]; I = [c for c in cards if c["kind"] == "imperial"]
dec = [c for c in cards if c["shape"] == "declared"]; pas = [c for c in cards if c["shape"] == "passive"]
has = lambda rx, c: bool(re.search(rx, c["text"], re.I))
m = lambda c: c.get("model") or {}
out = []; w = out.append
w("# Class Card Survey — full census\n")
w("All 172 hero class cards (19 heroes) and 100 imperial class cards (11 classes), transcribed from the scans in `lvisintini/imperial-assault-data` (MIT-licensed metadata + images; card content © LFL/FFG), then **verified card-by-card at 2× against an icon legend** (the first pass misread ~15% of cards: Strength/Insight glyphs, Block/Evade/Dodge, strain-vs-action costs, damage power-token icons, and two weapons' dice). Source of truth is `docs/class-cards.json`; this file is generated from it by `scripts/build/class-card-survey.py`.\n")
w("Notation: ⚡ surge · ✦ strain · ⊠ damage · [Block] · [Evade] · [Dodge] · ◆ threat · ⟶ action · [melee] / [ranged] · [Str]/[Ins]/[Tech] attribute tests · [damage token] etc. for power-token icons. Flavor text omitted.\n")
w("## Shapes\n")
w("- **equipment** — the card is a weapon, armor, modification or equipment item. Create as that item type; add `classXp`/`heroClass` so it lists under Class Cards.")
w("- **passive** — permanent, no choice, no cost: +Health/+Endurance/+Speed and always-on roll modifiers. Derived-data layer.")
w("- **declared** — a roll effect the player opts into when attacking, defending or testing, usually costed (exhaust/strain/deplete) and/or conditional. Card-backed button in the Declared Bonuses rows, undoable, refunded on cancel.")
w("- **action** — spent as an action or at a timing outside a roll. Text + exhaust state only.\n")
w("## Census\n")
w("| | Cards | equipment | passive | declared | action |\n|---|---|---|---|---|---|")
for label, sub in (("Hero (19 decks)", H), ("Imperial (11 classes)", I), ("All", cards)):
    c = cnt(sub); w(f"| {label} | {len(sub)} | {c['equipment']} | {c['passive']} | {c['declared']} | {c['action']} |")
hp = cnt(H); ip = cnt(I)
mech = hp["equipment"] + hp["passive"] + hp["declared"]
hb = collections.defaultdict(collections.Counter)
for c in H: hb[c["group"]][c["shape"]] += 1
multi = sorted(g for g in hb if hb[g]["equipment"] > 1)
w(f"\nHero decks: **{mech} of {len(H)} cards ({round(100*mech/len(H))}%)** are mechanical under the first three shapes; {hp['action']} are action/event text. Every deck has a starter weapon; {len(multi)} heroes ({', '.join(multi)}) also carry extra weapons, armor or equipment in the deck. All {len(hb)} heroes have at least one declared card, and {sum(1 for g in hb if hb[g]['passive'])} of {len(hb)} have a passive stat card.\n")
w(f"Imperial classes: **{ip['passive']+ip['declared']} of {len(I)} ({round(100*(ip['passive']+ip['declared'])/len(I))}%)** are mechanical — but imperial passives are mostly *attachments* that live on one deployment group, and several declared cards are *class-wide* (Shock Troopers, Sharpshooters, Find the Weakness) applying to every Imperial figure of a trait. Those need a different home than a hero's item list; see the model section.\n")
w("### Per hero\n\n| Hero | equipment | passive | declared | action |\n|---|---|---|---|---|")
for g in hero_order:
    c = cnt(byg[g]); w(f"| {g} | {c['equipment']} | {c['passive']} | {c['declared']} | {c['action']} |")
w("\n### Per imperial class\n\n| Class | passive | declared | action |\n|---|---|---|---|")
for g in imp_order:
    c = cnt(byg[g]); w(f"| {g} | {c['passive']} | {c['declared']} | {c['action']} |")
w("\n## What the declared cards actually need\n")
w(f"Over the {len(dec)} declared cards (hero + imperial):\n")
w("| Feature | Cards | Model support |\n|---|---|---|")
feat = [
 ("Flat result bonus (+damage/+surge/+accuracy/+block/+evade/+dodge)", lambda c: bool(m(c).get("bonus")), "`bonus` — same as the condition layer"),
 ("Add or swap dice in the pool", lambda c: bool(m(c).get("dice")), "`dice.add` / `dice.remove` — same as Focused/Ferocity"),
 ("Grants a surge ability for this attack", lambda c: bool(m(c).get("surges")) or has(r"gains?:?\s*⚡", c), "`surgeAbilities` — same structure as weapons"),
 ("Reroll dice", lambda c: has(r"reroll", c), "**Already free** — rerolls are unlimited until a surge spend; these cards need no button"),
 ("Pierce / Cleave / Blast keyword", lambda c: has(r"pierce|cleave|blast", c), "`bonus.pierce`; Cleave/Blast stay text (as on weapons)"),
 ("Applies a condition to the target", lambda c: has(r"becomes? (stunned|weakened|bleeding)|\bstun\b|\bweaken\b|\bbleed\b", c), "Text, or a surge ability with `effectType: \"condition\"` (small addition)"),
 ("Convert results (e.g. Block to Evade)", lambda c: has(r"convert", c), "Text; too few to model"),
 ("Spatial condition (spaces, adjacent, line of sight)", lambda c: has(r"spaces|adjacent|line of sight", c), "Printed on the button as `note`; never enforced"),
 ("Costed: exhaust", lambda c: "exhaust" in str(m(c).get("cost", "")), "Button flips the card to exhausted; undo readies it"),
 ("Costed: strain", lambda c: "strain" in str(m(c).get("cost", "")), "Button spends strain via `adjustActorStat`; undo refunds"),
 ("Costed: deplete", lambda c: "deplete" in str(m(c).get("cost", "")), "Button flips to depleted; undo readies"),
 ("No cost (pure reminder)", lambda c: str(m(c).get("cost", "")) == "none", "Still worth a button: one click instead of a manual stepper"),
]
for k, fn, sup in feat: w(f"| {k} | {sum(1 for c in dec if fn(c))} | {sup} |")
w("\nTiming: " + ", ".join(f"{k} {v}" for k, v in collections.Counter(str(m(c).get("when")) for c in dec).most_common()) + ". Defense-side and test-side buttons are needed, not just attack.\n")
w("## Passive cards: what they modify\n\n| Modifier | Cards |\n|---|---|")
for k, rx in {"Health": r"\+\d Health", "Endurance": r"\+\d Endurance", "Speed": r"\+\d Speed", "Accuracy": r"\+\d Accuracy", "Block": r"\+\d\s*\[Block\]", "Evade": r"\+\d\s*\[Evade\]", "Dodge": r"\+\d\s*\[Dodge\]", "Pierce": r"Pierce \d", "Extra defense die": r"add 1 (white|black) die", "Grants a surge ability": r"gains?:?\s*⚡|attacks gain"}.items():
    w(f"| {k} | {sum(1 for c in pas if has(rx, c))} |")
w(f"\n{len(pas)} passive cards; nearly all also carry a second, non-passive clause. The passive part is what the derived-data layer applies; the rest is text on the same card.\n")
w(open(ROOT / "scripts/build/class-card-survey-model.md", encoding="utf-8").read())
w("\n## Card text\n")
def fmt(c):
    t = c["text"].replace("\n", " ").replace("|", "\\|")
    sec = f" (+{c['secondary']})" if c.get("secondary") else ""
    return f"| {c['name']} | {'—' if c['xp'] is None else c['xp']} | {c['shape']}{sec} | {t} |"
w("\n### Hero decks\n")
for g in hero_order:
    w(f"\n#### {g}\n\n| Card | XP | Shape | Text |\n|---|---|---|---|")
    for c in sorted(byg[g], key=lambda x: ((x["xp"] or 0), x["name"])): w(fmt(c))
w("\n### Imperial classes\n")
for g in imp_order:
    w(f"\n#### {g}\n\n| Card | XP | Shape | Text |\n|---|---|---|---|")
    for c in sorted(byg[g], key=lambda x: ((x["xp"] or 0), x["name"])): w(fmt(c))
(ROOT / "docs/CLASS_CARD_SURVEY.md").write_text("\n".join(out) + "\n", encoding="utf-8")
print("wrote docs/CLASS_CARD_SURVEY.md —", len(cards), "cards")
