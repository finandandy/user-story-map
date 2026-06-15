# Research: Board UX Improvements

**Feature**: 002-board-ux-improvements | **Date**: 2026-06-14 | **Phase**: 0

This document resolves the open technical decisions implied by the Technical Context. It continues
the parent feature's numbering (R1–R9 live in `001-story-map-editor/research.md`). Each entry records
the Decision, Rationale, and Alternatives considered. No `NEEDS CLARIFICATION` markers remain.

---

## R10. Inline title editing + create-into-edit, with no empty cards persisted

**Decision**: Reuse the existing `editInline(target, current, commit)` helper (interactions.ts) for
**both** the pencil affordance (already wired) and a new **single-click on the title** (US1, FR-003).
The auto-number is rendered as a sibling, non-editable span *inside the same label element* as the
title, so the two read as one continuous label (FR-004) but `editInline` swaps only the title span
(FR-005). Distinguish gestures: click-to-edit fires on the title span only; drag-to-reorder lives on
the card/act/band container and is suppressed while an inline input is open; a pointer that starts a
border-resize (R12) stops propagation so it never reaches the title (FR-018/FR-025).

For **create-into-edit** (FR-001/FR-002): the view adds the node with an **empty title** via the
existing pure helpers (`addActivity(map,"")` / `addRelease(map,"")` / `addCard(...,"")`), renders,
and immediately opens that node's inline editor focused. Crucially this add is applied **without
saving** (a transient apply — see R11): if the user commits a non-empty title it routes through the
rename/edit helper and *then* persists; if they commit empty or cancel, the view removes the draft
node from the working model and re-renders, and nothing is ever written (FR-002). So an empty new
card never reaches the file.

**Rationale**: `editInline` already handles Enter/blur-commit, Escape-cancel, and the no-op (value
unchanged → no commit). Folding click-to-edit and draft-commit through it keeps one editor code path
and one commit semantics. Keeping the number a separate span preserves the parent feature's hard rule
that auto-numbers are presentation, never identity (FR-005) — the model still stores clean titles.
Doing the draft add transiently (no save) is what makes "discard empty new card" leave the file
untouched rather than write-then-delete.

**Alternatives considered**:
- *Write the empty node then delete it on discard* — rejected: two file writes per discarded create,
  briefly persists an empty heading, and risks an external-change reparse mid-draft.
- *A dedicated "draft" field on the model* — rejected: pushes transient view state into the pure core;
  the view already owns the working model between saves, so a no-save apply is sufficient.
- *Make the number part of the editable title text* — rejected: breaks identity/round-trip (the
  number would have to be re-stripped on every keystroke and could be edited away).

## R11. Non-persisting ("transient") apply for drafts

**Decision**: Add a second entry point alongside `EditContext.apply` — e.g. `applyTransient(mutate)`
— that updates the working model and re-renders **without** calling `requestSave()`. Draft creation
(R10) and the open-inline-editor step use it; the *commit* of a non-empty title uses the normal
`apply` (which saves). Discarding a draft uses `applyTransient` (delete the draft) so the file stays
clean.

**Rationale**: The parent feature deliberately routes every *persisted* mutation through one
audited path (`apply` → mutate → `requestSave` → render, Constitution I). Drafts need the same
mutate+render but must defer the write until the create is "real." A sibling no-save method keeps the
single-writer discipline (only `serialize` writes, only on a committed change) while supporting the
one legitimately deferred case.

**Alternatives considered**:
- *Always save, debounce writes* — rejected: still persists empty drafts within the debounce window
  and complicates external-change handling.
- *Track dirtiness manually and skip the save in `apply`* — rejected: overloads one method with two
  contracts; an explicit `applyTransient` is clearer at every call site.

## R12. Shared, drag-adjustable card/column width (view-only)

**Decision**: Introduce a single CSS custom property `--usm-card-width` set on the board root, and
change `grid-auto-columns` on both `.backbone` and `.grid` from `minmax(140px, 1fr)` to a fixed
`var(--usm-card-width)`; cards get `max-width: var(--usm-card-width)` with text wrapping so long
content is contained, never widening the column (FR-009/FR-010). The width is a **session value on
the `StoryMapView` instance**, initialized to a sensible default (**240px**, within the ~180–420px
range) and **reset on every `setViewData`** (reopen/external load), so it never persists and the
Markdown is untouched (FR-024). A `makeResizable(el)` helper attaches pointer handlers to thin
left/right **resize zones** on cards: on pointer-drag it computes a new width, **clamps to 180–420px**
(FR-023), updates `--usm-card-width` live, and `stopPropagation`s so the gesture is distinct from
title-edit and reorder (FR-025). The handle shows `cursor: ew-resize` only on the border (Edge Cases).

**Rationale**: A CSS variable makes "resize every card and column together" a one-property update —
no per-element work, no model mutation, no re-parse — so dragging is smooth even on large maps
(Constitution II) and the uniform-column rule (FR-010) is automatic because all tracks read the same
variable. Storing the width on the view instance (not in `data.json` or the file) is exactly the
clarified "view-only, resets on reopen" behavior (FR-024) and keeps the format/round-trip impact at
zero.

**Alternatives considered**:
- *Persist width in `data.json` or frontmatter* — rejected by clarification (view-only, resets on
  reopen); also would add format/round-trip surface for pure presentation.
- *Resize each card element individually* — rejected: O(n) DOM writes per pointer-move, defeats the
  uniform-width invariant, and janks large maps.
- *CSS `resize` / native handles* — rejected: resizes one element, can't drive a shared width, and
  fights the grid.

## R13. Two-field edit modal (Title + Details) scope

**Decision**: The pencil affordance opens the edit modal **directly in edit mode** with exactly two
fields, Title and Details, for **story cards** — Details is the card body (its user story /
acceptance criteria), pre-populated from existing body content (FR-006/FR-007/FR-008). This is the
existing `CardDetailModal` minus its read-first step. **Activities** get an analogous focused modal
whose second field is the **icon selector** (US5) rather than free-text details, since activities
carry an icon, not story content; **releases** keep their existing inline Title/Subtitle editing.
Internal links in a card remain navigable by following them from the rendered Details (FR-019).

**Rationale**: "Details = the node's body content (user story / acceptance criteria)" (FR-007) is
semantically a *card* concept — only cards have a body in the model. Forcing a free-text Details
field onto activities/releases would invent storage the format doesn't have. Cards get the literal
two-field modal; activities get a parallel focused modal sized to what they actually own (title +
icon). This honors the spec's intent (a focused modal per node, FR-006) without inventing data.

**Alternatives considered**:
- *One generic Title/Details modal for all node types* — rejected: activities/releases have no body;
  a Details field there would either be dead or require a new storage location the spec forbids.
- *Keep the read-then-edit two-step modal* — rejected: the spec wants the pencil to land directly in
  the two editable fields.

## R14. Activity icons — Lucide source, custom SVG, and storage

**Decision**: Offer icons from the **bundled Lucide set** Obsidian already ships, via `setIcon(el,
name)` to render and `getIconIds()` to browse/search in the picker (FR-013/FR-014/FR-015) — **no new
dependency** (Constitution II). The user may instead paste a **custom SVG**. Store the icon as a
single `icon:` field at the **top of the activity's body** (clarified): `icon: <lucide-name>` for a
Lucide reference, or `icon: <svg …>…</svg>` for a custom SVG (discriminated by a leading `<`). The
parser captures activity body verbatim and **strips** a leading `icon:` line into the model's
`Activity.icon`; the serializer **re-emits** it (FR-016). An activity with no icon renders with no
placeholder gap (FR-015). An unknown Lucide name on load renders a neutral fallback (or omits the
icon) without breaking the board (Edge Cases).

This requires the parser to **capture activity body at all** — today it silently drops any text
between a `##` activity heading and its first `###` group. Capturing it (and adding `Activity.body`)
both enables the `icon:` field and closes a latent non-destructive-preservation gap (Constitution I).

**Rationale**: Lucide-as-bundled keeps the plugin lightweight and native (Principles II/V). The
`icon:`-in-body format is the clarified choice: it leaves the `##` heading (and its Roman auto-number)
clean, is per-activity by construction (no name/position coupling), and extends the existing
card-body strip/re-emit mechanism rather than changing headings or numbering. The discriminator
(leading `<` ⇒ SVG) is unambiguous because Lucide names never start with `<`.

**Alternatives considered**:
- *Bundle the `lucide` npm package* — rejected: redundant (Obsidian ships Lucide) and adds weight.
- *Store the icon in frontmatter or the `##` heading* — rejected by clarification: heading would
  dirty the auto-number; frontmatter is map-global, not per-activity.
- *Drop activity body (status quo)* — rejected: not non-destructive; no place for the icon.

## R15. Custom-SVG sanitization (data safety)

**Decision**: Sanitize a pasted SVG **before it is stored or rendered** (FR-017). Primary sanitizer
lives in `src/view/icon.ts` and is **DOM-based**: parse with `DOMParser`, require a single root
`<svg>`, and strip/reject `<script>`, `<foreignObject>`, event-handler attributes (`on*`), and
`href`/`xlink:href` carrying `javascript:` or external URLs; reject malformed input outright. As
defense-in-depth and for unit testing, a small **pure** guard in `src/core` (e.g. `isLikelyUnsafeSvg`)
rejects the same patterns by string inspection and is covered by `tests/core/icon.test.ts`. Only the
sanitized string is committed to the model and written to the file.

**Rationale**: Custom SVG is the one place this feature accepts arbitrary user markup that gets
rendered, so it directly engages the constitution's data-safety obligation. A robust DOM-based pass
is the right primary defense; a pure string guard gives a testable backstop without pulling DOM into
the core. UI sanitization correctness is exercised manually per quickstart (the DOM API isn't in the
pure test harness).

**Alternatives considered**:
- *Render custom SVG via `innerHTML` unsanitized* — rejected: unsafe/active markup risk (FR-017).
- *Add DOMPurify* — rejected for v1: a new runtime dependency for a P3 affordance; the targeted
  allow-list sanitizer above is sufficient and lighter (Principle II). Held in reserve if the
  allow-list proves inadequate.
- *Disallow custom SVG entirely (Lucide only)* — rejected: the spec explicitly requires custom SVG.

---

## Resolved unknowns summary

| Technical Context item | Resolution |
|------------------------|------------|
| Inline title edit + create-into-edit | Reuse `editInline`; number is a non-editable sibling span; draft add applied transiently, discarded if empty (R10) |
| Deferring the write for drafts | `applyTransient` (mutate + render, no save) beside `apply` (R11) |
| Shared, resizable width | Single `--usm-card-width` CSS var; session-only on the view, reset on reopen; pointer resize clamped 180–420px, gesture-isolated (R12) |
| Two-field modal scope | Title/Details modal for cards; parallel Title/Icon modal for activities; releases keep inline (R13) |
| Icon source + storage | Bundled Lucide (`setIcon`/`getIconIds`) + custom SVG; stored as stripped `icon:` field in activity body; capture activity body (R14) |
| Custom-SVG safety | DOM-based sanitizer in view + pure guard in core; sanitize before store/render (R15) |

All items resolved — ready for Phase 1.
