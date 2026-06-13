// Star Wars Imperial Assault custom dice terms (Phase 5, step 17-18).
// Ported from the standalone swia-dice module and absorbed into the system.
// Denominations match the module to preserve existing macros and chat history:
//   r = red, n = blue, g = green, y = yellow (attack); b = black, w = white (defense)

const DiceBase = foundry.dice.terms.Die;

const IMG_PATH = "systems/swia/icons/dice";
const img = (file) => `${IMG_PATH}/${file}`;
export const dieImgPath = img;

/**
 * Face tables for all six IA dice. Source of truth: swia-dice/modules/die.js
 * (validated in play) with a machine-readable `symbols` block per face so the
 * roll dialog can total results.
 */
export const SWIA_DICE = {
  r: {
    color: "red", kind: "attack", label: "SWIA.Attack.Red",
    faces: [
      { symbols: { damage: 1 }, img: "red-1damage.png" },
      { symbols: { damage: 2 }, img: "red-2damage.png" },
      { symbols: { damage: 2 }, img: "red-2damage.png" },
      { symbols: { damage: 2, surge: 1 }, img: "red-2damage-surge.png" },
      { symbols: { damage: 3 }, img: "red-3damage.png" },
      { symbols: { damage: 3 }, img: "red-3damage.png" }
    ]
  },
  n: {
    color: "blue", kind: "attack", label: "SWIA.Attack.Blue",
    faces: [
      { symbols: { damage: 1, accuracy: 2 }, img: "blue-1damage-2accuracy.png" },
      { symbols: { damage: 1, accuracy: 5 }, img: "blue-1damage-5accuracy.png" },
      { symbols: { damage: 1, surge: 1, accuracy: 3 }, img: "blue-1damage-surge-3accuracy.png" },
      { symbols: { damage: 2, accuracy: 3 }, img: "blue-2damage-3accuracy.png" },
      { symbols: { damage: 2, accuracy: 4 }, img: "blue-2damage-4accuracy.png" },
      { symbols: { surge: 1, accuracy: 2 }, img: "blue-surge-2accuracy.png" }
    ]
  },
  g: {
    color: "green", kind: "attack", label: "SWIA.Attack.Green",
    faces: [
      { symbols: { damage: 2, accuracy: 1 }, img: "green-2damage-1accuracy.png" },
      { symbols: { damage: 2, accuracy: 2 }, img: "green-2damage-2accuracy.png" },
      { symbols: { damage: 2, accuracy: 3 }, img: "green-2damage-3accuracy.png" },
      { symbols: { surge: 1, accuracy: 1 }, img: "green-surge-1accuracy.png" },
      { symbols: { surge: 1, damage: 1, accuracy: 1 }, img: "green-surge-1damage-1accuracy.png" },
      { symbols: { surge: 1, damage: 1, accuracy: 2 }, img: "green-surge-1damage-2accuracy.png" }
    ]
  },
  y: {
    color: "yellow", kind: "attack", label: "SWIA.Attack.Yellow",
    faces: [
      { symbols: { damage: 1, accuracy: 2 }, img: "yellow-1damage-2accuracy.png" },
      { symbols: { damage: 1, surge: 1, accuracy: 1 }, img: "yellow-1damage-surge-1accuracy.png" },
      { symbols: { damage: 2, accuracy: 1 }, img: "yellow-2damage-1accuracy.png" },
      { symbols: { damage: 1, surge: 2 }, img: "yellow-2surge-1damage.png" },
      { symbols: { surge: 1 }, img: "yellow-surge.png" },
      { symbols: { surge: 1, accuracy: 2 }, img: "yellow-surge-2accuracy.png" }
    ]
  },
  b: {
    color: "black", kind: "defense", label: "SWIA.Defense.Black",
    faces: [
      { symbols: { block: 1 }, img: "black-1block.png" },
      { symbols: { block: 2 }, img: "black-2blocks.png" },
      { symbols: { block: 3 }, img: "black-3blocks.png" },
      { symbols: { evade: 1 }, img: "black-evade.png" },
      { symbols: { block: 1 }, img: "black-1block.png" },
      { symbols: { block: 2 }, img: "black-2blocks.png" }
    ]
  },
  w: {
    color: "white", kind: "defense", label: "SWIA.Defense.White",
    faces: [
      { symbols: {}, img: "white-blank.png" },
      { symbols: { block: 1 }, img: "white-block.png" },
      { symbols: { block: 1, evade: 1 }, img: "white-block-evade.png" },
      { symbols: { block: 1, evade: 1 }, img: "white-block-evade.png" },
      { symbols: { dodge: 1 }, img: "white-dodge.png" },
      { symbols: { evade: 1 }, img: "white-evade.png" }
    ]
  }
};

/** Map die color name -> denomination ("red" -> "r"). */
export const COLOR_TO_DENOM = Object.fromEntries(
  Object.entries(SWIA_DICE).map(([denom, def]) => [def.color, denom])
);

const SYMBOL_KEYS = ["damage", "surge", "accuracy", "block", "evade", "dodge"];

export function emptySymbols() {
  return { damage: 0, surge: 0, accuracy: 0, block: 0, evade: 0, dodge: 0 };
}

/** Localized human-readable label for a face's symbols (e.g. "2 Damage, Surge"). */
export function symbolsLabel(symbols = {}) {
  const parts = [];
  for (const key of SYMBOL_KEYS) {
    const count = symbols[key] ?? 0;
    if (!count) continue;
    const name = game.i18n.localize(`SWIA.Dice.${key.charAt(0).toUpperCase()}${key.slice(1)}`);
    parts.push(count > 1 ? `${count} ${name}` : name);
  }
  return parts.length ? parts.join(", ") : game.i18n.localize("SWIA.Dice.Blank");
}

/** Lookup face data for a denomination + rolled result (1-6). */
export function faceData(denomination, result) {
  return SWIA_DICE[denomination]?.faces?.[result - 1] ?? null;
}

function defineDieClass(denomination, def) {
  const cls = class extends DiceBase {
    constructor(termData = {}) {
      termData.faces = 6;
      super(termData);
    }

    static DENOMINATION = denomination;

    /** @override Render face image in roll tooltips / chat. */
    getResultLabel(result) {
      const face = faceData(denomination, result.result);
      if (!face) return String(result.result);
      const label = symbolsLabel(face.symbols);
      return `<div class="swia-die-face" data-label="${label}"><img class="swia-die-result" src="${img(face.img)}" alt="${label}" /></div>`;
    }
  };
  // CRITICAL: each class needs a unique name. Foundry resolves dice term
  // classes BY NAME when parsing/deserializing rolls — identically named
  // classes all collapse to the first registered one (everything rolls red).
  Object.defineProperty(cls, "name", { value: `SWIADie${denomination.toUpperCase()}` });
  return cls;
}

/** Die classes keyed by denomination (built once for instanceof/registration). */
export const SWIA_DIE_CLASSES = Object.fromEntries(
  Object.entries(SWIA_DICE).map(([denom, def]) => [denom, defineDieClass(denom, def)])
);

/**
 * Sum IA symbols across one or more evaluated Rolls. Non-SWIA terms are ignored.
 */
export function totalSymbols(rolls) {
  const totals = emptySymbols();
  for (const roll of [].concat(rolls ?? []).filter(Boolean)) {
    for (const term of roll.dice ?? []) {
      const denom = term.constructor?.DENOMINATION;
      if (!(denom in SWIA_DICE)) continue;
      for (const result of term.results ?? []) {
        if (!result.active) continue;
        const face = faceData(denom, result.result);
        if (!face) continue;
        for (const key of SYMBOL_KEYS) totals[key] += face.symbols[key] ?? 0;
      }
    }
  }
  return totals;
}

/**
 * Extract rendered face entries from an evaluated Roll.
 * Each entry: { img, label, color, denom, resultNum }
 * denom/resultNum are included so individual dice can be rerolled by the combat window.
 */
export function rollFaces(roll) {
  const faces = [];
  if (!roll) return faces;
  for (const term of roll.dice ?? []) {
    const denom = term.constructor?.DENOMINATION;
    if (!(denom in SWIA_DICE)) continue;
    for (const result of term.results ?? []) {
      if (!result.active) continue;
      const face = faceData(denom, result.result);
      if (!face) continue;
      faces.push({
        img: img(face.img),
        label: symbolsLabel(face.symbols),
        color: SWIA_DICE[denom].color,
        denom,
        resultNum: result.result
      });
    }
  }
  return faces;
}

/** Register the six IA dice in CONFIG.Dice.terms. Call from the system init hook. */
export function registerDiceTerms() {
  for (const [denom, cls] of Object.entries(SWIA_DIE_CLASSES)) {
    CONFIG.Dice.terms[denom] = cls;
  }
}

/**
 * Dice So Nice integration (step 18). All DSN work happens inside the
 * diceSoNiceReady hook — no static import, so the system runs without DSN.
 */
export function registerDiceSoNice() {
  Hooks.once("diceSoNiceReady", (dice3d) => {
    try {
      dice3d.addSystem({ id: "swia", name: "Star Wars Imperial Assault" }, "default");
      for (const [denom, def] of Object.entries(SWIA_DICE)) {
        dice3d.addDicePreset({
          type: `d${denom}`,
          labels: def.faces.map((face) => img(face.img)),
          system: "swia"
        });
      }
      console.log("SWIA | Dice So Nice presets registered");
    } catch (err) {
      console.error("SWIA | Failed to register Dice So Nice presets", err);
    }
  });
}

/** Warn the GM if the legacy swia-dice module is still active (duplicate term registration). */
export function checkLegacyDiceModule() {
  Hooks.once("ready", () => {
    if (game.modules.get("swia-dice")?.active && game.user?.isGM) {
      ui.notifications?.warn(game.i18n.localize("SWIA.Dice.LegacyModuleWarning"), { permanent: true });
    }
  });
}

/**
 * Chat styling for bare /roll formulas using IA dice (e.g. "/roll 2dr + 1dy").
 * Replaces the numeric total with the face labels. Ported from the module's
 * renderChatMessage jQuery hook to the v13 renderChatMessageHTML native-DOM hook.
 */
export function registerChatRenderHooks() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!html.querySelector(".swia-die-face[data-label]")) return;
    html.querySelectorAll(".dice-roll").forEach((diceRoll) => {
      const faces = diceRoll.querySelectorAll(".swia-die-face[data-label]");
      if (!faces.length) return;
      const labels = Array.from(faces).map((el) => el.dataset.label);
      const total = diceRoll.querySelector(".dice-total");
      if (total) {
        total.textContent = "";
        const span = document.createElement("span");
        span.className = "swia-roll-total-labels";
        span.textContent = labels.join(" | ");
        total.appendChild(span);
      }
    });
  });
}
