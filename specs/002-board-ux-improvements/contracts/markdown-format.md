# Contract: Story Map Markdown Format — Board UX delta (§8)

**Feature**: 002-board-ux-improvements | **Date**: 2026-06-14 | **Status**: additive to v0.1

This is a **delta** to the canonical format contract,
[`001-story-map-editor/contracts/markdown-format.md`](../../001-story-map-editor/contracts/markdown-format.md).
Everything in that contract (file shape, grammar, semantic rules F1–F13, auto-numbering §7) still
holds. This feature makes exactly **one** additive change: an activity may carry an optional `icon:`
field, and the activity **body** is now captured and preserved (it previously was silently dropped).
No other element, heading, ordinal, or auto-number changes. Card width is view-only and has **no**
file representation.

## 8. Activity body and the `icon:` field

### 8.1 Shape

An activity body is the content between a `## ` activity heading and that activity's first `### `
release group (or the next `##`/`#` heading, or end of the activities section). It is **preserved
verbatim** — the same non-destructive guarantee already applied to card bodies (F6/F7). Within it, a
leading `icon:` line is a **managed field**:

```markdown
## I. Enter & orient

icon: compass

### R1. Walking skeleton

#### 1. Start the game
```

A custom SVG is carried inline on the same line:

```markdown
## II. Explore world

icon: <svg viewBox="0 0 24 24"><path d="…"/></svg>

### R1. Walking skeleton
```

### 8.2 Grammar (additions to §2)

```ebnf
activity        = "## " , [ roman-prefix ] , title , NL , [ icon-field ] , activity-body , { release-group } ;
icon-field      = "icon:" , [ SP ] , icon-value , NL ;   (* optional; only when first non-blank body line *)
icon-value      = lucide-name | svg-document ;
lucide-name     = ( LETTER | DIGIT | "-" ) , { LETTER | DIGIT | "-" } ;   (* never starts with "<" *)
svg-document    = "<svg" , … , "</svg>" ;                (* single root <svg>; sanitized, §8.5 *)
activity-body   = { any-line - heading-le-4 } ;          (* raw markdown, preserved verbatim *)
```

The `icon:` line, when present, MUST be the **first non-blank line** of the activity body. Anything
after it (up to the first `###`/next heading) is opaque `activity-body`, preserved exactly.

### 8.3 Semantic rules (additions to §3)

| # | Rule | Source |
|---|------|--------|
| F14 | An activity MAY carry an optional `icon:` field as the first non-blank body line. It is per-activity, optional, and presentation only — it never affects identity, ordering, referencing, or auto-numbering. | FR-013, FR-016 |
| F15 | `icon:` value beginning with `<` is a **custom SVG**; otherwise it is a **Lucide icon name**. | FR-016 |
| F16 | The parser **strips** the `icon:` line into the model's `Activity.icon` and keeps the remaining activity body in `Activity.body`; the serializer **re-emits** the `icon:` line (when an icon is set) followed by the preserved body. | FR-016 |
| F17 | Activity body (the text between `##` and the first `###`/next heading) is **preserved verbatim**, exactly like card bodies (F6). It was previously dropped; capturing it is a non-destructive fix. | Constitution I, FR-021 |
| F18 | A custom-SVG `icon:` value MUST NOT be persisted or rendered raw: the pure parser **rejects** a likely-unsafe value (icon unset, line kept — F19), and the view **DOM-sanitizes** the SVG before render (unsafe/active markup stripped). | FR-017 |
| F19 | An `icon:` value that cannot be parsed/recognized is non-fatal: the activity still renders (icon omitted / neutral fallback) and the line is kept rather than corrupting the file. | FR-012, Edge Cases |
| F20 | Round-trip holds with icons: re-saving an unchanged activity (icon + body) reproduces those bytes (extends F8/F13). | FR-021 |

### 8.4 Writer obligations (additions to §4)

- After emitting `## {Roman}. {title}`, if the activity has an icon, emit a blank line then a single
  `icon: {value}` line (Lucide name, or the sanitized SVG document on one line).
- Then reproduce `Activity.body` verbatim (it no longer contains the `icon:` line).
- Then emit the `### ` release groups as before. Spacing follows the canonical single-blank-line rule
  (§4) unless preserved-segment spacing was captured.
- Never emit an `icon:` line when the activity has no icon (no empty placeholder in the file).

### 8.5 Reader obligations (additions to §5)

- When parsing a `##` activity, capture the lines up to the first `###`/next heading as the activity
  body (do not discard them — F17).
- If the first non-blank captured line matches `^icon:\s*(.+)$`, remove it from the body and set
  `Activity.icon`: value starting with `<` ⇒ `{ type: "custom-svg", svg }` **only if it passes the
  pure `isLikelyUnsafeSvg` guard** (else `icon: null`, line kept — F18/F19); otherwise
  `{ type: "lucide", name }`. DOM sanitization happens in the view before render, not in the parser.
  A non-matching or unparseable value leaves `icon: null` and the body untouched (F19).
- On read, the pure parser MUST NOT DOM-sanitize (it imports nothing from `obsidian`): it applies the
  pure `isLikelyUnsafeSvg` guard and, if the value is likely unsafe, leaves `icon: null` and keeps the
  raw line in `body` (F19) rather than storing it as an icon. The view layer (`src/view/icon.ts`) MUST
  DOM-sanitize a custom SVG before rendering, so an externally-edited file with unsafe markup can never
  inject it into the board (F18).

## 9. Card width — explicitly not represented

The shared card/column width adjustable by border-drag is **view-only session state** and has **no**
representation in the Markdown file or in plugin storage (FR-024). A resize MUST NOT change a single
byte of the file. This is called out so no reader/writer ever invents a width field.

## Conformance fixtures (delta)

`fixtures/the-knight.md` is extended to include at least one activity with a Lucide `icon:` field and
at least one activity with non-empty body text, so `tests/core/roundtrip.test.ts` exercises §8
(byte-for-byte round-trip with icons + body). A custom-SVG icon case is covered in
`tests/core/icon.test.ts`.
