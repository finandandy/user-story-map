# Contract: Story Map Markdown Format

**Feature**: 001-story-map-editor | **Date**: 2026-06-13 | **Status**: v0.1 canonical

This is the **primary external contract** of the plugin: the on-disk file format. It is the
source of truth (Constitution I) and the unit of portability between projects (FR-015). Any reader
or writer — the plugin, a human in a text editor, or a future tool — MUST honor this grammar.

## 1. File shape

```markdown
---
story-map: true
---

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

## II. Explore world

### R1. Walking skeleton

#### 1. Move the knight
```

A file is treated as a story map when its YAML frontmatter contains `story-map: true`. Other
frontmatter keys are preserved untouched.

Heading text carries **auto-numbers** (activities `I.`, release groups `R{n}.`, cards `{n}.`).
These are derived from position and written on save; a reader **strips** them to recover the clean
identity (activity name "Enter & orient", release name "Walking skeleton", card title "Start the
game"). See §7.

## 2. Grammar

```ebnf
file        = [ frontmatter ] , [ preamble ] , releases-section , activities-section , [ trailing ] ;

releases-section   = "# Releases" , NL , { release-line } ;
release-line       = ordinal , ". " , title , [ " - " , subtitle ] , NL ;
ordinal            = DIGIT , { DIGIT } ;          (* display only; order = file order *)

activities-section = "# Activities" , NL , { activity } ;
activity           = "## " , [ roman-prefix ] , title , NL , { release-group } ;
release-group      = "### " , [ release-prefix ] , release-title-ref , NL , { card } ;
card               = "#### " , [ card-prefix ] , title , NL , [ body ] ;
body               = { any-line - heading-le-4 } ;  (* raw markdown up to next heading level <=4 *)

roman-prefix       = roman-numeral , ". " ;        (* derived from backbone order *)
release-prefix     = "R" , DIGIT , { DIGIT } , ". " ; (* derived from global release order *)
card-prefix        = DIGIT , { DIGIT } , [ "." , DIGIT , { DIGIT } ] , ". " ; (* per-cell order *)
roman-numeral      = ( "I" | "V" | "X" | "L" | "C" | "D" | "M" ) , { "I"|"V"|"X"|"L"|"C"|"D"|"M" } ;

title              = TEXT - NL ;
subtitle           = TEXT - NL ;
release-title-ref  = TEXT - NL ;   (* MUST equal some release-line title, trimmed *)
```

`NL` = newline. `heading-le-4` = a line beginning with one to four `#` followed by a space. The
`*-prefix` parts are **optional on read** (hand-authored files may omit them) and **always written
on save** (§7); they are stripped to recover `title`/`release-title-ref`.

## 3. Semantic rules

| # | Rule | Source |
|---|------|--------|
| F1 | `# Releases` declares every release exactly once; **release order = list order**, not the printed ordinal. | FR-016 |
| F2 | A release's **title** (text before ` - `) is its identity. Subtitle (after the first ` - `) is optional. | spec clarification |
| F3 | Inside `# Activities`, a `### heading` references a release **by title** (trimmed, case-sensitive). | FR-018 |
| F4 | An activity lists only the release groups it has cards in (sparse). Empty release groups are not required. | spec clarification |
| F5 | A `####` card belongs to the nearest enclosing `###` release group and `##` activity. | FR-002 |
| F6 | A card MAY have body text (any Markdown) until the next heading of level ≤ 4; it is preserved verbatim and shown on card open. | FR-017 |
| F7 | Content before `# Releases` (incl. an H1 title), between sections, and after the last managed section is **preserved verbatim** and never reformatted. | FR-005 |
| F8 | Round-trip: reading then writing with no edit reproduces the file byte-for-byte. | FR-006 |
| F9 | Release titles MUST be unique; a duplicate, or a `###` ref with no matching release, is a non-fatal **diagnostic** — content is shown, not dropped. | FR-012, Edge Cases |
| F10 | Internal links (`[[...]]`, `[..](..)`) in titles/bodies are preserved and render as navigable links. | FR-010 |
| F11 | Auto-number prefixes are **derived from position**, written on save, stripped on read; they are never part of identity and never affect referencing (§7). | FR-019, FR-020 |
| F12 | Adding/deleting/reordering elements recomputes all numbers; identities and card↔release links are unaffected. | FR-021 |
| F13 | Round-trip holds **with numbering applied**: re-saving an unchanged numbered map reproduces it byte-for-byte (numbers are deterministic from order). | FR-022 |

## 4. Writer obligations (serializer)

- Emit `# Releases` then `# Activities`; within each, emit children in `order`.
- Re-number release ordinals sequentially from 1 on write (display only; never used as a key).
- Apply auto-number prefixes from position (§7): `## {Roman}. {name}`, `### R{n}. {title}`,
  `#### {n}. {title}`. Numbers are recomputed on every write so they always match current order.
- Emit `### R{n}. {Release.title}` using the release's current title (so a rename updates the
  declaration and all references atomically; the `R{n}` reflects global release order).
- Reproduce `frontmatter`, `preamble`, `trailing`, and each card `body` exactly as captured.
- Use a single blank line between sibling blocks, matching the canonical shape in §1, UNLESS the
  surrounding original spacing was captured for a preserved segment (then reproduce it).
- Never write plugin-private state into the file beyond the `story-map` frontmatter key.

## 5. Reader obligations (parser)

- Trigger only on the `story-map: true` marker (a command may offer to add it).
- Capture unmanaged regions as opaque preserved segments (do not normalize them).
- Strip any auto-number prefix (§7) from each heading to recover the clean identity; a heading
  with no recognizable prefix is treated as already-clean (hand-authored files load unchanged and
  gain numbers on next save).
- Tolerate malformed input: emit diagnostics (§F9), keep unrecognized content addressable, and
  never throw on load (FR-012). An empty/markerless map yields an empty `StoryMap` for the
  initialize state (FR-011).

## 6. Conformance fixtures

`fixtures/the-knight.md` (the full mockup map, with numbered headings) is the canonical round-trip
fixture. Tests in `tests/core/roundtrip.test.ts` assert `serialize(parse(fixture)) === fixture` and
that targeted edits change only their intended bytes.

## 7. Auto-numbering

Numbers are **derived from position**, written into heading text on save and stripped on read.
They are presentation only — never identity, never used for referencing (clarified 2026-06-13).

| Element | Heading prefix | `n` derived from | Strip pattern (anchored at start of heading text) |
|---------|----------------|------------------|----------------------------------------------------|
| Activity | `{Roman}. ` | backbone order (1-based) | `^[IVXLCDM]+\.\s+` |
| Release group (`###`) | `R{n}. ` | **global** release order (1-based) | `^R\d+\.\s+` |
| Story card (`####`) | `{n}. ` | order within its activity×release **cell** (restarts per cell) | `^\d+(?:\.\d+)?\.\s+` |
| Release declaration (`# Releases`) | arabic `N.` (existing list) | list order | (the ordered-list marker itself) |

Obligations:
- **Determinism**: writing numbers from `order` then stripping them is the identity — this is what
  makes round-trip (F13) hold. Logic is isolated in the pure `numbering.ts` module.
- **Recompute on mutation**: any add/delete/reorder renumbers everything; identities unchanged (F12).
- **Tolerant read**: a missing/odd prefix is not an error; the heading is taken as a clean title.
- **v1**: always on. A future toggle and per-map overrides (start index, custom step such as
  tenths `0.1` — note the card strip pattern already tolerates a decimal) are out of scope here.
