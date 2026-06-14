# User Story Map

An [Obsidian](https://obsidian.md) plugin that renders a plain‑Markdown user story map as a clean, theme‑aware visual board — and lets you **view, edit, and build** maps while the Markdown file stays the single source of truth.

No database, no proprietary format. A story map is just a `.md` note with a marker in its frontmatter, so it's portable across vaults and readable in any text editor.

## What it does

- **View** — open a marked note as a board: activities form the backbone across the top, with story cards grouped into release bands. No raw Markdown visible. Internal links (`[[...]]`) render and stay navigable.
- **Edit in place** — rename activities, releases, and cards, and edit card detail, directly on the board. Only the bytes you touch change; frontmatter and any other content are preserved verbatim.
- **Build & restructure** — create a new map from scratch; add, delete, and drag‑reorder releases, activities, and cards. Position‑derived numbers recompute automatically.
- **Toggle anytime** — switch a file between the board and the raw Markdown editor with one click (header button), a command, or the file menu. Nothing is converted or lost.

The board mirrors the file: every change writes back to Markdown, and reading then re‑saving an unchanged map reproduces it byte‑for‑byte.

## The file format

A note is treated as a story map when its YAML frontmatter contains `story-map: true`. A `# Releases` section declares the release bands once; a `# Activities` section holds each activity (`##`) with release sub‑groups (`###`, referenced by name) containing story cards (`####`) that may carry body detail.

```markdown
---
story-map: true
---

# The Knight: Adventure Reforged

# Releases

1. Walking skeleton - thinnest playable spine
2. Core loop - makes it feel like a game
3. Depth & agency - the vision you're protecting

# Activities

## I. Enter & orient

### R1. Walking skeleton

#### 1. Start the game

#### 2. See the goal

### R2. Core loop

#### 1. Resume save
```

**Auto‑numbers** (activities `I.`, release groups `R{n}.`, cards `{n}.`) are derived from position, written on save, and stripped on read — so they're presentation only, never identity. Hand‑authored files may omit them and will gain them on the next save. Card titles before ` - ` in a release line are the release name; text after it is an optional subtitle. Anything outside the managed sections (an H1 title, prose, other headings) is preserved untouched.

See [`specs/001-story-map-editor/contracts/markdown-format.md`](specs/001-story-map-editor/contracts/markdown-format.md) for the full grammar and round‑trip rules.

## Install (manual)

Until it's in the community plugin browser, install by hand:

1. Build the plugin (or grab `main.js`, `manifest.json`, and `styles.css` from a release).
2. Copy those three files into your vault at:

   ```
   <vault>/.obsidian/plugins/user-story-map/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```
3. In **Settings → Community plugins**, disable Restricted mode if needed, then enable **User Story Map**.

## Usage

- **Open an existing map** — add `story-map: true` to a note's frontmatter (in Source mode, or via the Properties panel using a **Checkbox**‑type property so it's a real boolean). It opens as a board automatically.
- **Create a new map** — run the command palette → **"Create story map"**. It writes a marked, empty skeleton and opens it as a board.
- **Toggle board ⇄ Markdown** — use the header button (grid icon on Markdown, document icon on the board), the **"Toggle Markdown / board view"** command, or the file menu.
- **Edit** — click a card to open its detail; hover titles for inline edit; use the add/delete controls and drag cards, activities, and releases to reorder.

## Development

```bash
npm install
npm run dev      # esbuild watch -> main.js
npm run build    # type-check + production bundle
npm test         # vitest: parser, serializer, round-trip, detection, numbering
```

To develop against a vault, symlink or copy `main.js`/`manifest.json`/`styles.css` into the vault's plugin folder and reload.

### Architecture

The defining rule is a hard split:

- **`src/core/`** is pure and imports nothing from `obsidian`. It owns the model, parser, serializer, and numbering, and is the **only writer** of Markdown — which is what makes the round‑trip guarantee unit‑testable without an Obsidian runtime.
- **`src/view/`** and **`src/main.ts`** hold all Obsidian coupling: the `TextFileView` board, rendering, interactions, and view switching.

Stack: TypeScript bundled with esbuild to a single `main.js`; Vitest for the core module; zero non‑trivial runtime dependencies.

## Status

v0.1. Built and validated against the quickstart scenarios in a live vault. Spec, plan, and design artifacts live under [`specs/001-story-map-editor/`](specs/001-story-map-editor/).
