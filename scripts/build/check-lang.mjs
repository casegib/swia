#!/usr/bin/env node
// Reject language keys that are also prefixes of other keys.
//
// Foundry expands lang/en.json into nested objects, so "A.B": "x" together
// with "A.B.c": "y" makes the whole file fail to load — silently, with every
// label rendering as its raw key. Exits 1 and lists the offenders.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(ROOT, "lang");
let ok = true;
for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")));
  const bad = keys.filter((k) => keys.some((o) => k.startsWith(o + "."))).sort();
  if (bad.length) {
    ok = false;
    console.log(`${name}: keys that collide with a parent key:`);
    for (const k of bad) console.log(`  ${k}`);
  }
}
console.log(ok ? "lang ok" : "lang BROKEN");
process.exit(ok ? 0 : 1);
