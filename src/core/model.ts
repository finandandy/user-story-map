/*
 * Core data model for a story map (contracts/core-api.md §Types).
 *
 * This module is the pure, Obsidian-independent heart of the plugin
 * (Constitution I) — it imports nothing from `obsidian`. Auto-number prefixes
 * are NEVER stored here; titles are clean identities (FR-020).
 *
 * Mutation helpers (add/delete/reorder/rename/edit) and `createEmptyMap` are
 * introduced in later phases (US2 / US3); Phase 2 defines the types only.
 */

export interface StoryMap {
  releases: Release[];
  activities: Activity[];
  /** Raw YAML frontmatter block, preserved verbatim (managed key: story-map). */
  frontmatter: string;
  /** Raw content between the frontmatter and `# Releases`, preserved verbatim. */
  preamble: string;
  /** Raw content after the `# Activities` section, preserved verbatim. */
  trailing: string;
  diagnostics: Diagnostic[];
}

export interface Release {
  /** Identity / cross-cutting key (text before the first " - "). */
  title: string;
  subtitle: string | null;
  /** 0-based position in the `# Releases` declaration. */
  order: number;
}

export interface Activity {
  title: string;
  /** 0-based position along the backbone. */
  order: number;
  /** Release-band cells keyed by release title; insertion order is incidental. */
  cells: Map<string, Card[]>;
}

export interface Card {
  /** Clean identity (auto-number prefix stripped). */
  title: string;
  /** Raw markdown body, preserved. Empty string when the card has no body. */
  body: string;
  /** 0-based position within its activity×release cell. */
  order: number;
  activityTitle: string;
  releaseTitle: string;
}

export interface Diagnostic {
  severity: "warning" | "error";
  message: string;
  line: number | null;
}
