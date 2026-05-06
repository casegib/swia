/**
 * Shared utilities for the SWIA system.
 */

/**
 * TextEditor implementation that works across Foundry V1 and V2.
 * Use this instead of the bare `TextEditor` global to avoid breakage on V2.
 */
export const TextEditorImpl = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;

/**
 * Returns an array of indices [0, 1, 2, ...n-1] suitable for Handlebars each-iteration
 * of dice blocks. Returns [] for n <= 0.
 *
 * @param {number} n
 * @returns {number[]}
 */
export function diceArray(n) {
  return Array.from({ length: n || 0 }, (_, i) => i);
}

/**
 * Normalizes a value that Foundry may have serialized as a plain object (keyed by index)
 * back into a proper JS array.
 *
 * @param {unknown} v
 * @returns {unknown[]}
 */
export function ensureArray(v) {
  return Array.isArray(v) ? v : Object.values(v ?? {});
}
