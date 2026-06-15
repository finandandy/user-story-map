# Quickstart & Validation: Board UX Improvements

**Feature**: 002-board-ux-improvements | **Date**: 2026-06-14 | **Phase**: 1

This guide validates the five user stories end-to-end against the spec's acceptance scenarios and
success criteria. The core (parse/serialize) changes are proven by Vitest; the interaction/visual
changes are validated manually in a live Obsidian vault, since they have no pure-core surface.

## Prerequisites

- The parent feature (`001-story-map-editor`) builds and runs: a story-map file (frontmatter
  `story-map: true`) opens as a board.
- Node deps installed (`npm install`); a dev vault with the plugin symlinked into
  `.obsidian/plugins/`.

## Setup

```bash
npm run test      # pure-core gate: parser/serializer/numbering/roundtrip/icon all green
npm run dev       # esbuild watch → main.js
```

In the dev vault: enable the plugin, open `fixtures/the-knight.md` (now includes an activity icon
and activity body), and confirm it opens as a board with no diagnostics banner.

## Core test gate (automated)

`npm run test` MUST pass, including the new/extended cases (contracts/core-api.md test contract):

- Activity body captured verbatim; leading `icon:` line stripped to `Activity.icon`.
- `serialize(parse(x)) === x` for an activity with an `icon:` field **and** body (round-trip, F20).
- Clearing an icon omits the `icon:` line; `isLikelyUnsafeSvg` rejects script/handler/`javascript:`/
  external-ref SVGs and passes a clean one.

## Manual validation scenarios

### S1 — Create and rename directly on the board (US1, P1)

1. Add an activity, a release, and a story card. **Expect**: each new card appears *already in
   title-edit mode* with the cursor focused — no extra click, no empty placeholder card (AS1, FR-001).
2. Type a title and press Enter. **Expect**: the title shows on the board and the Markdown file
   updates to match (open the file as Markdown to confirm) (AS2).
3. Single-click an existing card's title, rename it, press Enter. **Expect**: board + file both
   reflect the new title (AS2, FR-003); the auto-number is unchanged (AS5, FR-005).
4. Start a new card, then press Escape (or confirm empty). **Expect**: the draft is discarded and the
   file is **not** modified at all (AS3/AS4, FR-002) — verify the file's byte content is unchanged.
5. Inspect any card/activity/release. **Expect**: the auto-number reads inline with the title as one
   label, e.g. `I. Enter & orient`, `R1. Walking skeleton`, `1. Start the game` (AS5, FR-004) — no
   detached number element (SC-003).

**Pass**: SC-001 (one action to a focused new title), SC-002 (rename < 3 s), SC-003 (100% inline).

### S2 — Two-field edit modal (US2, P2)

1. Activate a story card's pencil affordance. **Expect**: a modal opens directly showing exactly two
   text fields — Title and Details — with no read-first step (AS1, FR-006/FR-007). (An activity's
   edit modal shows the same two text fields plus an icon selector — exercised in S5.)
2. A card with existing body. **Expect**: Details is pre-populated with that body (AS4).
3. Change both fields, Save. **Expect**: title → heading, details → body in the file, other content
   untouched, board shows the new title (AS2, FR-008). Re-open the modal: changes persist.
4. Open another card's modal, change fields, Cancel. **Expect**: neither board nor file changes (AS3).
5. A card containing an internal link: follow the link from the rendered Details. **Expect**: it
   navigates (link reachable even though clicking the title now edits it) (FR-019, Edge Cases).

**Pass**: SC-004 (title + details persist with round-trip stability).

### S3 — Consistent, adjustable widths (US3, P2)

1. Open a multi-activity map. **Expect**: every activity column is the same width (AS1, FR-010).
2. Add a card with very long text. **Expect**: the card wraps/contains within the shared width; the
   column does not widen and other columns are unaffected (AS2/AS3, FR-009).
3. Drag a card's left or right **border**. **Expect**: all cards and columns resize together (AS4,
   FR-022); the resize cursor appears only on the border (Edge Cases); dragging does **not** start a
   title edit or a reorder (FR-025).
4. Drag past the limits. **Expect**: width clamps at ~180px (min) and ~420px (max) (AS4, FR-023).
5. Close and reopen the file. **Expect**: width returns to the default and the Markdown file is
   unchanged by the resize (AS5, FR-024) — verify file bytes are identical.

**Pass**: SC-005 (uniform columns, card count irrelevant), SC-009 (resize within bounds, resets on
reopen, file untouched).

### S4 — Hover "+" add-activity card (US4, P3)

1. Board at rest, pointer off the backbone. **Expect**: no "+" add-activity card visible (AS1, FR-012).
2. Hover the activity backbone row. **Expect**: a blank "+" card appears at the right end (AS2,
   FR-011); move away → it disappears.
3. Activate the "+" card. **Expect**: a new activity is appended and immediately enters title-edit
   mode (AS3, FR-001/FR-011).
4. Touch / no-hover check: confirm the "+" affordance (and the per-card pencil) is still reachable
   without hover — e.g. the always-present top "+ Activity" control / focus-visible (Edge Cases, FR-012).

**Pass**: SC-006 (add via "+" to typing < 3 s; "+" hidden at rest), SC-008 (no resting clutter, all
affordances reachable).

### S5 — Give an activity an icon (US5, P3)

1. Edit an activity, open the icon selector, browse/search Lucide, pick an icon, Save. **Expect**:
   the icon shows on the activity card (AS1/AS3, FR-013/FR-014/FR-015).
2. Close and reopen the file. **Expect**: the icon persists — confirm the file has an `icon: <name>`
   line as the first body line under the activity heading (AS3, FR-016).
3. Repeat with a **custom SVG**. **Expect**: it renders; a malformed or unsafe SVG (e.g. containing
   `<script>` or an `onload=`) is rejected or sanitized rather than rendered as-is (AS2, FR-017,
   Edge Cases).
4. An activity with **no** icon. **Expect**: it renders cleanly with no empty placeholder gap (AS4,
   FR-015).
5. Edge cases: rename an activity → its icon stays; delete it → its icon goes with it (no leak onto
   another activity); a file with an unknown Lucide name still loads (icon omitted / neutral fallback)
   without breaking the board (Edge Cases).

**Pass**: SC-007 (Lucide or custom-SVG icon persists unchanged across close/reopen).

## Round-trip regression (all stories)

After exercising S1–S5, open the file as Markdown and re-save the board with no further edits.
**Expect**: the file is byte-for-byte unchanged (FR-021) — inline edits, modal edits, added
activities, and assigned icons all preserve the parent feature's round-trip guarantee, and width
changes left no trace.

## Theming & keyboard (cross-cutting)

- Switch between a light and a dark theme. **Expect**: inline editor, modal, icon picker, hover "+"
  card, and resize handle all follow the theme (no hardcoded colors) (FR-020).
- Operate inline edit, the modal, and the icon picker via keyboard alone. **Expect**: all reachable
  and operable (FR-020).
