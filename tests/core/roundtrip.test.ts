import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { parse } from "../../src/core/parser";
import { serialize } from "../../src/core/serializer";

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
});
