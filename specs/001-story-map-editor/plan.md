# Implementation Plan: Story Map Editor

**Branch**: `001-story-map-editor` (feature directory; repo is not a git repo) | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-story-map-editor/spec.md`

## Summary

Build a v0.1 Obsidian plugin that renders a Markdown user story map as a clean, theme-aware
visual board and lets users view, edit, and build maps while the Markdown file remains the
single source of truth. The map format is fixed (clarified in the spec): a `# Releases` section
declares release bands once, and a `# Activities` section holds each activity (`##`) with
release sub-groups (`###`, referenced by name) containing story-card headings (`####`) that may
carry body detail.

Headings carry position-derived **auto-numbers** written into the file on save — activities as
Roman numerals (`## I. ...`), release groups as `R{n}` (`### R1. ...`), and cards as `{n}`
restarting per cell (`#### 1. ...`). The parser strips these prefixes so the underlying identity
stays clean; numbers are recomputed on add/delete/reorder. v1 is always-numbered (toggle and
per-map overrides deferred).

Technical approach: a pure, Obsidian-independent **core** module (model + parser + serializer)
guarantees round-trip stability — including deterministic numbering — and is unit-tested in
isolation; a thin **view** layer extends Obsidian's `TextFileView` to render the board with
vanilla DOM using Obsidian's theme CSS variables, and a per-file frontmatter marker plus a
view-menu toggle decide when a file opens as a board (mirroring the established Obsidian Kanban
plugin pattern). No heavy UI framework; the build is a single esbuild bundle.

## Technical Context

**Language/Version**: TypeScript 5.x, compiled to an ES2018 CommonJS bundle (`main.js`)

**Primary Dependencies**: `obsidian` (API type definitions only, provided at runtime by the app);
esbuild (bundler). Zero non-trivial runtime dependencies (constitution: Lightweight). Drag-reorder
uses native pointer/HTML5 DnD; a small vendored helper is allowed only if native proves
insufficient (decision recorded in research.md).

**Storage**: Markdown files in the user's vault, accessed via the Obsidian Vault/`TextFileView`
APIs (source of truth). Minimal plugin settings persisted via `loadData`/`saveData` (`data.json`)
— view preferences only, never map content.

**Testing**: Vitest for the pure core module (parser, serializer, round-trip, detection) — these
require no Obsidian runtime. UI is verified manually in a development vault via quickstart.md.

**Target Platform**: Obsidian desktop-primary (v1.x, `minAppVersion` declared in `manifest.json`).
`isDesktopOnly: false` — rendering is DOM/CSS-variable based, so the plugin loads on mobile;
mobile drag-reorder is best-effort for v0.1 and not a release gate.

**Project Type**: Single project — Obsidian plugin (flat plugin layout at repo root).

**Performance Goals**: Open + render a typical map (tens of cards) in < 2 s (SC-001); large maps
(hundreds of cards) stay interactive with no perceptible freeze (SC-007); no startup blocking
(constitution II — view work is lazy, only on file open).

**Constraints**: Markdown is the single source of truth; round-trip stable (with deterministic
auto-numbering applied); non-destructive (unmanaged content — frontmatter, prose, other headings
— preserved verbatim); auto-numbers are derived presentation, never identity, and are stripped on
parse; theme-aware (no hardcoded colors); offline; no telemetry; minimal dependencies; clean
unload (no leaked listeners/views).

**Scale/Scope**: Single-file maps; up to a few releases, ~6–12 activities, and hundreds of cards
per map. Three user stories (view P1, edit P2, build P3).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan complies | Status |
|---|-----------|------------------------|--------|
| I | Markdown as the Single Source of Truth | Pure core serializer is the only writer; round-trip tests are mandatory (FR-006/FR-022); unmanaged content preserved by segment-preserving rewrite (FR-005); auto-numbers are derived and stripped on parse so identity is never corrupted (FR-019–021); format uses native headings only. | ✅ PASS |
| II | Lightweight & Performant | Single esbuild bundle; zero non-trivial runtime deps; view work is lazy (on file open only); native DnD before any library. | ✅ PASS |
| III | Reusable & Project-Agnostic | Generic frontmatter marker; zero-config defaults; no project/vault-specific assumptions; files portable as-is (FR-015). | ✅ PASS |
| IV | Well-Designed, Minimal UX | Board mirrors the approved mockup; destructive actions confirmed (FR-008); minimal control surface; release/activity/card legible at a glance. | ✅ PASS |
| V | Obsidian-Native Integration | `TextFileView` lifecycle + `registerView`; theme CSS variables (already used in the mockup HTML); internal links via `MarkdownRenderer`; resources released on unload. | ✅ PASS |

**Result**: No violations. Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-story-map-editor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── markdown-format.md   # Canonical file-format grammar + round-trip rules
│   └── core-api.md          # Pure core module public interface
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
manifest.json            # Obsidian plugin manifest (id, name, minAppVersion, isDesktopOnly)
package.json             # Scripts + dev deps (typescript, esbuild, vitest, obsidian types)
tsconfig.json
esbuild.config.mjs       # Bundles src/main.ts -> main.js
vitest.config.ts         # Vitest config scoped to tests/core/ (node environment)
styles.css               # Board styling via theme CSS variables (derived from mockup HTML)
versions.json            # minAppVersion mapping

src/
├── main.ts              # Plugin entry: registerView, commands, settings, frontmatter detection
├── settings.ts          # Settings tab + defaults (view preferences only)
├── core/                # PURE, Obsidian-independent — unit-tested in isolation
│   ├── model.ts         # Types: StoryMap, Release, Activity, Card, Diagnostic + pure mutation helpers
│   ├── parser.ts        # Markdown text -> StoryMap; strips auto-number prefixes
│   ├── serializer.ts    # StoryMap -> Markdown text (round-trip safe); writes auto-numbers
│   ├── numbering.ts     # Pure: derive Roman / R{n} / per-cell {n}; strip & format prefixes
│   └── detect.ts        # Frontmatter marker + structural map detection
└── view/                # Obsidian-coupled UI
    ├── StoryMapView.ts  # TextFileView subclass: getViewData/setViewData, toggle, save
    ├── board.ts         # Renders backbone + release bands + card grid (vanilla DOM)
    ├── card.ts          # Card element: title render (MarkdownRenderer), open/edit detail
    └── interactions.ts  # Add/delete/edit/reorder handlers -> mutate model -> requestSave

tests/
└── core/
    ├── parser.test.ts
    ├── serializer.test.ts
    ├── numbering.test.ts     # Roman/R{n}/per-cell {n}; strip-then-format is identity
    ├── roundtrip.test.ts     # fixtures in -> serialize(parse(in)) === in
    └── detect.test.ts

fixtures/
└── the-knight.md        # Sample map (from template mockup) used by tests + quickstart
```

**Structure Decision**: Single flat Obsidian-plugin project at the repository root (the standard
Obsidian sample-plugin layout). The defining choice is the hard split between `src/core/` (pure,
testable, no `obsidian` imports — the round-trip guarantee lives here) and `src/view/` (all
Obsidian API coupling). This directly serves Constitution Principle I (a single audited writer)
and makes the round-trip requirement unit-testable without an Obsidian runtime.

## Complexity Tracking

> No constitution violations — section intentionally empty.
