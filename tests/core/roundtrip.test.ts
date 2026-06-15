import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { parse } from "../../src/core/parser";
import { serialize } from "../../src/core/serializer";
import {
  editCard,
  renameActivity,
  renameRelease,
  setActivityIcon,
} from "../../src/core/model";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("../../fixtures/the-knight.md", import.meta.url)),
  "utf8",
);

describe("round-trip read path (FR-006/FR-022)", () => {
  it("serialize(parse(fixture)) === fixture byte-for-byte", () => {
    expect(serialize(parse(FIXTURE))).toBe(FIXTURE);
  });

  it("is stable across a second round-trip", () => {
    const once = serialize(parse(FIXTURE));
    expect(serialize(parse(once))).toBe(once);
  });

  it("re-derives auto-numbers deterministically from position", () => {
    // Stripping then re-writing numbers reproduces the same prefixes (F13).
    const map = parse(FIXTURE);
    const out = serialize(map);
    expect(out).toContain("## I. Enter & orient");
    expect(out).toContain("### R2. Core loop");
    expect(out).toContain("#### 2. See the goal");
  });

  it("round-trips an activity icon + activity body byte-for-byte (US5 / F20)", () => {
    // The fixture carries `icon: compass` on activity I and a body on activity II.
    const map = parse(FIXTURE);
    expect(map.activities[0].icon).toEqual({ type: "lucide", name: "compass" });
    expect(map.activities[1].body).toBe(
      "Movement and traversal are the heart of this activity.",
    );
    expect(serialize(map)).toBe(FIXTURE);
  });

  it("round-trips a custom-svg icon added to an activity", () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>';
    const map = setActivityIcon(parse(FIXTURE), 2, { type: "custom-svg", svg });
    const once = serialize(map);
    expect(serialize(parse(once))).toBe(once);
  });
});

describe("round-trip edit path — only intended bytes change, edits are stable (FR-006)", () => {
  it("a single edit changes only the intended bytes; the rest is byte-identical", () => {
    const map = parse(FIXTURE);
    const before = serialize(map);
    const after = serialize(renameActivity(map, 0, "Begin the journey"));

    // Splice the one intended change back out — everything else must match.
    const restored = after.replace(
      "## I. Begin the journey",
      "## I. Enter & orient",
    );
    expect(restored).toBe(before);
  });

  it("re-parse → serialize of an edited map is stable", () => {
    const map = parse(FIXTURE);
    const edited = editCard(
      map,
      { activityIndex: 0, releaseTitle: "Walking skeleton", order: 0 },
      { title: "Boot the game", body: "Choose a save slot." },
    );
    const once = serialize(edited);
    expect(serialize(parse(once))).toBe(once);
  });

  it("renaming a release keeps the map round-trip stable", () => {
    const map = parse(FIXTURE);
    const once = serialize(renameRelease(map, "Core loop", "Core gameplay"));
    expect(serialize(parse(once))).toBe(once);
  });
});
