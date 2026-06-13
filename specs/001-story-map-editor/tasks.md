---
description: "Task list for Story Map Editor implementation"
---

# Tasks: Story Map Editor

**Input**: Design documents from `/specs/001-story-map-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (markdown-format.md, core-api.md), quickstart.md

**Tests**: INCLUDED. Vitest unit tests for the pure `src/core/` module are mandated by plan.md
(Testing section), contracts/core-api.md (Test contract), and quickstart.md (Automated checks).
UI is verified manually via quickstart.md, not by automated tests.

**Organization**: Tasks are grouped by user story (US1 view / US2 edit / US3 build) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)
- Exact file paths are included in every task

## Path Conventions

Single flat Obsidian-plugin project at the repository root (per plan.md "Project Structure"):
`src/core/` (pure, no `obsidian` imports), `src/view/` (Obsidian-coupled), `tests/core/`,
`fixtures/`. Config files (`manifest.json`, `package.json`, etc.) live at the repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding, build, and test tooling so any subsequent code can compile, bundle, and run.

- [X] T001 Create the plugin source tree per plan.md: empty directories `src/core/`, `src/view/`, `tests/core/` at the repo root (`fixtures/` already exists with `the-knight.md`).
- [X] T002 Create `package.json` at repo root with scripts (`build`, `dev`, `test`) and devDependencies: `typescript@5.x`, `esbuild`, `vitest`, `obsidian` (types), `@types/node`, `builtin-modules`.
- [X] T003 [P] Create `tsconfig.json` at repo root targeting ES2018 CommonJS, `strict: true`, `moduleResolution: node`, including `src/` and `tests/`.
- [X] T004 [P] Create `esbuild.config.mjs` at repo root bundling `src/main.ts` → `main.js` (CJS, `obsidian` + node builtins external, ES2018, sourcemap in dev, minify in prod).
- [X] T005 [P] Create `vitest.config.ts` at repo root scoped to `tests/core/**` (node environment); ensure `src/core/` is resolvable from tests.
- [X] T006 [P] Create `manifest.json` and `versions.json` at repo root (id `user-story-map`, name "User Story Map", `minAppVersion`, `isDesktopOnly: false`) per plan.md.
- [X] T007 [P] Create `styles.css` at repo root with board layout classes (backbone, release bands, card grid) using Obsidian theme CSS variables only (no hardcoded colors), derived from `template_user_story_map.html`.

**Checkpoint**: `npm install` succeeds; `npm run build` and `npm test` run (no sources yet → empty/failing as expected).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure core data types and numbering primitives that every user story depends on. This is the round-trip guarantee's foundation (Constitution I).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 [US-shared] Define core types in `src/core/model.ts`: `StoryMap`, `Release`, `Activity`, `Card`, `Diagnostic` interfaces exactly per contracts/core-api.md §Types (imports nothing from `obsidian`).
- [X] T009 [P] Write `tests/core/numbering.test.ts`: assert `strip*(format*(i) + " " + t) === t` for each element type, Roman formatting (1→"I.", 4→"IV."), per-cell card restart, tolerant strip of missing/odd prefixes (FR-020/FR-022). Tests are written first and fail until T010 lands.
- [X] T010 [P] Implement pure numbering helpers in `src/core/numbering.ts`: `formatActivityNumber`/`stripActivityNumber` (Roman), `formatReleaseNumber`/`stripReleaseNumber` (`R{n}.`), `formatCardNumber`/`stripCardNumber` (`{n}.`, tolerating decimal) per contracts/markdown-format.md §7. No `obsidian`, no I/O. Make T009 pass.

**Checkpoint**: Core types compile; `numbering.test.ts` passes. Parser/serializer can now be built on these.

---

## Phase 3: User Story 1 - View a Markdown map as a visual board (Priority: P1) 🎯 MVP

**Goal**: Open a Markdown file with `story-map: true` and render it as a clean board — activities as the backbone, cards grouped into release bands — with no raw Markdown visible.

**Independent Test**: Open `fixtures/the-knight.md` in the map view; confirm every activity, release band, and card appears in the correct hierarchy/order; internal links are navigable; a markerless/empty file shows an empty state instead of an error.

### Tests for User Story 1 (core) ⚠️ write before implementation

- [X] T011 [P] [US1] Write `tests/core/detect.test.ts`: `isStoryMap` true with `story-map: true`, false when absent/markerless, edge frontmatter (FR-011 trigger).
- [X] T012 [P] [US1] Write `tests/core/parser.test.ts`: structure extraction (releases, activities, cells), document order → `order`, card body capture verbatim, prefix stripping to clean identity, release-by-name resolution, diagnostics for undeclared-release `###` and duplicate release titles, never throws (FR-002/FR-012/FR-016/FR-018/FR-020).
- [X] T013 [P] [US1] Write `tests/core/roundtrip.test.ts` read path: `serialize(parse(fixtures/the-knight.md)) === fixtures/the-knight.md` byte-for-byte (FR-006/FR-022). (Depends on serializer T015; may initially fail.)

### Implementation for User Story 1

- [X] T014 [US1] Implement `parse(markdown): StoryMap` in `src/core/parser.ts`: capture `frontmatter`/`preamble`/`trailing` and card bodies verbatim, parse `# Releases` + `# Activities`, resolve cards to releases by name, assign `order`, strip auto-number prefixes via `numbering.ts`, emit diagnostics, never throw (contracts/core-api.md `parse`).
- [X] T015 [US1] Implement `serialize(map): string` in `src/core/serializer.ts`: emit `# Releases` then `# Activities` in `order`, write auto-number prefixes from position via `numbering.ts`, reproduce preserved segments + card bodies exactly, canonical single-blank-line spacing (contracts/markdown-format.md §4). Make T013 round-trip pass.
- [X] T016 [P] [US1] Implement `isStoryMap(markdown): boolean` in `src/core/detect.ts` (frontmatter `story-map: true` check). Make T011 pass.
- [X] T017 [US1] Implement `StoryMapView` in `src/view/StoryMapView.ts`: `TextFileView` subclass with `getViewData`/`setViewData`/`clear`, calls `parse` on load and `serialize` on save, holds the working `StoryMap`, renders empty state when releases+activities are empty (FR-011). External-change handling (FR-013): when `setViewData` fires for an external modification, re-`parse` into a fresh model and re-render; never write a stale in-memory model over newer on-disk content (only `requestSave()` after a user-initiated mutation).
- [X] T018 [US1] Implement board rendering in `src/view/board.ts`: vanilla-DOM backbone (activities left→right with Roman labels), release bands (titles + subtitles, `R{n}`), and the activity×release card grid in document order, using `styles.css` classes (FR-001/FR-002/FR-014).
- [X] T019 [US1] Implement card element in `src/view/card.ts`: render card title (and `{n}`) via Obsidian `MarkdownRenderer` so internal links render and stay navigable; open/show card body detail on click (FR-010/FR-017).
- [X] T020 [US1] Render diagnostics in the view (e.g. a banner/inline markers for undeclared-release groups and duplicate release names) so malformed maps surface what wasn't understood instead of failing (FR-012).
- [X] T021 [US1] Wire `src/main.ts`: `registerView` for the story-map view type, frontmatter-based detection to open matching files as a board, a "Toggle Markdown / board view" menu item, and clean unregister on `onunload` (no leaked listeners/views) (plan.md, Constitution V).

**Checkpoint**: `the-knight.md` opens as a read-only board with correct hierarchy, numbering, and navigable links; core read-path checks (T009, T011–T013, T016) green. MVP is demoable.

---

## Phase 4: User Story 2 - Edit map content in place (Priority: P2)

**Goal**: Edit the text of a card, release, or activity on the board and write it back to Markdown without disturbing unmanaged content; cancel leaves both board and file unchanged.

**Independent Test**: Open a map, rename a card and an activity; board reflects changes; inspect the file — only the targeted heading text changed, frontmatter/other content untouched, and the file reopens as the same map (round-trip stable).

### Tests for User Story 2 (core) ⚠️ write before implementation

- [ ] T022 [P] [US2] Extend `tests/core/serializer.test.ts`: `renameRelease` rewrites the `# Releases` declaration AND every matching `### ` reference together (FR-018); `editCard`/`renameActivity` change only the targeted bytes; preserved segments and untouched bodies are byte-identical (FR-004/FR-005).
- [ ] T023 [P] [US2] Extend `tests/core/roundtrip.test.ts` edit path: applying a single edit then `serialize` changes only the intended bytes; re-`parse`→`serialize` of the edited map is stable (FR-006).

### Implementation for User Story 2

- [ ] T024 [US2] Implement edit mutation helpers in `src/core/model.ts` (pure, return new `StoryMap`): `editCard(map, ref, patch)` (`ref` = `{ activityIndex, releaseTitle, order }`), `renameActivity(map, activityIndex, newTitle)` (by backbone position, so duplicate titles stay addressable), `renameRelease(map, oldTitle, newTitle)` (updates declaration + all `###` refs atomically) per contracts/core-api.md. Make T022/T023 pass.
- [ ] T025 [US2] Implement in-place edit interactions in `src/view/interactions.ts`: inline edit of card title/body, activity title, release title/subtitle; commit calls the T024 helpers then `requestSave()`; cancel discards with no model/file change (FR-004/FR-017).
- [ ] T026 [US2] Wire edit affordances into `src/view/board.ts` and `src/view/card.ts` (edit triggers, body editor, confirm/cancel) and re-render the affected nodes after a successful edit.

**Checkpoint**: Editing a card/activity/release on the board updates only the targeted Markdown; unmanaged content preserved; round-trip stable. US1 still works.

---

## Phase 5: User Story 3 - Build and restructure a map (Priority: P3)

**Goal**: Create a new map and grow/restructure it — add, delete, and reorder releases, activities, and cards — keeping the file in sync and portable.

**Independent Test**: From an empty file, define 2 releases, add 2 activities, add cards under an activity×release cell, reorder a card, delete a card (with confirmation); board and file reflect the final structure, auto-numbers recompute, and the file reopens identically (and in another vault).

### Tests for User Story 3 (core) ⚠️ write before implementation

- [ ] T027 [P] [US3] Add `createEmptyMap(opts?)` cases to `tests/core/serializer.test.ts`: produces marker frontmatter + empty `# Releases`/`# Activities` skeleton (FR-011).
- [ ] T028 [P] [US3] Extend `tests/core/serializer.test.ts` for structure mutation: add/delete/reorder of releases, activities, and cards recompute all auto-numbers from position while identities and card↔release links are unchanged; deleting a release removes its `###` groups across activities (FR-007/FR-008/FR-009/FR-021).

### Implementation for User Story 3

- [ ] T029 [US3] Implement `createEmptyMap(opts?)` in `src/core/model.ts` returning a minimal valid map. Make T027 pass.
- [ ] T030 [US3] Implement add/delete/reorder mutation helpers in `src/core/model.ts` (pure): `addRelease`/`deleteRelease`/`reorderReleases`, `addActivity`/`deleteActivity`/`reorderActivities`, `addCard`/`deleteCard`/`reorderCard`, each reassigning `order` so serialize renumbers correctly. Make T028 pass.
- [ ] T031 [US3] Add a "Create story map" command in `src/main.ts` that writes the `createEmptyMap` skeleton (adds the `story-map: true` marker) and opens it as a board (FR-011).
- [ ] T032 [US3] Implement add/delete/reorder interactions in `src/view/interactions.ts`: add controls for releases/activities/cards; delete with a confirmation prompt for destructive actions; call the T030 helpers then `requestSave()` (FR-007/FR-008).
- [ ] T033 [US3] Implement drag-reorder in `src/view/interactions.ts` using native pointer/HTML5 DnD (per research.md) for cards within a cell, activities along the backbone, and releases; on drop reorder the model and `requestSave()` (FR-009).
- [ ] T034 [US3] Wire add/delete/reorder affordances into `src/view/board.ts` and re-render after each mutation so the board and recomputed auto-numbers stay in sync.

**Checkpoint**: A full map can be built from empty, restructured, and persisted; auto-numbers recompute on every change; file stays portable. US1 and US2 still work.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Settings, performance, and end-to-end validation across all stories.

- [ ] T035 [P] Implement `src/settings.ts`: settings tab + defaults (view preferences only, persisted via `loadData`/`saveData`; never map content) and register it in `src/main.ts`. (Plan-derived infrastructure; no FR — supports Constitution II/V, not a spec requirement.)
- [ ] T036 [P] Verify performance (SC-001, SC-007): confirm a typical map (tens of cards, e.g. `fixtures/the-knight.md`) opens and renders in under 2 s, and that board rendering/scroll stays responsive for hundreds of cards; adjust `board.ts` rendering if either budget is missed (e.g. batch DOM, avoid layout thrash).
- [ ] T037 Run the quickstart.md scenarios S1–S5 in a dev vault and confirm `npm test` is green; explicitly open a plugin-authored map in a second vault and confirm it renders identically with no extra setup (FR-015/SC-006); fix any gaps surfaced (final acceptance gate).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational. US1 is the MVP; US2 and US3 build on US1's parser/serializer/view but each is independently testable at the core level.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Needs Foundational only. Establishes `parse`, `serialize`, and the view — the basis the others extend.
- **US2 (P2)**: Reuses US1's parser/serializer/view; adds edit mutation helpers. Core edit tests are independent of US1's UI.
- **US3 (P3)**: Reuses US1's parser/serializer/view; adds create + structural mutation helpers and DnD. Core mutation tests are independent.

### Within Each User Story

- Core tests are written before the core implementation they cover (and may fail until it lands).
- `model.ts` types/helpers before `parser.ts`/`serializer.ts` before `view/`.
- View rendering before view interactions.

### Parallel Opportunities

- Setup: T003–T007 are all `[P]` (distinct config files).
- Foundational: T009 (numbering test) and T010 (`numbering.ts`) are `[P]` relative to T008's types.
- US1 tests T011/T012/T013 are `[P]` (distinct test files); `detect.ts` (T016) is `[P]` vs parser/serializer.
- US2 tests T022/T023 are `[P]`; US3 tests T027/T028 are `[P]`.
- Polish T035 and T036 are `[P]`.
- With multiple developers, US1 → then US2 and US3 can proceed in parallel once US1's core+view land.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 core tests together (distinct files):
Task: "Write tests/core/detect.test.ts (T011)"
Task: "Write tests/core/parser.test.ts (T012)"
Task: "Write tests/core/roundtrip.test.ts read path (T013)"

# detect.ts is independent of parser/serializer:
Task: "Implement src/core/detect.ts (T016)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup.
2. Phase 2: Foundational (types + numbering) — CRITICAL, blocks all stories.
3. Phase 3: US1 — parser, serializer, view, detection.
4. **STOP and VALIDATE**: open `the-knight.md`, run quickstart S1; core read-path tests green.
5. Demo the read-only board (MVP).

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate (S1/S2) → demo MVP.
3. US2 → validate (S3) → demo editing.
4. US3 → validate (S4/S5) → demo build/restructure.
5. Polish → run full quickstart + tests.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. One developer lands US1 (parser/serializer/view) since US2/US3 build on it.
3. Once US1's core is in, US2 (edit helpers) and US3 (create/structure helpers + DnD) proceed in parallel.

---

## Notes

- `[P]` = different files, no dependency on incomplete tasks.
- `[Story]` label maps each task to its user story (US-shared/US1/US2/US3) for traceability.
- The hard rule (CLAUDE.md, Constitution I): `src/core/` imports nothing from `obsidian`; it owns the Markdown round-trip and is the only writer. All Obsidian coupling stays in `src/view/` and `src/main.ts`.
- Auto-numbers are derived from position, written on save, stripped on parse — never identity.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
