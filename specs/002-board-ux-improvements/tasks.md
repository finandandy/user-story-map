---
description: "Task list for 002-board-ux-improvements"
---

# Tasks: Board UX Improvements

**Input**: Design documents from `/specs/002-board-ux-improvements/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/markdown-format.md, contracts/core-api.md, quickstart.md

**Tests**: Included for the pure `src/core/` module only — the plan and `contracts/core-api.md` explicitly require Vitest coverage for the activity-body + icon parse/serialize/round-trip (the sole format change). All view/interaction changes (inline edit, modal, resize, hover "+", icon picker) have no pure-core surface and are validated manually via `quickstart.md`.

**Organization**: Tasks are grouped by user story (US1–US5) in priority order so each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 (Setup / Foundational / Polish carry no story label)
- Paths are repo-root relative (flat Obsidian-plugin layout: `src/core/`, `src/view/`, `tests/core/`)

## Stack & key rules

TypeScript + Obsidian API, esbuild bundle, Vitest for `src/core/`. `src/core/` imports nothing from `obsidian` and owns the Markdown round-trip; all Obsidian coupling lives in `src/view/`. Auto-numbers are position-derived presentation (stripped on parse, written on save), never identity. Card width is view-only session state and is **never** written to the file (FR-024). Lucide is bundled in Obsidian (`setIcon`/`getIconIds`) — no new runtime dependency; custom SVG is sanitized before store/render (FR-017).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean, green baseline before changing anything.

- [X] T001 Verify baseline: run `npm install`, `npm run test` (parser/serializer/numbering/roundtrip all green), and `npm run dev` (esbuild produces `main.js`); open `fixtures/the-knight.md` in the dev vault and confirm it renders as a board with no diagnostics banner.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reusable view-layer primitives that multiple stories build on. No format change here (the only format change is icons, in US5).

**⚠️ CRITICAL**: US1 and US4 both create-into-edit and US3's resize must coexist with the edit/reorder gestures, so these primitives must exist first.

- [X] T002 Add a reusable inline-edit primitive `editInline(el, initialValue, { onCommit, onCancel })` in `src/view/interactions.ts`: swaps the label for a focused text input, Enter/blur commits, Escape cancels, and it edits only the supplied value (never the auto-number prefix). Consumed by US1 (create + click-to-edit) and US4.
- [X] T003 Add a transient/draft apply path on `src/view/StoryMapView.ts`: `applyTransient(model)` re-renders from a model **without** calling `requestSave`, plus `commitDraft()` / `discardDraft()` helpers, so a not-yet-named new node never touches the file (FR-002). Wire `setViewData` to clear any pending draft on (re)load.

**Checkpoint**: Inline-edit and no-save draft plumbing exist — user stories can begin.

---

## Phase 3: User Story 1 - Create and rename cards directly on the board (Priority: P1) 🎯 MVP

**Goal**: Creating any node drops straight into focused inline title editing; single-clicking a title edits it; the auto-number renders inline with the title as one continuous label.

**Independent Test**: Add an activity, a release, and a story card and confirm each opens already in focused title edit; click an existing title, rename, Enter, and confirm board + Markdown both update with the auto-number preserved; start a card and Escape/blur empty and confirm the file is byte-unchanged.

### Implementation for User Story 1

- [X] T004 [P] [US1] Render each node's auto-number inline with its title as a single `.usm-card-label` element (e.g. `I. Enter & orient`, `R1. …`, `1. …`) in `src/view/card.ts` and the activity/release headers in `src/view/board.ts`, with the label style added to `styles.css` (FR-004, SC-003).
- [X] T005 [US1] Single-click a node title → `editInline` (T002) in `src/view/card.ts`; on commit call `renameActivity` / `renameRelease` / `editCard` then `requestSave`; Escape leaves board and file unchanged; only the title portion changes, never the number prefix (FR-003, FR-005).
- [X] T006 [US1] Create-into-edit in `src/view/board.ts` + `src/view/StoryMapView.ts`: the existing add controls create the node via `addActivity` / `addRelease` / `addCard` with an **empty** title, applied transiently (T003), then immediately open it in inline edit with focus — no intermediate empty-card step (FR-001, SC-001).
- [X] T007 [US1] Empty-title discard in `src/view/interactions.ts` + `src/view/StoryMapView.ts`: committing or blurring a draft with an empty title discards it and writes nothing; a non-empty commit persists via `rename*` / `editCard` (FR-002).
- [X] T008 [US1] Gesture distinction in `src/view/interactions.ts`: a pointer gesture that begins a drag-to-reorder must not also trigger inline title edit (click vs. drag threshold) (FR-018).

**Checkpoint**: US1 fully functional and independently testable (quickstart S1).

---

## Phase 4: User Story 2 - Edit a card's title and details in a focused modal (Priority: P2)

**Goal**: A per-card pencil opens a two-field Title/Details modal; saving writes title→heading and details→body with round-trip stability; cancel changes nothing.

**Independent Test**: Open a story card's pencil modal, confirm exactly two fields with Details pre-populated from the body, change both and Save, confirm the file's heading + body update and reopening shows the changes; Cancel another card and confirm no change; follow an internal link from the rendered Details.

### Implementation for User Story 2

- [X] T009 [US2] Add a per-card pencil (edit) affordance, revealed on hover/focus-visible, in `src/view/card.ts` with styling in `styles.css`; activating it opens the edit modal (FR-006, SC-008).
- [X] T010 [US2] Implement the focused modal (Obsidian `Modal`) in `src/view/card.ts` showing exactly two text fields — **Title** and **Details** — with Details pre-populated from the node's existing body content; leave a slot so the activity edit flow (T029) can mount its icon selector alongside the two text fields without making them three (FR-007).
- [X] T011 [US2] Wire modal Save → `editCard` / `rename*` writing title→heading and details→body via `requestSave`, preserving all unmanaged file content; Cancel discards all changes (FR-008, SC-004).
- [X] T012 [US2] Ensure internal links contained in the Details render and remain navigable from the board (links followed from the rendered details, not by clicking the title) in `src/view/card.ts` (FR-019, Edge Cases).

**Checkpoint**: US1 + US2 both work independently (quickstart S2).

---

## Phase 5: User Story 3 - Consistent, adjustable card and column widths (Priority: P2)

**Goal**: All activity/story cards share one width and every column is sized to it; dragging a card border resizes all cards/columns together within ~180–420px; width is view-only and resets on reopen.

**Independent Test**: Open a multi-activity map and confirm uniform column widths; add a long-text card and confirm it wraps within the shared width without widening its column; drag a border to resize all together; drag past limits and confirm clamping; reopen and confirm default width restored with the file byte-unchanged.

### Implementation for User Story 3

- [X] T013 [P] [US3] Introduce a `--usm-card-width` CSS variable (default 240px) applied to all cards and grid columns in `styles.css` and `src/view/board.ts`, so content wider than the card wraps/is contained rather than widening the column, and every column equals the shared width (FR-009, FR-010, SC-005).
- [X] T014 [US3] Add `makeResizable` in `src/view/interactions.ts`: a left/right card-border drag handle (native pointer events) that updates `--usm-card-width` on the view, clamped to ~180–420px; the resize cursor/affordance appears only on the border (FR-022, FR-023, SC-009).
- [X] T015 [US3] Gesture isolation in `src/view/interactions.ts`: border-resize must not trigger inline title edit (FR-003) or drag-to-reorder (FR-018) — the three gestures stay distinct (FR-025).
- [X] T016 [US3] Hold the width as session-only state on `src/view/StoryMapView.ts` and reset it to the default in `setViewData` (reopen/external load); never write it to the file or `data.json` (FR-024).

**Checkpoint**: US1–US3 all work independently (quickstart S3).

---

## Phase 6: User Story 4 - Add an activity with a hover-revealed "+" card (Priority: P3)

**Goal**: Hovering the backbone row reveals a blank "+" card at its right end; activating it appends an activity that opens directly into title edit (US1); it's hidden at rest but reachable without hover.

**Independent Test**: Confirm no "+" card at rest; hover the backbone row and confirm a "+" card at the right end that disappears on mouse-out; activate it and confirm a new activity is appended and enters focused title edit.

### Implementation for User Story 4

- [X] T017 [P] [US4] Render a blank "+" add-activity card at the right end of the backbone row in `src/view/board.ts`, hidden in the resting state and revealed on row hover, with styling in `styles.css` (FR-011, FR-012, SC-006/SC-008).
- [X] T018 [US4] Activating the "+" card calls `addActivity(map, "")` and immediately enters inline title edit, reusing the US1 create-into-edit path (T006), in `src/view/board.ts` (FR-001, FR-011).
- [X] T019 [US4] Keep the add-activity affordance (and the per-card pencil) reachable without hover for touch/no-hover devices — e.g. the always-present top "+ Activity" control and focus-visible reveal — in `src/view/board.ts` + `styles.css` (FR-012, Edge Cases).

**Checkpoint**: US1–US4 all work independently (quickstart S4).

---

## Phase 7: User Story 5 - Give an activity an icon (Priority: P3)

**Goal**: Adding/editing an activity can assign an optional Lucide or custom-SVG icon, persisted as a stripped `icon:` field at the top of the activity body; activities without an icon render cleanly. This is the only story touching the Markdown format and `src/core/`.

**Independent Test**: Edit an activity, pick a Lucide icon, Save, reopen, and confirm it persists with an `icon:` line as the first body line; repeat with a custom SVG (and confirm an unsafe SVG is rejected/sanitized); confirm a no-icon activity renders with no placeholder gap; confirm renaming keeps the icon and deleting removes it.

### Tests for User Story 5 (core format — write first, ensure they FAIL) ⚠️

- [X] T020 [P] [US5] Parser tests in `tests/core/parser.test.ts`: activity body captured verbatim; a leading `icon:` line stripped into `Activity.icon` for both lucide (`icon: compass`) and custom-svg (`icon: <svg…>`); an unrecognized/odd `icon:` value leaves `icon: null` and keeps the line in `body` (F16/F17/F19).
- [X] T021 [P] [US5] Serializer tests in `tests/core/serializer.test.ts`: `icon:` line + preserved body re-emitted in canonical shape after the `##` heading and before the `###` groups; a cleared icon omits the line (no placeholder) (format F16; spec FR-015, FR-016).
- [X] T022 [P] [US5] Round-trip test in `tests/core/roundtrip.test.ts`: an extended fixture containing an activity with an `icon:` field **and** non-empty body round-trips byte-for-byte (`serialize(parse(x)) === x`) (F20, FR-021).
- [X] T023 [P] [US5] New `tests/core/icon.test.ts`: `setActivityIcon` set then clear by `activityIndex`; `isLikelyUnsafeSvg` flags `<script>`/`<foreignObject>`/`on*=` handlers/`javascript:`/external `href` and passes a clean SVG; parse↔serialize icon symmetry for lucide and custom-svg.

### Implementation for User Story 5

- [X] T024 [US5] Extend the model in `src/core/model.ts`: add `body: string` and `icon: ActivityIcon | null` to `Activity`; add the `ActivityIcon` discriminated union (`lucide` | `custom-svg`); add pure `setActivityIcon(map, activityIndex, icon)` (returns a new map; `null` clears); add the pure `isLikelyUnsafeSvg(svg)` guard (no `obsidian` import).
- [X] T025 [US5] Extend `parse` in `src/core/parser.ts`: capture the activity body (lines between `##` and the first `###`/next heading) verbatim into `Activity.body`; if the first non-blank line matches `^icon:\s*(.+)$`, strip it into `Activity.icon` (`<…>` ⇒ `custom-svg` after `isLikelyUnsafeSvg` rejection/sanitization, else `lucide`); unrecognized value ⇒ `icon: null`, line kept; never throw (F16/F18/F19).
- [X] T026 [P] [US5] Extend `serialize` in `src/core/serializer.ts`: after `## {Roman}. {title}`, emit `icon: {value}` when an icon is set, then the preserved `Activity.body`, then the `###` release groups; omit the `icon:` line entirely when no icon (§8.4).
- [X] T027 [P] [US5] Extend `fixtures/the-knight.md` (and the mirrored `tests/test_vault/.../the-knight.md`) to include one activity with a Lucide `icon:` field and one activity with non-empty body text, so the round-trip test (T022) exercises §8.
- [X] T028 [US5] New `src/view/icon.ts`: render an `ActivityIcon` (Lucide via `setIcon`; custom SVG via a DOM-based sanitizer, FR-017); a Lucide picker that browses/searches `getIconIds` (FR-014) and a custom-SVG input; an unknown Lucide name renders a neutral fallback (Edge Cases).
- [X] T029 [US5] Mount the icon selector in the activity edit modal (the T010 slot) in `src/view/board.ts` + `src/view/card.ts`: assign/clear an icon → DOM-sanitize → normalize a custom SVG to a single line (so it occupies one `icon:` line, markdown-format §8.4) → `setActivityIcon` → `requestSave`; render the assigned icon on the activity card via `src/view/icon.ts`, with no placeholder when absent; add the icon slot style to `styles.css` (FR-013/FR-015/FR-016).

**Checkpoint**: All five stories independently functional (quickstart S5 + core test gate green).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Theme/keyboard, clean unload, and full validation across all stories.

- [X] T030 [P] Theme + keyboard pass (FR-020): confirm the inline editor, two-field modal, icon picker, hover "+" card, and resize handle use theme CSS variables (no hardcoded colors) and are fully keyboard-operable — `styles.css` + the `src/view/` surfaces.
- [X] T031 [P] Clean unload: ensure every new pointer/hover/resize listener is registered for disposal (`registerDomEvent` / stored handlers) in `src/view/StoryMapView.ts` + `src/view/interactions.ts`, so unload leaks nothing.
- [~] T032 Run the full core gate `npm run test` (parser/serializer/roundtrip/icon all green), then execute `quickstart.md` S1–S5, the round-trip regression, and the theming/keyboard checks in a live vault; confirm width changes leave the file byte-unchanged.
  - **Automated portion DONE**: `npm run test` → 81/81 green (incl. the new icon/body parse, serialize, and round-trip cases); `tsc --noEmit` clean; `esbuild` production bundle builds (`main.js`). CSS audited for hardcoded colors (none).
  - **Manual portion PENDING (requires a live Obsidian vault)**: quickstart S1–S5, theme switch, and the live resize→byte-unchanged check have not been executed in this environment and should be run by the user.
- [X] T033 [P] Update `CLAUDE.md` / any docs if file paths or behaviors drifted from the plan during implementation.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; **blocks** US1 and US4 (create-into-edit) and is assumed-present by US3's gesture isolation.
- **US1 (Phase 3)**: depends on Foundational. MVP.
- **US2 (Phase 4)**: depends on Foundational; independent of US1 (its own pencil/modal surface).
- **US3 (Phase 5)**: depends on Foundational; independent of US1/US2.
- **US4 (Phase 6)**: depends on Foundational **and** reuses US1's create-into-edit path (T006/T018).
- **US5 (Phase 7)**: depends on Foundational; self-contained (the only `src/core/` + format change). Independent of US1–US4.
- **Polish (Phase 8)**: depends on all targeted stories being complete.

### Within each user story

- US5: write the core tests (T020–T023) and confirm they FAIL before the model/parser/serializer implementation (T024–T027); model field/types (T024) before parser/serializer that populate them.
- All stories: persist only on a non-empty commit; verify byte-stable round-trip after any change.

### Parallel opportunities

- US5 core tests **T020, T021, T022, T023** touch different files → run in parallel.
- US5 impl **T026** (serializer) and **T027** (fixture) are different files → parallel; **T024** (model) precedes the parser/serializer that depend on the new types.
- Across stories: once Foundational is done, **US2, US3, US5 can proceed in parallel**; US1 then US4 (US4 reuses US1's path).
- Label-only/independent tasks **T004, T013, T017** open their stories on different files; Polish **T030, T031, T033** are parallel.

---

## Parallel Example: User Story 5 core tests

```bash
# Write all four core test files first (they must fail before T024–T027):
Task: "Parser tests for activity body + icon stripping in tests/core/parser.test.ts"   # T020
Task: "Serializer tests for icon line + body emission in tests/core/serializer.test.ts" # T021
Task: "Round-trip byte-for-byte test in tests/core/roundtrip.test.ts"                    # T022
Task: "setActivityIcon + isLikelyUnsafeSvg + symmetry in tests/core/icon.test.ts"        # T023
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (blocks stories) → 3. Phase 3 US1 → 4. **STOP and validate** quickstart S1 → demo. Direct create-and-rename is the largest standalone usability win.

### Incremental delivery

Setup + Foundational → US1 (MVP, S1) → US2 (S2) → US3 (S3) → US4 (S4) → US5 (S5 + core gate). Each story is a shippable increment that doesn't break the previous ones; the round-trip guarantee is re-verified after each.

### Parallel team strategy

After Foundational: Dev A → US1 then US4; Dev B → US2; Dev C → US3; Dev D → US5 (core format, isolated in `src/core/` + `src/view/icon.ts`).

---

## Notes

- Tests are scoped to `src/core/` only (the single format change); all view/interaction work is validated via `quickstart.md`.
- [P] = different files, no dependency on an incomplete task.
- Card width never touches the file (FR-024); commit only persists non-empty titles (FR-002).
- Custom SVG is sanitized before store **and** render (FR-017/F18).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
