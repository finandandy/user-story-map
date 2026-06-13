<!-- SPECKIT START -->
## Active feature: 001-story-map-editor

For technologies, project structure, shell commands, and other important context, read the
current plan and its design artifacts:

- Plan: `specs/001-story-map-editor/plan.md`
- Spec: `specs/001-story-map-editor/spec.md`
- Research (decisions): `specs/001-story-map-editor/research.md`
- Data model: `specs/001-story-map-editor/data-model.md`
- Contracts: `specs/001-story-map-editor/contracts/` (markdown-format.md, core-api.md)
- Quickstart / validation: `specs/001-story-map-editor/quickstart.md`

**Stack**: TypeScript + Obsidian API, esbuild bundle, Vitest for the pure `src/core/` module.
**Key rules**: `src/core/` (model/parser/serializer/numbering) imports nothing from `obsidian` and
owns the Markdown round-trip guarantee; all Obsidian coupling lives in `src/view/`. Auto-numbers
(Roman / `R{n}` / per-cell `{n}`) are derived from position, written on save, stripped on parse —
never identity (see contracts/markdown-format.md §7).
<!-- SPECKIT END -->
