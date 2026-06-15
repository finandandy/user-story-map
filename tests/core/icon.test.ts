import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { parse } from "../../src/core/parser";
import { serialize } from "../../src/core/serializer";
import { setActivityIcon, isLikelyUnsafeSvg } from "../../src/core/model";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("../../fixtures/the-knight.md", import.meta.url)),
  "utf8",
);

describe("setActivityIcon — set and clear by position (FR-013/FR-016)", () => {
  it("sets a Lucide icon on an activity addressed by index", () => {
    const map = parse(FIXTURE);
    const next = setActivityIcon(map, 2, { type: "lucide", name: "swords" });
    expect(next.activities[2].icon).toEqual({ type: "lucide", name: "swords" });
    // Other activities are untouched.
    expect(next.activities[3].icon).toBe(map.activities[3].icon);
  });

  it("clears an icon when given null (serializer then omits the line)", () => {
    const map = parse(FIXTURE);
    // Activity 0 carries `icon: compass` in the fixture.
    expect(map.activities[0].icon).toEqual({ type: "lucide", name: "compass" });
    const cleared = setActivityIcon(map, 0, null);
    expect(cleared.activities[0].icon).toBeNull();
    const out = serialize(cleared);
    expect(out).not.toContain("icon: compass");
    // No placeholder line is left behind (FR-015).
    expect(out).toContain("## I. Enter & orient\n\n### R1. Walking skeleton");
  });

  it("is pure — the input map is not mutated", () => {
    const map = parse(FIXTURE);
    const before = serialize(map);
    setActivityIcon(map, 2, { type: "lucide", name: "swords" });
    expect(serialize(map)).toBe(before);
  });

  it("is a no-op for an out-of-range index", () => {
    const map = parse(FIXTURE);
    const out = serialize(setActivityIcon(map, 99, { type: "lucide", name: "x" }));
    expect(out).toBe(serialize(map));
  });
});

describe("isLikelyUnsafeSvg — pure backstop guard (FR-017/F18)", () => {
  it("passes a clean inline SVG", () => {
    expect(
      isLikelyUnsafeSvg('<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>'),
    ).toBe(false);
  });

  it("flags a <script> element", () => {
    expect(isLikelyUnsafeSvg("<svg><script>alert(1)</script></svg>")).toBe(true);
  });

  it("flags a <foreignObject> element", () => {
    expect(
      isLikelyUnsafeSvg("<svg><foreignObject><body/></foreignObject></svg>"),
    ).toBe(true);
  });

  it("flags an on* event-handler attribute", () => {
    expect(isLikelyUnsafeSvg('<svg onload="evil()"><path/></svg>')).toBe(true);
    expect(isLikelyUnsafeSvg('<svg><rect onclick="x()"/></svg>')).toBe(true);
  });

  it("flags a javascript: href", () => {
    expect(
      isLikelyUnsafeSvg('<svg><a href="javascript:evil()"><path/></a></svg>'),
    ).toBe(true);
    expect(
      isLikelyUnsafeSvg('<svg><a xlink:href="javascript:evil()"/></svg>'),
    ).toBe(true);
  });

  it("flags an external href reference", () => {
    expect(
      isLikelyUnsafeSvg('<svg><image href="https://evil.example/x.png"/></svg>'),
    ).toBe(true);
  });
});

describe("parse ⇄ serialize icon symmetry", () => {
  it("round-trips a Lucide icon set on an activity", () => {
    const map = parse(FIXTURE);
    const out = serialize(setActivityIcon(map, 2, { type: "lucide", name: "swords" }));
    const reparsed = parse(out);
    expect(reparsed.activities[2].icon).toEqual({ type: "lucide", name: "swords" });
    // Stable across a second round-trip.
    expect(serialize(reparsed)).toBe(out);
  });

  it("round-trips a sanitized custom-svg icon", () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>';
    const map = parse(FIXTURE);
    const out = serialize(setActivityIcon(map, 2, { type: "custom-svg", svg }));
    expect(out).toContain(`icon: ${svg}`);
    const reparsed = parse(out);
    expect(reparsed.activities[2].icon).toEqual({ type: "custom-svg", svg });
    expect(serialize(reparsed)).toBe(out);
  });

  it("leaves icon null and keeps the line when the icon value is unsafe", () => {
    const md =
      "---\nstory-map: true\n---\n\n# Releases\n\n1. R\n\n# Activities\n\n## I. A\n\nicon: <svg onload=\"x()\"></svg>\n\n### R1. R\n\n#### 1. C\n";
    const map = parse(md);
    expect(map.activities[0].icon).toBeNull();
    // The raw line is preserved in the body rather than dropped (F19).
    expect(map.activities[0].body).toContain('icon: <svg onload="x()"></svg>');
    expect(serialize(map)).toBe(md);
  });
});
