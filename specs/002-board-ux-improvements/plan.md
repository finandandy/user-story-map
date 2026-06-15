# Implementation Plan: Board UX Improvements

**Branch**: `002-board-ux-improvements` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-board-ux-improvements/spec.md`

## Summary

Refine the interaction and visual design of the existing story-map board (`001-story-map-editor`)
so authoring feels fast, direct, and tidy — without changing what a story map *is* or breaking the
Markdown round-trip. Five slices: (US1) creating any node drops straight into inline title editing
and single-clicking a title edits it, with the auto-number rendered inline as one continuous label;
(US2) a pencil affordance on every node card opens a focused two-text-field Title/Details modal
(for an activity the same modal also carries the icon selector, US5); (US3) all
activity and story cards share one width, every column is sized to it, and the user can drag a card
border to resize all cards/columns together within ~180–420px (view-only, resets on reopen); (US4)
a hover-revealed "+" card at the right of the backbone appends an activity; (US5) an activity can
carry an optional Lucide or custom-SVG icon, persisted in the activity body as a stripped `icon:`
field.

Technical approach: keep the hard `src/core/` (pure, Obsidian-free, round-trip-owning) vs.
`src/view/` (all Obsidian coupling) split. The only core/format change is **icons** — activities
gain a preserved `body` plus a derived `icon`, and an `icon:` field is stripped on parse / re-emitted
on save (incidentally fixing a latent loss of any text between `##` and the first `###`). Everything
else — inline editing, create-into-edit drafts, the two-field modal, shared/resizable widths, the
hover "+" card, and SVG sanitization — is view-only and leaves the Markdown format untouched. Card
width is a session-only CSS variable, never persisted (no format or round-trip impact). Lucide is
the bundled Obsidian icon set (`setIcon` / `getIconIds`), so no new runtime dependency.

## Technical Context

**Language/Version**: TypeScript 5.x, compiled to an ES2018 CommonJS bundle (`main.js`) — unchanged
from the parent feature.

**Primary Dependencies**: `obsidian` (API types + runtime, incl. the bundled **Lucide** icon set via
`setIcon`/`getIconIds` — no new dependency, Constitution II); esbuild (bundler). Native pointer
events for border-resize and the existing native HTML5 DnD for reorder. No drag/icon library added.

**Storage**: Markdown files in the vault, via the existing `TextFileView` (source of truth). New:
an activity may carry an `icon:` field inside its body (round-trips). Card width is **not** stored
anywhere — it is in-session view state on the view instance, reset on reopen (FR-024). No new
`data.json` keys.

**Testing**: Vitest on the pure `src/core/` modules — extended for activity-body preservation and
icon parse/serialize/round-trip (the new format surface is the high-risk, testable part). SVG
sanitization gets a small pure guard with unit coverage; the DOM-based sanitizer and all new UI
(inline edit, modal, resize, hover "+", icon picker) are validated manually via `quickstart.md`.

**Target Platform**: Obsidian desktop-primary; loads on mobile. The hover-revealed affordances that
the spec requires to stay reachable without hover — the "+" add-activity card and the per-card
pencil (spec Edge Cases, FR-012) — keep always-available equivalents (top build controls;
focus-visible). The border-resize handle is a desktop pointer enhancement only; it is **not** a
required touch affordance (the spec's no-hover edge case does not cover resize), and card width
always opens at its default, so no touch resize equivalent is needed.

**Project Type**: Single project — Obsidian plugin (flat layout at repo root), same as 001.

**Performance Goals**: Rename in < 3 s and add-via-"+" to typing in < 3 s (SC-002/SC-006); inline
edit and resize feel instant; resize updates a single CSS variable (no re-layout of the model, no
re-parse), so dragging stays smooth on large maps (Constitution II).

**Constraints**: Markdown stays the single source of truth and byte-stable round-trip (icons
included); width changes never touch the file (FR-024); unmanaged content (incl. newly-preserved
activity body) preserved verbatim; custom SVG sanitized before store/render (FR-017); theme-aware,
keyboard-operable (FR-020); offline; no telemetry; clean unload (no leaked pointer/hover listeners).

**Scale/Scope**: Same single-file maps as 001 (a few releases, ~6–12 activities, hundreds of cards).
Five user stories: US1 (P1), US2/US3 (P2), US4/US5 (P3).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan complies | Status |
|---|-----------|------------------------|--------|
| I | Markdown as the Single Source of Truth | Only `src/core/serialize` writes the file; the one format change (activity `icon:` field) is stripped on parse / re-emitted on save and covered by round-trip tests; capturing activity body fixes a latent preservation gap (FR-016/FR-021); width is view-only and never written (FR-024). | ✅ PASS |
| II | Lightweight & Performant | No new runtime dependency — Lucide is bundled in Obsidian; resize mutates one CSS variable (no re-parse/re-layout of the model); native pointer/DnD only. | ✅ PASS |
| III | Reusable & Project-Agnostic | No project/vault-specific assumptions; icons optional with clean no-icon rendering; defaults (default width, always-on numbering) require zero setup. | ✅ PASS |
| IV | Well-Designed, Minimal UX | Direct inline editing replaces a multi-step gesture; resting board hides pencil/"+"/handle clutter (SC-008) while keeping every affordance reachable; uniform width restores at-a-glance legibility. | ✅ PASS |
| V | Obsidian-Native Integration | Bundled Lucide via `setIcon`/`getIconIds`; theme CSS variables (incl. the new width variable); modals via `Modal`; internal links stay navigable from card details (FR-019); all new listeners registered for clean unload. | ✅ PASS |

**Result**: No violations. One data-safety obligation (custom SVG) is met by sanitizing before
store/render (FR-017); recorded in research, not a deviation. Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-board-ux-improvements/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — decisions R10–R15
├── data-model.md        # Phase 1 output — Activity.body/icon, ActivityIcon, card width (view state)
├── quickstart.md        # Phase 1 output — US1–US5 validation scenarios
├── contracts/           # Phase 1 output
│   ├── markdown-format.md   # §8 icon field + activity-body capture (delta to 001 format)
│   └── core-api.md          # Activity.body/icon, ActivityIcon, setActivityIcon, icon parse/serialize
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── core/                          # PURE, Obsidian-independent — unit-tested
│   ├── model.ts        # CHANGE: Activity gains `body: string` + `icon: ActivityIcon | null`;
│   │                   #         add `ActivityIcon` type + `setActivityIcon` helper;
│   │                   #         add/addCard accept empty title (draft creation, FR-002)
│   ├── parser.ts       # CHANGE: capture activity body verbatim; strip leading `icon:` field (FR-016)
│   ├── serializer.ts   # CHANGE: re-emit `icon:` field + activity body after the `##` heading
│   ├── numbering.ts    # unchanged
│   └── detect.ts       # unchanged
└── view/                          # Obsidian-coupled UI
    ├── StoryMapView.ts # CHANGE: session card-width state (reset on setViewData); a non-persisting
    │                   #         "draft" apply path so empty new nodes never hit the file (FR-002)
    ├── board.ts        # CHANGE: inline number+title label (US1); hover "+" activity card (US4);
    │                   #         apply shared-width CSS var + border resize handles (US3);
    │                   #         activity edit opens icon-aware modal (US5)
    ├── card.ts         # CHANGE: single-click title → inline edit; pencil → two-field modal (US1/US2)
    ├── interactions.ts # CHANGE: reuse `editInline` for click-to-edit + draft commit/discard;
    │                   #         add `makeResizable` (border drag, clamped, gesture-isolated, US3)
    └── icon.ts         # NEW: render an ActivityIcon (Lucide setIcon / sanitized SVG); Lucide
                        #      picker + custom-SVG input; DOM-based SVG sanitizer (FR-017)

tests/core/
├── parser.test.ts      # CHANGE: activity body captured; `icon:` line stripped to model `icon`
├── serializer.test.ts  # CHANGE: icon + activity body re-emitted in canonical shape
├── roundtrip.test.ts   # CHANGE: fixture(s) with icons + activity body round-trip byte-for-byte
└── icon.test.ts        # NEW: icon parse/format/round-trip + pure unsafe-SVG guard

styles.css              # CHANGE: --usm-card-width variable on grids/cards; inline label; resize
                        #         handle + cursor; hover "+" activity card; icon slot; modal fields
fixtures/
└── the-knight.md       # CHANGE/ADD: include an activity icon + activity body to exercise the format
```

**Structure Decision**: Keep the parent feature's single flat Obsidian-plugin layout and its
defining `src/core/` (pure) vs. `src/view/` (Obsidian-coupled) split. This feature deliberately
concentrates the *only* format/round-trip change (activity icons + body) in `src/core/` behind the
existing unit tests, and keeps every interaction/visual change (inline edit, modal, resize, hover
"+", icon picker, sanitization) in `src/view/` where it cannot threaten the round-trip guarantee.
The new `src/view/icon.ts` isolates all Lucide/SVG handling so icon concerns don't leak across the
view.

## Complexity Tracking

> No constitution violations — section intentionally empty.
