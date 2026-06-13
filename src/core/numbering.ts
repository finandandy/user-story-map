/*
 * Pure auto-numbering helpers (contracts/markdown-format.md §7).
 *
 * Numbers are DERIVED FROM POSITION, written into heading text on save and
 * stripped on read — they are presentation only, never identity (FR-019/FR-020).
 * The `strip ∘ format` identity (FR-022) is what keeps the round-trip stable
 * with numbering on. This module imports nothing and performs no I/O.
 */

const ROMAN: ReadonlyArray<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function toRoman(n: number): string {
  let out = "";
  let rem = Math.max(1, Math.floor(n));
  for (const [value, symbol] of ROMAN) {
    while (rem >= value) {
      out += symbol;
      rem -= value;
    }
  }
  return out;
}

// ---- Format: 1-based position -> heading prefix (no trailing space) ----

/** Activity prefix from backbone order: 1 -> "I.", 4 -> "IV." */
export function formatActivityNumber(index1: number): string {
  return `${toRoman(index1)}.`;
}

/** Release-group prefix from global release order: 1 -> "R1." */
export function formatReleaseNumber(index1: number): string {
  return `R${index1}.`;
}

/** Story-card prefix from per-cell order: 1 -> "1." */
export function formatCardNumber(index1: number): string {
  return `${index1}.`;
}

// ---- Strip: recover the clean identity; tolerant of a missing/odd prefix ----

const ACTIVITY_PREFIX = /^[IVXLCDM]+\.\s+/;
const RELEASE_PREFIX = /^R\d+\.\s+/;
const CARD_PREFIX = /^\d+(?:\.\d+)?\.\s+/;

/** Removes "I. " etc.; returns input unchanged if no recognized prefix. */
export function stripActivityNumber(headingText: string): string {
  return headingText.replace(ACTIVITY_PREFIX, "");
}

/** Removes "R1. "; returns input unchanged if no recognized prefix. */
export function stripReleaseNumber(headingText: string): string {
  return headingText.replace(RELEASE_PREFIX, "");
}

/** Removes "1. " / "1.2. "; returns input unchanged if no recognized prefix. */
export function stripCardNumber(headingText: string): string {
  return headingText.replace(CARD_PREFIX, "");
}
