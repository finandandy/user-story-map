# Contract: Core Module Public API — Board UX delta

**Feature**: 002-board-ux-improvements | **Date**: 2026-06-14 | **Status**: additive to v0.1

A **delta** to [`001-story-map-editor/contracts/core-api.md`](../../001-story-map-editor/contracts/core-api.md).
The pure/coupled split, all existing types, and all existing helpers are unchanged. This feature adds
the **activity icon** (a new field + type + helper) and a small **pure SVG-safety guard**, and
extends `parse`/`serialize` to round-trip the activity body and `icon:` field. No existing signature
changes.

## Types (`src/core/model.ts`)

```ts
export interface Activity {
  title: string;
  order: number;
  cells: Map<string, Card[]>;
  body: string;                 // NEW: raw activity body (icon: line removed), preserved verbatim
  icon: ActivityIcon | null;    // NEW: optional; null when absent
}

// NEW
export type ActivityIcon =
  | { type: "lucide"; name: string }       // Lucide icon id (rendered via Obsidian setIcon)
  | { type: "custom-svg"; svg: string };   // sanitized SVG document string (FR-017)
```

`StoryMap`, `Release`, `Card`, `Diagnostic`, `CardRef` are unchanged.

## Functions

### `parse(markdown): StoryMap` — extended

- Now **captures activity body** (lines between a `##` heading and its first `###`/next heading)
  verbatim into `Activity.body` instead of discarding it (markdown-format §8 F17).
- If the first non-blank body line is `icon: <value>`, **strips** it into `Activity.icon`
  (`<…>` ⇒ `custom-svg` after sanitization; otherwise `lucide`) and removes it from `body`. An
  unrecognized value leaves `icon: null` and the body untouched (F19). Still never throws (FR-012).

### `serialize(map): string` — extended

- After `## {Roman}. {title}`, emits `icon: {value}` (when `Activity.icon` is set) then the preserved
  `Activity.body`, then the release groups — per markdown-format §8.4.
- Round-trip guarantee now covers icons + activity body: `serialize(parse(x)) === x` for conformant
  `x` including activities with an `icon:` field and body (FR-021, F20).

### Mutation helper (new, `src/core/model.ts`)

```ts
setActivityIcon(map, activityIndex, icon: ActivityIcon | null): StoryMap
```

- Sets (or, with `null`, clears) the icon of the activity at `activityIndex` (addressed by backbone
  position, never title — consistent with the addressing model). Pure; returns a new `StoryMap`;
  performs no I/O and no sanitization (the view sanitizes a custom SVG before calling this).
- Clearing (`null`) causes the serializer to omit the `icon:` line (no placeholder, FR-015).

> The existing `addActivity` / `addRelease` / `addCard` are reused for create-into-edit drafts by
> passing an empty `title`; `renameActivity` / `renameRelease` / `editCard` commit the inline edit or
> modal. No signature changes — the draft/no-save behavior is a view concern (research R11).

### SVG safety guard (new, pure)

```ts
isLikelyUnsafeSvg(svg: string): boolean    // defense-in-depth; true ⇒ reject
```

- A pure, DOM-free string check that flags `<script>`, `<foreignObject>`, `on*=` handler attributes,
  and `javascript:`/external `href`/`xlink:href`. Unit-tested in `tests/core/icon.test.ts`. The
  **primary** sanitizer is DOM-based and lives in `src/view/icon.ts` (research R15); this guard is a
  testable backstop so unsafe markup can't reach the model even if a future caller skips the view path.

## Invariants (additions)

| Invariant | Tied to |
|-----------|---------|
| Activity body is captured and preserved verbatim (no longer dropped). | Constitution I, FR-021 |
| `icon:` field is stripped on parse, re-emitted on serialize; it is presentation, never identity, and never affects ordering/auto-numbering. | FR-016 |
| `serialize ∘ parse` is the identity for activities with icon + body. | FR-021, F20 |
| A custom-SVG icon is sanitized before it is stored/rendered; the model never holds unsafe raw markup. | FR-017 |
| `setActivityIcon` targets an activity by `activityIndex`; clearing omits the `icon:` line. | Addressing model, FR-015 |
| Core imports nothing from `obsidian` (Lucide rendering + DOM SVG sanitization stay in the view). | Principle I |

## Test contract (additions, `tests/core/`)

- `parser.test.ts` — activity body captured verbatim; leading `icon:` line stripped to `Activity.icon`
  (lucide and custom-svg); unrecognized/odd `icon:` value leaves `icon: null` and keeps the line.
- `serializer.test.ts` — `icon:` line + body re-emitted in canonical shape; cleared icon omits the line.
- `roundtrip.test.ts` — extended fixture with an icon + activity body round-trips byte-for-byte.
- `icon.test.ts` (new) — `setActivityIcon` set/clear; `isLikelyUnsafeSvg` flags script/handler/
  `javascript:`/external-ref cases and passes a clean SVG; parse/serialize icon symmetry.
