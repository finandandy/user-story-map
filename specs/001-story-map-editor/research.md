# Research: Story Map Editor

**Feature**: 001-story-map-editor | **Date**: 2026-06-13 | **Phase**: 0

This document resolves the open technical decisions implied by the Technical Context. Each entry
records the Decision, Rationale, and Alternatives considered. No `NEEDS CLARIFICATION` markers
remain after this phase.

---

## R1. How to render a whole-file Markdown map as a custom view

**Decision**: Extend Obsidian's `TextFileView` and register it with `registerView(VIEW_TYPE, ...)`.
A file opens as a board when its YAML frontmatter contains the marker key (`story-map: true`);
otherwise it opens in the normal Markdown editor. Provide (a) a view-menu "Open as story map /
Open as Markdown" toggle and (b) a command + ribbon action that adds the marker and opens the
board.

**Rationale**: The clarified format makes the *entire file* the map (`# Releases` + `# Activities`
at the top level), so a per-file view is correct — not an embedded code block. `TextFileView`
gives the exact lifecycle we need: `getViewData()`/`setViewData()` for serialize/parse, built-in
dirty tracking + `requestSave()`, and correct handling of external file changes (FR-013). Gating
on a frontmatter marker is the proven Obsidian Kanban-plugin approach: it avoids hijacking
arbitrary notes, is human-readable, and travels with the file (portability, FR-015).

**Alternatives considered**:
- *`registerMarkdownCodeBlockProcessor` (```story-map fenced block)* — rejected: the map is the
  whole file, not a fragment; would fight the chosen format and complicate round-trip.
- *`registerExtensions` for a custom extension (`.usm`)* — rejected: breaks "plain Markdown,
  readable without the plugin" (Principle I) and Obsidian linking.
- *Markdown post-processor in reading mode* — rejected: read-only; cannot host editing/DnD and
  does not own save.

## R2. Markdown parsing & serialization strategy (round-trip safe)

**Decision**: Hand-written, heading-structured parser/serializer in `src/core/`, with **no AST
library**. Parse the file into ordered segments; identify the `# Releases` and `# Activities`
managed sections by their top-level headings; capture everything else (frontmatter, prose, other
top-level content, blank-line layout) as verbatim "preserved" segments. The model stores each
card's body as raw text. On save, regenerate only the managed sections in place and splice them
back between the preserved segments.

On parse, each heading's auto-number prefix (see R9) is split off into a separate step so the
model stores the clean identity; on serialize, numbers are re-applied from position.

**Rationale**: The format is small and regular (two top-level sections, a numbered list, and
nested headings), so a focused parser is lighter than pulling in `remark`/`unified` (Principle II)
and gives us total control over byte-level round-trip stability (FR-006) and non-destructive
preservation of unmanaged content (FR-005). Round-trip is enforced by `tests/core/roundtrip.test.ts`
(`serialize(parse(x)) === x` over fixtures).

**Alternatives considered**:
- *remark/unified AST* — rejected: adds a non-trivial dependency and AST→text re-printing tends to
  normalize whitespace/formatting, threatening byte-stable round-trip without extra effort.
- *Regex-only extraction* — rejected: too fragile for nested headings + body capture and for
  preserving exact surrounding content.

## R3. Release list line grammar

**Decision**: In `# Releases`, each release is an ordered-list item: `N. Title - subtitle`, where
` - ` (space-hyphen-space) separates the **Title** (the identity/key) from an **optional**
subtitle. List order defines release order. Inside activities, a release group heading
`### Title` must match a declared release Title exactly (after trimming). A card under a release
Title not present in `# Releases` is flagged as malformed (surfaced, not dropped — FR-012).

**Rationale**: Matches the format the user supplied directly and the mockup's "Walking skeleton —
thinnest playable spine" band labels. Name-as-key (clarified, FR-018) means reordering/renumbering
releases never reassigns cards. The ` - ` delimiter is the convention the user wrote.

**Alternatives considered**:
- *Reference by ordinal (`### Release 1`)* — rejected in clarification: brittle under reordering.
- *Subtitle on a second line / blockquote* — rejected: less compact, more parsing surface; the
  single-line `Title - subtitle` is what the user authored.

## R4. Detecting whether a file is a story map

**Decision**: Primary signal = frontmatter marker `story-map: true`. The command "Create/Open as
story map" inserts the marker (and a starter `# Releases`/`# Activities` skeleton if absent). A
marked file with no recognizable map content renders the empty/initialize state (FR-011) rather
than erroring.

**Rationale**: Explicit, cheap, and non-destructive; never auto-hijacks ordinary notes. The
marker is the single managed frontmatter key; all other frontmatter is preserved (FR-005).

**Alternatives considered**:
- *Pure structural detection (presence of `# Releases` + `# Activities`)* — rejected as the
  primary trigger: would risk reinterpreting unrelated notes; kept only as a soft hint when
  offering to convert a file.

## R5. Card content & internal links

**Decision**: Render card titles (and, when opened, bodies) with Obsidian's
`MarkdownRenderer.render(...)` inside the card element, so `[[wikilinks]]` and `[md](links)` render
and navigate natively (FR-010). A card body is the Markdown between a `####` card heading and the
next heading of level ≤ 4; it is preserved verbatim and surfaced on card open (FR-017).

**Rationale**: Reuses Obsidian's own link resolution and theming — native integration (Principle V)
— instead of re-implementing link handling. Keeps cards visually a title while supporting depth.

**Alternatives considered**:
- *Plain-text card titles* — rejected: loses linking, a core constitution value.
- *Fully rendering all bodies inline on the board* — rejected for v0.1: hurts large-map
  performance and legibility; bodies render on open instead.

## R6. Reorder (drag-and-drop) interaction

**Decision**: Implement reorder with native HTML5/pointer drag-and-drop in `interactions.ts`,
operating on the model (move card within an activity×release cell; reorder activities; reorder
releases) and then `requestSave()`. No drag library in v0.1. Reorder is part of US3 (P3), so it
ships after view/edit. If native DnD proves unreliable across platforms during implementation, a
small vendored helper may be added — recorded here as the only contingent dependency.

**Rationale**: Keeps the bundle lean (Principle II) and avoids a dependency for a P3 capability.
Native DnD is sufficient for column/grid reordering.

**Alternatives considered**:
- *SortableJS* — small and robust, but an avoidable runtime dependency for v0.1; held in reserve.

## R7. Build & test tooling

**Decision**: esbuild (single-bundle `main.js`, the Obsidian sample-plugin standard) for builds;
Vitest for the pure `src/core/` modules. Core modules import nothing from `obsidian`, so they run
under Node in tests with zero mocking. UI is validated manually per `quickstart.md` in a dev vault.

**Rationale**: esbuild is the de-facto Obsidian standard (fast, zero-config). Vitest gives fast,
isolated unit tests for the round-trip guarantee — the highest-risk, most-testable surface. The
pure/coupled split (Principle I) is what makes this possible without an Obsidian test harness.

**Alternatives considered**:
- *Jest* — heavier/ slower startup than Vitest for a TS project; no advantage here.
- *Headless Obsidian UI testing* — no first-class support; not worth the complexity for v0.1.

## R8. Theming & styling

**Decision**: All board styling in `styles.css` uses Obsidian theme CSS variables
(`--color-background-primary`, `--color-text-secondary`, `--border-radius-md`, etc.), exactly as
the brainstorm mockup HTML already does. Accent colors for activity headers and release-number
badges derive from theme variables (with a restrained fallback), never hardcoded hex that breaks
dark mode.

**Rationale**: The mockup is already authored against these variables, so it drops in with native
theming (Principle V) and zero per-theme work. Honors "respect the user's active theme".

**Alternatives considered**:
- *Hardcoded palette from the mockup (e.g. `#E1F5EE`)* — rejected: breaks under dark/custom
  themes; only acceptable as a derived fallback.

## R9. Auto-numbering: storage, derivation, and round-trip

**Decision**: Numbers are **persisted into heading text** but are **derived from position**, not
stored as identity. A pure `numbering.ts` module owns three responsibilities: (1) **strip** an
auto-number prefix from a heading on parse to recover the clean identity; (2) **format** a number
for a given element from its position on serialize; (3) define the schemes — activities → Roman
numerals (`I.`, `II.`, …) by backbone order; release groups → `R{n}.` by **global** release order;
cards → `{n}.` restarting **per activity×release cell**. The `# Releases` declaration keeps its
existing arabic ordered-list (`N.`); the `R{n}` prefix appears only on `###` group headings.
Numbers are recomputed and rewritten on every add/delete/reorder. v1 is always-on; a toggle and
per-map overrides (start index, custom step such as tenths `0.1`) are explicitly deferred.

**Rationale**: Matches the user's directive that headings "should read" `## I. …` / `### R1. …` /
`#### 1. …` (numbers in the file) while preserving the earlier name-as-key decision (FR-018): the
parser strips `R1. ` so the release key stays "Walking skeleton" and reordering never reassigns
cards (FR-020/021). Keeping derivation pure and position-based makes numbering deterministic, so
round-trip (FR-022) is a unit-testable property (`strip` then `format` from the same position is
the identity). Isolating it in one module keeps `parser.ts`/`serializer.ts` simple and lets the
future toggle/overrides slot in without touching identity handling.

**Strip grammar** (per heading level):
- `## ` → optional `^([IVXLCDM]+)\.\s+` Roman prefix, then the activity name.
- `### ` → optional `^R(\d+)\.\s+` release prefix, then the release title (then ` - subtitle` per R3).
- `#### ` → optional `^(\d+(?:\.\d+)?)\.\s+` card prefix, then the card title.

A heading without a recognizable prefix is parsed as a clean title (so hand-authored,
un-numbered files still load); on next save it gains numbers (idempotent thereafter).

**Alternatives considered**:
- *Display-only numbering (Q1-B)* — rejected by the user: the file would not show numbers,
  contradicting the directive.
- *Numbers as literal title text, no stripping (Q1-C)* — rejected: reordering would change the
  identity/key and break name-based card referencing (FR-018).
- *Per-activity or global card counters (Q2-B/C)* — rejected: per-cell restart matches the
  board's visual grouping and the user's example.

---

## Resolved unknowns summary

| Technical Context item | Resolution |
|------------------------|------------|
| View mechanism | `TextFileView` + `registerView` + frontmatter marker + toggle (R1, R4) |
| Parser/serializer | Hand-written segment-preserving core, no AST lib (R2) |
| Format grammar | `N. Title - subtitle`; release-by-name (R3) |
| Card links/detail | `MarkdownRenderer`; raw body preserved, shown on open (R5) |
| Reorder | Native DnD, no library in v0.1 (R6) |
| Build/test | esbuild + Vitest on pure core (R7) |
| Theming | Obsidian CSS variables from the mockup (R8) |
| Auto-numbering | Persisted-but-derived; pure `numbering.ts` strips/formats; per-cell card counter (R9) |

All items resolved — ready for Phase 1.
