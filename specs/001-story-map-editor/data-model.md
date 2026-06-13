# Data Model: Story Map Editor

**Feature**: 001-story-map-editor | **Date**: 2026-06-13 | **Phase**: 1

The model is the in-memory representation produced by `parser.ts` and consumed by `serializer.ts`
and the view. It lives in `src/core/model.ts` and imports nothing from `obsidian` (Principle I).
The Markdown file is the source of truth; this model is a faithful, round-trippable projection of
it.

## Entity overview

```text
StoryMap
├── frontmatter        (preserved verbatim; one managed key: story-map)
├── preamble           (preserved verbatim: content before # Releases)
├── releases: Release[]        (ordered; declared once)
├── activities: Activity[]     (ordered; the backbone)
├── trailing           (preserved verbatim: content after the managed sections)
└── diagnostics: Diagnostic[]  (non-fatal parse issues, surfaced in the view)

Activity ──< (per release) Cell ──< Card
Release  ──(name is the key referenced by Cells)
```

## Entities

### StoryMap

The whole map, backed by one Markdown file.

| Field | Type | Notes |
|-------|------|-------|
| `releases` | `Release[]` | Ordered as declared in `# Releases`. May be empty (empty-state). |
| `activities` | `Activity[]` | Ordered backbone (left→right). May be empty. |
| `frontmatter` | `string` (raw) | Original YAML block, preserved verbatim except the managed `story-map` key. |
| `preamble` | `string` | Raw text between frontmatter and `# Releases` (e.g. an H1 title, prose). Preserved. |
| `trailing` | `string` | Raw text after the last managed section. Preserved. |
| `diagnostics` | `Diagnostic[]` | Non-fatal issues (e.g. card under an undeclared release). |

**Invariants**: serializing a `StoryMap` reproduces the source byte-for-byte when no edits were
made (round-trip, FR-006/FR-022). Unmanaged fields (`frontmatter`, `preamble`, `trailing`, card
bodies) are never rewritten unless explicitly edited (FR-005). The model stores **clean
identities** only — no auto-number prefix is ever part of a stored `title`; numbers are derived
from `order` at serialize time (see §Auto-numbering).

### Release

A named horizontal band that cuts across all activities.

| Field | Type | Notes |
|-------|------|-------|
| `title` | `string` | **Identity / key.** Non-empty. Stored without any `R{n}.` prefix. Referenced by `### title` headings in activities (FR-018). |
| `subtitle` | `string \| null` | Optional text after ` - ` on the release list line. |
| `order` | `number` | Position in `# Releases` (0-based). Drives the displayed `R{n}` (n = order+1, global). |

**Validation**: `title` MUST be unique within the map; duplicate titles → `Diagnostic` and the
later one is treated as malformed (spec Edge Cases). `title` MUST NOT contain a newline.

### Activity

A backbone item (high-level user goal). A `##` heading under `# Activities`.

| Field | Type | Notes |
|-------|------|-------|
| `title` | `string` | Display label. Non-empty. Stored without any Roman-numeral prefix. |
| `order` | `number` | Backbone position (0-based, left→right). Drives the displayed Roman numeral. |
| `cells` | `Map<releaseTitle, Card[]>` | Cards grouped by release name. Sparse: only releases the activity actually has cards in are present (clarified). |

**Validation**: an activity referencing a `### title` not found in `releases` produces a
`Diagnostic`; those cards are kept and surfaced as "unrecognized release" rather than dropped
(FR-012).

**Addressing**: an activity is identified by its **backbone position** (`order` / `activityIndex`),
never by `title`. Two activities may share the same `title` (spec Edge Cases — Duplicate names) and
each stays individually addressable. Mutation helpers take `activityIndex`, not the title.

### Card

A unit of work under one activity within one release. A `####` heading.

| Field | Type | Notes |
|-------|------|-------|
| `title` | `string` | Card label (the `####` heading text, minus any `{n}.` prefix). Non-empty. May contain inline links. |
| `body` | `string` (raw Markdown) | Content between this `####` heading and the next heading of level ≤4. May be empty. Preserved verbatim; surfaced on card open (FR-017). |
| `order` | `number` | Position within its activity×release cell (0-based, top→bottom). Drives the displayed `{n}` (restarts per cell). |
| `activityTitle` | `string` | Owning activity title (denormalized for display only; the addressable key is the activity's `activityIndex`, since titles may duplicate). |
| `releaseTitle` | `string` | Owning release name (the cross-cutting key). |

**Validation**: `title` non-empty and newline-free. Inline links inside `title`/`body` are
preserved and rendered via `MarkdownRenderer` (FR-010).

### Diagnostic

A non-fatal parse issue surfaced in the view (graceful malformed handling, FR-012).

| Field | Type | Notes |
|-------|------|-------|
| `severity` | `'warning' \| 'error'` | All map-load issues are non-fatal warnings in v0.1. |
| `message` | `string` | Human-readable explanation. |
| `line` | `number \| null` | Source line (1-based) if known. |

## Relationships

- `StoryMap` 1 ──< N `Release` (ordered, declared once).
- `StoryMap` 1 ──< N `Activity` (ordered backbone).
- `Activity` 1 ──< N `Card`, partitioned by `releaseTitle` into cells.
- `Card.releaseTitle` references `Release.title` by **name** (not index). A card's release is
  resolved by matching `releaseTitle` against `releases[].title`.

## Auto-numbering (derived, not stored)

Auto-numbers are **presentation derived from `order`**, written into headings on save and stripped
on parse (FR-019–022). They are never part of a stored identity, so they cannot affect referencing.

| Element | Scheme | Source of n | Example |
|---------|--------|-------------|---------|
| Activity | Roman numeral | backbone order (`order+1`) | `## I. Enter & orient` |
| Release group (`###`) | `R{n}.` | **global** release order (`order+1`) | `### R1. Walking skeleton` |
| Story card | `{n}.` | order **within its activity×release cell** (restarts per cell) | `#### 1. Start the game` |
| Release declaration (`# Releases` list) | arabic `N.` (existing ordered list) | list order | `1. Walking skeleton - …` |

Rules:
- **Strip on parse**: a recognized prefix is removed to yield the clean `title`; an unrecognized
  or absent prefix means the heading is already clean (hand-authored files load fine).
- **Recompute on mutation**: add/delete/reorder triggers a full renumber; identities are untouched
  (FR-021).
- **Determinism**: `format(order)` then `strip` is the identity, making round-trip (FR-022)
  unit-testable. Logic lives in the pure `numbering.ts` module.
- **v1**: always on. Toggle + per-map overrides (start index, step like `0.1`) deferred.

## State & lifecycle

The model is stateless data; mutations happen in `interactions.ts`:

| Operation | Effect | Requirement |
|-----------|--------|-------------|
| Edit title (release/activity/card) | Replace `title`; for a release, the rename does not need to touch cards (they key by the new name only after re-serialize — rename updates both the declaration and the matching `###` headings in one operation). | FR-004 |
| Edit card body | Replace `Card.body`. | FR-017 |
| Add release / activity / card | Insert with `order` appended; a new card requires an `activityIndex` + release context. | FR-007 |
| Delete release / activity / card | Remove node and contained cards after confirmation. Activities/cards are targeted by position (`activityIndex` / cell `order`); deleting a release removes its `###` groups across activities. | FR-008 |
| Reorder | Reassign `order` within the relevant collection (cell / backbone / release list). | FR-009 |

After any mutation the view calls `requestSave()`, which triggers `serializer.serialize(model)`
→ `TextFileView` writes the file. External file changes re-`parse` into a fresh model (FR-013).

## Mapping to Markdown (summary)

See [contracts/markdown-format.md](./contracts/markdown-format.md) for the authoritative grammar.

```text
Release.title/subtitle   ⇄  "N. {title} - {subtitle}"     under  # Releases
Activity.title           ⇄  "## {Roman}. {title}"          under  # Activities
release group            ⇄  "### R{n}. {Release.title}"    under an activity
Card.title               ⇄  "#### {n}. {title}"
Card.body                ⇄  raw lines until next heading ≤ level 4
```

The Roman / `R{n}` / `{n}` prefixes are added on write and removed on read by `numbering.ts`; the
arrows are exact inverses for any conformant file (FR-022).
