<!-- SPECKIT START -->
## Active feature: 002-board-ux-improvements

For technologies, project structure, shell commands, and other important context, read the
current plan and its design artifacts:

- Plan: `specs/002-board-ux-improvements/plan.md`
- Spec: `specs/002-board-ux-improvements/spec.md`
- Research (decisions): `specs/002-board-ux-improvements/research.md` (continues 001's R1–R9 with R10–R15)
- Data model: `specs/002-board-ux-improvements/data-model.md` (Activity gains `body` + `icon`)
- Contracts: `specs/002-board-ux-improvements/contracts/` — deltas to 001 (markdown-format §8 icon
  field + activity-body capture; core-api `ActivityIcon` / `setActivityIcon` / icon round-trip)
- Quickstart / validation: `specs/002-board-ux-improvements/quickstart.md`

Parent feature (still authoritative for the base format & API): `specs/001-story-map-editor/`.

**Stack**: TypeScript + Obsidian API, esbuild bundle, Vitest for the pure `src/core/` module.
**Key rules**: `src/core/` (model/parser/serializer/numbering) imports nothing from `obsidian` and
owns the Markdown round-trip guarantee; all Obsidian coupling lives in `src/view/`. Auto-numbers
(Roman / `R{n}` / per-cell `{n}`) are derived from position, written on save, stripped on parse —
never identity (see 001 contracts/markdown-format.md §7). 002 adds an optional activity `icon:`
field (stripped on parse, re-emitted on save) and now preserves activity body; card width is
view-only session state, never written to the file (FR-024). Lucide is bundled in Obsidian
(`setIcon`/`getIconIds`) — no new runtime dependency; custom SVG is sanitized before store/render.
<!-- SPECKIT END -->
