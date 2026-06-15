# Data Model: Board UX Improvements

**Feature**: 002-board-ux-improvements | **Date**: 2026-06-14 | **Phase**: 1

This feature is mostly interaction/presentation and reuses the parent model
(`001-story-map-editor/data-model.md`) unchanged. It adds exactly **one** persisted concept — an
optional **activity icon** — and surfaces a small amount of **view-only state** (the shared card
width) that is deliberately *not* part of the model. As before, the pure model lives in
`src/core/model.ts`, imports nothing from `obsidian`, and is a faithful round-trippable projection
of the Markdown file (Constitution I).

## What changes

```text
Activity                       (CHANGED)
├── title                      (unchanged: clean identity, no Roman prefix)
├── order                      (unchanged: backbone position)
├── cells: Map<title, Card[]>  (unchanged)
├── body: string               (NEW: raw content between the ## heading and its first ### group,
│                                     minus the icon: line — preserved verbatim)
└── icon: ActivityIcon | null  (NEW: optional, derived from a stripped `icon:` field)

ActivityIcon                   (NEW entity)
 = { type: "lucide";  name: string }
 | { type: "custom-svg"; svg: string }   // svg is already sanitized (FR-017)
```

Everything else — `StoryMap`, `Release`, `Card`, `Diagnostic`, `CardRef`, and all the existing
mutation helpers — is unchanged.

## Entities

### Activity (changed)

A backbone item. A `##` heading under `# Activities`.

| Field | Type | Notes |
|-------|------|-------|
| `title` | `string` | Unchanged. Display label; clean identity, no Roman prefix. |
| `order` | `number` | Unchanged. Backbone position (0-based). |
| `cells` | `Map<releaseTitle, Card[]>` | Unchanged. Sparse cells keyed by release title. |
| `body` | `string` (raw Markdown) | **New.** Content between the `##` heading and the first `###` group (or next heading), **with the leading `icon:` line removed**. Preserved verbatim; empty string when absent. Closes a prior gap where this text was dropped. |
| `icon` | `ActivityIcon \| null` | **New.** Parsed from a leading `icon:` field in the body; `null` when none. Presentation only — never affects identity, ordering, or auto-numbering. |

**Validation**: `body` is opaque preserved text (not interpreted beyond stripping the `icon:` line).
A custom-SVG `icon` MUST be sanitized before it is stored (FR-017, research R15); an unparesable
`icon:` value yields `icon: null` and the raw line is kept in `body` rather than dropped (graceful,
FR-012). Addressing is unchanged: an activity is targeted by `activityIndex`, never by title.

### ActivityIcon (new)

An optional visual marker on an activity (spec Key Entities). A discriminated union:

| Variant | Field | Notes |
|---------|-------|-------|
| `"lucide"` | `name: string` | A Lucide icon id (e.g. `"compass"`), rendered with Obsidian's `setIcon`. An unrecognized name renders a neutral fallback / omits the icon without breaking the board (Edge Cases). |
| `"custom-svg"` | `svg: string` | A sanitized SVG document string. Stored and rendered as-is **after** sanitization (FR-017). |

Discriminated on write/read by a leading `<`: `icon: <svg …>` ⇒ custom SVG; otherwise a Lucide name.
Belongs to exactly one activity; deleting the activity removes it; renaming keeps it (Edge Cases).

### Card width (view-only — NOT a model entity)

The shared card/column width is **session view state**, held on the `StoryMapView` instance, *not*
in `StoryMap` and *not* persisted (FR-024). Recorded here only to make the boundary explicit.

| Aspect | Value |
|--------|-------|
| Default | 240px (within the allowed range) |
| Range | clamped to ~180px–420px (FR-023) |
| Scope | one global value for all cards + columns (FR-022) |
| Lifetime | per open; **reset to default on `setViewData`** (reopen/external load) |
| Persistence | none — never written to the file or `data.json` (FR-024) |

## Mutation helpers (additions)

All pure, return a new `StoryMap`, no I/O — consistent with the parent feature.

| Helper | Effect | Requirement |
|--------|--------|-------------|
| `setActivityIcon(map, activityIndex, icon: ActivityIcon \| null)` | Set or clear an activity's icon by backbone position. `null` clears it (serializer omits the `icon:` line). | FR-013/FR-016 |
| `addActivity(map, title)` | **Reused**, now also called with `title = ""` for the create-into-edit draft (US4/US1). | FR-001 |
| `addRelease(map, title, subtitle?)` / `addCard(map, …, title, body?)` | **Reused** with `title = ""` for drafts. | FR-001 |
| `renameActivity` / `renameRelease` / `editCard` | **Unchanged** — used to commit an inline title edit or the two-field modal. | FR-003/FR-008 |

> Draft creation calls an *add* helper with an empty title and applies it **without saving**
> (view-layer `applyTransient`, research R11); a non-empty commit then persists via `rename*`/`editCard`,
> and an empty commit removes the draft — so an empty node is never written (FR-002). The model
> helpers themselves are unchanged; the no-save behavior is a view concern.

## State & lifecycle (delta)

| Operation | Effect | Requirement |
|-----------|--------|-------------|
| Create node | Add with empty title (transient, no save) → open inline editor; non-empty commit persists, empty/cancel discards. | FR-001/FR-002 |
| Inline title edit | `rename*`/`editCard` on commit → `requestSave` → re-render; Escape/no-op writes nothing. | FR-003/FR-005 |
| Card modal save | `editCard(map, ref, { title, body })` → save. | FR-008 |
| Set/clear activity icon | `setActivityIcon` → save (icon round-trips via the `icon:` field). | FR-016 |
| Resize width | Update `--usm-card-width` on the view; **no model mutation, no save** (view-only). | FR-024 |

After any *persisted* mutation the view calls `requestSave()` → `serialize(model)` → `TextFileView`
writes the file; external changes re-`parse` into a fresh model and reset the session width.

## Mapping to Markdown (delta)

See [contracts/markdown-format.md](./contracts/markdown-format.md) §8 for the authoritative grammar.

```text
Activity.icon (lucide)     ⇄  "icon: compass"                first body line under "## {Roman}. {title}"
Activity.icon (custom-svg) ⇄  "icon: <svg …>…</svg>"          first body line under the activity heading
Activity.body              ⇄  raw lines after the icon line, until the first ### / next heading
```

The `icon:` line is stripped on read into `Activity.icon` and re-emitted on save; the remaining body
is preserved verbatim. Card width has **no** Markdown representation by design (FR-024).
