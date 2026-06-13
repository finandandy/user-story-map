# Quickstart & Validation: Story Map Editor

**Feature**: 001-story-map-editor | **Date**: 2026-06-13 | **Phase**: 1

A run/validation guide proving the feature works end-to-end. Implementation detail lives in
`tasks.md`; the format and core API live in [contracts/](./contracts/).

## Prerequisites

- Node.js 18+ and npm.
- Obsidian desktop (v1.x) with a throwaway **development vault**.

## Build & install into a dev vault

```bash
npm install
npm run build          # esbuild -> main.js
# copy plugin files into the dev vault's plugin folder:
#   <vault>/.obsidian/plugins/user-story-map/{main.js,manifest.json,styles.css}
# (or symlink the repo there during development, then enable in Settings → Community plugins)
```

Enable **User Story Map** in *Settings → Community plugins*.

## Automated checks (pure core)

```bash
npm test               # vitest: parser, serializer, round-trip, detect
```

**Expected**: all `tests/core/*` pass, including `roundtrip.test.ts` proving
`serialize(parse(fixtures/the-knight.md)) === fixtures/the-knight.md` (FR-006/FR-022) and
`numbering.test.ts` proving `strip ∘ format` is the identity (FR-020).

## Scenario validation

Each scenario maps to a user story / success criterion. Use `fixtures/the-knight.md` as the
sample map (copy it into the dev vault).

### S1 — View a map (US1 / SC-001, SC-002)

1. Open `the-knight.md` in the vault.
2. **Expect**: it opens as a board — six activities across the top; cards beneath each, grouped
   into the three release bands (Walking skeleton / Core loop / Depth & agency) with titles +
   subtitles. No raw Markdown visible. Renders in < 2 s.
   - **Numbering**: activities show Roman numerals (I–VI), release groups show `R1`–`R3`, and
     cards show per-cell `1, 2, …`. Toggling to Markdown shows the same numbers in the headings.
3. Click a card containing a link → **expect** the link is navigable (FR-010).

### S2 — Toggle & non-map files (R1 / FR-011, FR-013)

1. Use the view menu to toggle to **Markdown** → raw file shown; toggle back → board.
2. Open an ordinary note (no `story-map: true`) → **expect** it opens normally, uncorrupted.
3. Run the "Create story map" command on a new file → **expect** the marker + empty
   `# Releases`/`# Activities` skeleton and an initialize/empty state.

### S3 — Edit in place (US2 / SC-003, SC-004)

1. Edit a card's title on the board; confirm.
2. **Expect**: board updates; open the file in Markdown → only that card's `####` text changed;
   frontmatter and all other content untouched (FR-005).
3. Make no further change, then re-open → identical (round-trip, FR-006).

### S4 — Build & restructure (US3 / SC-005)

1. From an empty map: add 2 releases, 3 activities, several cards under activity×release cells.
2. Reorder a card within its cell; delete a card (confirm the prompt).
3. **Expect**: board and file stay in sync; total time < 5 minutes. After reorder/delete, the
   auto-numbers (Roman / `R{n}` / per-cell `{n}`) recompute to match the new order while card
   titles and release names (their identity) stay unchanged (FR-021).
4. Copy the file to a second vault and open → **expect** identical board (FR-015 / SC-006).

### S5 — Malformed & large maps (FR-012, SC-007)

1. Add a `### Nonexistent release` group with a card under an activity → **expect** a surfaced
   diagnostic, content still shown, no crash.
2. Open a map with hundreds of cards → **expect** smooth scroll/pan and responsive edits (SC-007).

## Done / acceptance

The feature is validated when `npm test` is green and S1–S5 pass in the dev vault, satisfying the
spec's user stories and success criteria.
