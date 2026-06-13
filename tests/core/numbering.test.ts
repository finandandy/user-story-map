import { describe, it, expect } from "vitest";
import {
  formatActivityNumber,
  formatReleaseNumber,
  formatCardNumber,
  stripActivityNumber,
  stripReleaseNumber,
  stripCardNumber,
} from "../../src/core/numbering";

describe("numbering — Roman formatting (FR-019)", () => {
  it("formats activity prefixes as Roman numerals with a trailing dot", () => {
    expect(formatActivityNumber(1)).toBe("I.");
    expect(formatActivityNumber(4)).toBe("IV.");
    expect(formatActivityNumber(6)).toBe("VI.");
    expect(formatActivityNumber(9)).toBe("IX.");
    expect(formatActivityNumber(14)).toBe("XIV.");
  });

  it("formats release and card prefixes", () => {
    expect(formatReleaseNumber(1)).toBe("R1.");
    expect(formatReleaseNumber(12)).toBe("R12.");
    expect(formatCardNumber(1)).toBe("1.");
    expect(formatCardNumber(7)).toBe("7.");
  });
});

describe("numbering — strip ∘ format is identity (FR-022)", () => {
  const titles = ["Enter & orient", "Walking skeleton", "Start the game", "1.2.3"];

  it("round-trips activity prefixes", () => {
    for (const t of titles) {
      for (let i = 1; i <= 12; i++) {
        expect(stripActivityNumber(`${formatActivityNumber(i)} ${t}`)).toBe(t);
      }
    }
  });

  it("round-trips release prefixes", () => {
    for (const t of titles) {
      for (let i = 1; i <= 12; i++) {
        expect(stripReleaseNumber(`${formatReleaseNumber(i)} ${t}`)).toBe(t);
      }
    }
  });

  it("round-trips card prefixes (per-cell restart)", () => {
    for (const t of titles) {
      for (let i = 1; i <= 12; i++) {
        expect(stripCardNumber(`${formatCardNumber(i)} ${t}`)).toBe(t);
      }
    }
  });
});

describe("numbering — tolerant strip (FR-020)", () => {
  it("strips a decimal card prefix (e.g. tenths)", () => {
    expect(stripCardNumber("1.2. Branching choices")).toBe("Branching choices");
  });

  it("leaves a heading with no recognizable prefix unchanged", () => {
    expect(stripActivityNumber("Enter & orient")).toBe("Enter & orient");
    expect(stripReleaseNumber("Walking skeleton")).toBe("Walking skeleton");
    expect(stripCardNumber("Start the game")).toBe("Start the game");
  });

  it("does not treat a non-prefix leading token as a number", () => {
    // No trailing space after the dot -> not an auto-number prefix.
    expect(stripCardNumber("1.no-space")).toBe("1.no-space");
    expect(stripActivityNumber("IOU. money")).toBe("IOU. money");
  });
});
