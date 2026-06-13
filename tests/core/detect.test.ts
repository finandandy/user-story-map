import { describe, it, expect } from "vitest";
import { isStoryMap } from "../../src/core/detect";

describe("isStoryMap (FR-011 trigger)", () => {
  it("is true when frontmatter contains story-map: true", () => {
    expect(isStoryMap("---\nstory-map: true\n---\n\n# Releases\n")).toBe(true);
  });

  it("ignores other frontmatter keys around the marker", () => {
    const md = "---\ntitle: Foo\nstory-map: true\ntags: [a]\n---\n\n# x\n";
    expect(isStoryMap(md)).toBe(true);
  });

  it("is false when the marker is absent", () => {
    expect(isStoryMap("---\ntitle: Foo\n---\n\n# Releases\n")).toBe(false);
  });

  it("is false for story-map: false", () => {
    expect(isStoryMap("---\nstory-map: false\n---\n")).toBe(false);
  });

  it("is false for a markerless file (no frontmatter)", () => {
    expect(isStoryMap("# Releases\n\n1. A\n")).toBe(false);
    expect(isStoryMap("")).toBe(false);
  });

  it("does not match the marker outside the frontmatter block", () => {
    expect(isStoryMap("# Notes\n\nstory-map: true\n")).toBe(false);
  });
});
