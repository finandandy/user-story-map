# Contract: Core Module Public API

**Feature**: 001-story-map-editor | **Date**: 2026-06-13 | **Status**: v0.1

`src/core/` is the pure, Obsidian-independent heart of the plugin (Constitution I). It is the only
component that reads or writes the Markdown format, and it is unit-tested in isolation (no Obsidian
runtime). The view layer depends on this API; this API depends on nothing in `obsidian`.

## Types (`src/core/model.ts`)

```ts
export interface StoryMap {
  releases: Release[];
  activities: Activity[];
  frontmatter: string;   // raw, preserved (managed key: story-map)
  preamble: string;      // raw, preserved
  trailing: string;      // raw, preserved
  diagnostics: Diagnostic[];
}

export interface Release {
  title: string;          // identity / key
  subtitle: string | null;
  order: number;
}

export interface Activity {
  title: string;
  order: number;
  cells: Map<string, Card[]>;   // key = release title
}

export interface Card {
  title: string;
  body: string;           // raw markdown, preserved
  order: number;
  activityTitle: string;
  releaseTitle: string;
}

export interface Diagnostic {
  severity: 'warning' | 'error';
  message: string;
  line: number | null;
}
```

## Functions

### `parse(markdown: string): StoryMap`  (`src/core/parser.ts`)

- **Input**: full file contents of a story-map Markdown file.
- **Output**: a `StoryMap`. Never throws; malformed input yields `diagnostics` (FR-012).
- **Guarantees**: captures `frontmatter`/`preamble`/`trailing` and card bodies verbatim; resolves
  cards to releases by name; assigns `order` from document order; **strips** auto-number prefixes
  (via `numbering.ts`) so stored titles are clean identities (FR-020).

### `serialize(map: StoryMap): string`  (`src/core/serializer.ts`)

- **Input**: a `StoryMap` (possibly mutated by the view).
- **Output**: Markdown conforming to [markdown-format.md](./markdown-format.md).
- **Guarantees (round-trip)**: `serialize(parse(x)) === x` for any conformant `x` (FR-006/FR-022);
  preserved segments and untouched card bodies are reproduced exactly (FR-005); **writes**
  auto-number prefixes from position (via `numbering.ts`) — activities Roman, release groups
  `R{n}`, cards per-cell `{n}` — recomputed on every serialize so numbers match current order
  (FR-019/FR-021).

### Numbering (`src/core/numbering.ts`)

Pure helpers that derive/strip auto-number prefixes (markdown-format.md §7). Used by `parser.ts`
(strip) and `serializer.ts` (format). No I/O, no `obsidian`.

```ts
// Strip an auto-number prefix to recover the clean identity; returns the input unchanged
// if no recognized prefix is present (hand-authored files load fine).
stripActivityNumber(headingText: string): string   // removes "I. " etc.
stripReleaseNumber(headingText: string): string     // removes "R1. "
stripCardNumber(headingText: string): string        // removes "1. " / "1.2. "

// Format a prefix from 1-based position.
formatActivityNumber(index1: number): string        // 1 -> "I.", 2 -> "II."
formatReleaseNumber(index1: number): string          // 1 -> "R1."
formatCardNumber(index1: number): string             // 1 -> "1."
```

**Guarantee**: for any clean title `t` and position `i`,
`strip*( format*(i) + " " + t ) === t` (round-trip identity, FR-022). Card numbering restarts per
activity×release cell; release numbering is global; activity numbering follows backbone order.

### `isStoryMap(markdown: string): boolean`  (`src/core/detect.ts`)

- Returns `true` when frontmatter contains `story-map: true`. Pure string/`YAML`-frontmatter check.

### `createEmptyMap(opts?: { title?: string }): StoryMap`  (`src/core/model.ts`)

- Returns a minimal valid map (marker frontmatter + empty `# Releases`/`# Activities`) for the
  "create / initialize" command (FR-011).

## Mutation helpers (pure, `src/core/model.ts`)

Each returns a **new** `StoryMap` (or mutates a working copy) and never performs I/O. The view
calls these, then `requestSave()`.

```ts
addRelease(map, title, subtitle?): StoryMap
renameRelease(map, oldTitle, newTitle): StoryMap          // updates declaration + all refs (FR-018)
deleteRelease(map, title): StoryMap                       // removes the band across activities
reorderReleases(map, fromIndex, toIndex): StoryMap

addActivity(map, title): StoryMap
renameActivity(map, activityIndex, newTitle): StoryMap    // by backbone position, not text (duplicate titles allowed)
deleteActivity(map, activityIndex): StoryMap
reorderActivities(map, fromIndex, toIndex): StoryMap

addCard(map, activityIndex, releaseTitle, title, body?): StoryMap
editCard(map, ref, patch: { title?: string; body?: string }): StoryMap
deleteCard(map, ref): StoryMap
reorderCard(map, ref, toIndex): StoryMap                  // within its activity×release cell
```

`ref` identifies a card by `{ activityIndex, releaseTitle, order }`.

**Addressing model** (spec Edge Cases — Duplicate names): activities are addressed by
**backbone position** (`activityIndex`, 0-based), never by title, so two activities sharing the
same text remain individually addressable and editable. Cards are addressed by `order` within
their activity×release cell, so duplicate card titles stay distinct. Releases alone are addressed
by title — the title is their cross-cutting identity (FR-018), and a duplicate release title is a
malformed structure surfaced as a `Diagnostic` (markdown-format.md §F9), not an addressable peer.

## Invariants the API upholds

| Invariant | Tied to |
|-----------|---------|
| No function imports from `obsidian`. | Principle I (testable core) |
| `parse` never throws; errors become diagnostics. | FR-012 |
| `serialize ∘ parse` is the identity on conformant input. | FR-006 |
| Unmanaged content & untouched card bodies are byte-preserved. | FR-005 |
| Release identity is its title; rename rewrites declaration + refs together. | FR-018 |
| Activities/cards addressed by position (index / cell order), so duplicate titles stay individually addressable. | Edge Cases — Duplicate names |
| Auto-numbers are derived from position, stripped on parse, written on serialize; never identity. | FR-019, FR-020 |
| `strip ∘ format` is the identity, keeping round-trip stable with numbering on. | FR-022 |

## Test contract (`tests/core/`)

- `parser.test.ts` — structure extraction, ordering, body capture, prefix stripping, diagnostics
  on malformed input.
- `serializer.test.ts` — canonical output shape; ordinal renumbering; auto-number writing; rename
  propagation.
- `numbering.test.ts` — Roman/`R{n}`/per-cell `{n}` formatting; strip patterns; `strip ∘ format`
  identity; renumber-after-reorder.
- `roundtrip.test.ts` — `serialize(parse(fixture)) === fixture`; edits change only intended bytes.
- `detect.test.ts` — marker present/absent/edge frontmatter.
