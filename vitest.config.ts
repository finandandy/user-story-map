import { defineConfig } from "vitest/config";

// Scoped to the pure, Obsidian-independent core module (src/core/).
// These tests run under Node with zero mocking — see research.md R7.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/core/**/*.test.ts"],
  },
});
