#!/usr/bin/env python3
"""Reject language keys that are also prefixes of other keys.

Foundry expands lang/en.json into nested objects, so "A.B": "x" together with
"A.B.c": "y" makes the whole file fail to load — silently, with every label
rendering as its raw key. Exit 1 and list the offenders.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ok = True
for path in sorted((ROOT / "lang").glob("*.json")):
    keys = set(json.load(open(path, encoding="utf-8")))
    bad = sorted(k for k in keys if any(k.startswith(o + ".") for o in keys))
    if bad:
        ok = False
        print(f"{path.name}: keys that collide with a parent key:")
        for k in bad:
            print(f"  {k}")
print("lang ok" if ok else "lang BROKEN")
sys.exit(0 if ok else 1)
