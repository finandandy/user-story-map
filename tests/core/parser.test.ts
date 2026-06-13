import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { parse } from "../../src/core/parser";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("../../fixtures/the-knight.md", import.meta.url)),
  "utf8",
);

describe("parse — structure extraction (FR-002/FR-016)", () => {
  const map = parse(FIXTURE);

  it("captures frontmatter and preamble verbatim", () => {
    expect(map.frontmatter).toBe("---\nstory-map: true\n---\n");
    expect(map.preamble).toBe("\n# The Knight: Adventure Reforged\n\n");
    expect(map.trailing).toBe("");
  });

  it("extracts releases in document order with title/subtitle split", () => {
    expect(map.releases.map((r) => r.title)).toEqual([
      "Walking skeleton",
      "Core loop",
      "Depth & agency",
    ]);
    expect(map.releases[0].subtitle).toBe("thinnest playable spine");
    expect(map.releases.map((r) => r.order)).toEqual([0, 1, 2]);
  });

  it("extracts all six activities along the backbone in order", () => {
    expect(map.activities.map((a) => a.title)).toEqual([
      "Enter & orient",
      "Explore world",
      "Encounter",
      "Fight & survive",
      "Choose & shape",
      "Progress & save",
    ]);
    expect(map.activities.map((a) => a.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("resolves cards into activity×release cells with clean, stripped titles", () => {
    const enter = map.activities[0];
    const walking = enter.cells.get("Walking skeleton")!;
    expect(walking.map((c) => c.title)).toEqual(["Start the game", "See the goal"]);
    expect(walking.map((c) => c.order)).toEqual([0, 1]);
    expect(walking[0].activityTitle).toBe("Enter & orient");
    expect(walking[0].releaseTitle).toBe("Walking skeleton");
  });

  it("produces no diagnostics for the canonical fixture", () => {
    expect(map.diagnostics).toEqual([]);
  });
});

describe("parse — tolerance and diagnostics (FR-012/FR-018/FR-020)", () => {
  it("never throws on malformed input and keeps content addressable", () => {
    const md =
      "---\nstory-map: true\n---\n\n# Releases\n\n1. Alpha\n1. Alpha\n\n# Activities\n\n## A\n\n### Ghost\n\n#### Lonely card\n";
    const map = parse(md);
    expect(map.activities[0].cells.get("Ghost")![0].title).toBe("Lonely card");
    const messages = map.diagnostics.map((d) => d.message);
    expect(messages.some((m) => /Duplicate release title/.test(m))).toBe(true);
    expect(messages.some((m) => /undeclared release/.test(m))).toBe(true);
  });

  it("strips auto-number prefixes to recover clean identities", () => {
    const md =
      "---\nstory-map: true\n---\n\n# Releases\n\n1. Walking skeleton\n\n# Activities\n\n## I. Enter\n\n### R1. Walking skeleton\n\n#### 1. Start\n";
    const map = parse(md);
    expect(map.activities[0].title).toBe("Enter");
    expect(map.activities[0].cells.has("Walking skeleton")).toBe(true);
    expect(map.activities[0].cells.get("Walking skeleton")![0].title).toBe("Start");
  });

  it("treats a hand-authored markerless file as an empty map (FR-011)", () => {
    const map = parse("just some notes\n");
    expect(map.releases).toEqual([]);
    expect(map.activities).toEqual([]);
    expect(map.preamble).toBe("just some notes\n");
  });
});
