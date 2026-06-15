# Feature Specification: Board UX Improvements

**Feature Branch**: `002-board-ux-improvements`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "There are some UX improvements that will be necessary for making the tool more usable: 1. Creating a new card immediately opens title edit 2. clicking a card opens title edit 3. numbering should be inline with title 4. edit pencil opens edit modal with two fields, title and details 5. activity and story cards have a max width set, adding a card creates a column the same width 6. there is a blank \"+\" card to the right of the activity row on hover 7. when adding/editing an activity users can select a Lucide SVG or add a custom one"

## Overview

This feature refines the interaction and visual design of the existing story-map board
(`001-story-map-editor`) so the board feels fast, direct, and tidy to author with. It does not
change what a story map *is* — activities along a backbone, story cards grouped into release
bands — only how the user creates, edits, and arranges those elements. The Markdown file remains
the single source of truth; every change described here must round-trip through that file.

The improvements cluster into four themes: (a) direct inline editing of titles, (b) a focused
two-field modal for fuller edits, (c) consistent, drag-adjustable card/column widths with
hover-revealed add affordances, and (d) optional per-activity icons.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and rename cards directly on the board (Priority: P1)

A user building a map adds a new card and starts typing its title immediately, with no
intermediate empty-card or separate "edit" step. To rename any existing card, they click its
title and type. The card's auto-number stays attached to the title as one continuous label, so
the board reads like a numbered outline.

**Why this priority**: This is the highest-friction part of authoring today. Making creation and
renaming a single direct gesture is the largest usability gain and stands alone as a shippable
improvement.

**Independent Test**: Add an activity, a release, and a story card; confirm each drops straight
into title editing on creation. Click an existing card's title, rename it, and confirm the board
and the Markdown file both reflect the new title with the auto-number preserved.

**Acceptance Scenarios**:

1. **Given** a map on the board, **When** the user creates a new activity, release, or story
   card, **Then** the new card appears already in title-edit mode with the cursor focused, ready
   for typing, without any further click.
2. **Given** a card on the board, **When** the user single-clicks its title, **Then** the title
   enters inline edit mode; **When** the user confirms the edit, **Then** the board shows the new
   title and the underlying Markdown file is updated to match.
3. **Given** a card being renamed inline, **When** the user cancels (e.g. Escape), **Then**
   neither the board nor the file changes.
4. **Given** a newly created card, **When** the user confirms it with an empty title, **Then** the
   empty card is discarded and not written to the file.
5. **Given** any card, **When** it is displayed or edited, **Then** its auto-number (Roman for
   activities, `R{n}` for releases, `{n}` for story cards) is shown inline as a single label with
   the title (e.g. "I. Enter & orient"), and inline editing changes only the title portion, never
   the auto-number.

---

### User Story 2 - Edit a card's title and details in a focused modal (Priority: P2)

A user who wants to write or revise a card's fuller content clicks the card's edit (pencil)
affordance and gets a modal with two fields — Title and Details — edits both, and saves. The
details map to the card's body content (its user story / acceptance criteria).

**Why this priority**: Inline editing (US1) covers quick titling; this story adds the depth needed
to capture real story content. It builds on US1 but delivers independent value for detail-heavy
work.

**Independent Test**: Open a story card's edit modal, change the title and add multi-line details,
save, and confirm both are persisted to the Markdown file (title in the heading, details in the
body) and shown on reopening; cancel a separate edit and confirm nothing changes.

**Acceptance Scenarios**:

1. **Given** a card on the board, **When** the user activates its pencil affordance, **Then** an
   edit modal opens showing exactly two text fields: Title and Details (for an activity, the modal
   also shows an icon selector alongside those two fields — see US5).
2. **Given** the edit modal open with changes to both fields, **When** the user saves, **Then**
   the title and the details are written back to the Markdown file (title to the heading, details
   to the card body) without disturbing unmanaged file content, and the board reflects the new
   title.
3. **Given** the edit modal open with changes, **When** the user cancels, **Then** neither the
   board nor the file changes.
4. **Given** a card with existing body content, **When** the user opens its modal, **Then** the
   Details field is pre-populated with that body content.

---

### User Story 3 - Consistent, adjustable card and column widths (Priority: P2)

A user looking at a map sees activity and story cards at a single shared width, with every column
sized to that same width, so the grid stays aligned and scannable. When that width doesn't suit
the user, they drag a card's left or right border to make all cards wider or narrower at once,
within sensible limits. The adjustment lasts for the session and resets to the default on reopen.

**Why this priority**: A ragged, variable-width grid undermines the at-a-glance legibility that is
the board's reason to exist. A consistent width is independently valuable and visible on any map;
letting the user tune that one width adapts the board to their screen without breaking alignment.

**Independent Test**: Open a map and confirm all activity columns are the same width. Add a card
with very long text and confirm the card and its column do not exceed the shared width and other
columns are unaffected. Drag a card border wider and confirm every card and column grows together;
drag past the limits and confirm the width stops at the min/max bounds; reopen the file and confirm
it returns to the default width.

**Acceptance Scenarios**:

1. **Given** a map with multiple activities, **When** it is displayed, **Then** every activity
   column renders at the same width, equal to the shared card width.
2. **Given** a card whose text exceeds the card width, **When** it is displayed, **Then** the card
   stays within that width (text wraps or is contained) rather than widening the column.
3. **Given** an activity column, **When** the user adds a card to it, **Then** the column width is
   unchanged and remains equal to all other columns.
4. **Given** the board, **When** the user drags a card's left or right border, **Then** all cards
   and columns resize together to the new shared width; **And** dragging beyond the minimum or
   maximum bound stops the width at that bound rather than exceeding it.
5. **Given** a map whose width the user has adjusted, **When** the file is closed and reopened,
   **Then** the board returns to the default width and the Markdown file is unchanged by the resize.

---

### User Story 4 - Add an activity with a hover-revealed "+" card (Priority: P3)

A user hovering over the activity backbone row sees a blank "+" card appear at the right end of the
row. Clicking it creates a new activity at the end of the backbone, which (per US1) opens directly
into title editing. The "+" card is hidden when not hovering, keeping the board uncluttered.

**Why this priority**: A discoverable, in-place add affordance is a polish improvement on top of an
already-working "add activity" path; valuable but the smallest slice.

**Independent Test**: Hover the activity row and confirm a "+" card appears at the right end; move
the pointer away and confirm it disappears; click it and confirm a new activity is appended and
enters title-edit mode.

**Acceptance Scenarios**:

1. **Given** the board at rest, **When** the user is not hovering the activity row, **Then** no
   "+" add-activity card is shown.
2. **Given** the board, **When** the user hovers the activity backbone row, **Then** a blank "+"
   card appears at the right end of the row.
3. **Given** the hover "+" card is visible, **When** the user activates it, **Then** a new
   activity is appended to the backbone and immediately enters title-edit mode (US1).

---

### User Story 5 - Give an activity an icon (Priority: P3)

A user editing an activity (via its pencil/edit modal) can assign it an icon to make the backbone
more scannable, choosing either from the Lucide icon set or by supplying a custom SVG. The chosen
icon shows on the activity card and is saved so it survives close/reopen. Activities without an icon
render cleanly.

**Why this priority**: Icons are a recognized later enhancement (deferred from v0.1). They improve
scannability but are the least essential of these improvements and depend on a format decision.

**Independent Test**: Edit an activity, pick a Lucide icon, save, and confirm it shows on the card
and persists on reopen. Repeat with a custom SVG. Confirm an activity with no icon renders without
a placeholder gap.

**Acceptance Scenarios**:

1. **Given** the edit modal for an activity, **When** the user opens the icon selector, **Then**
   they can browse/search the Lucide icon set and choose an icon.
2. **Given** the icon selector, **When** the user instead provides a custom SVG, **Then** that
   custom icon can be assigned to the activity.
3. **Given** an activity with an assigned icon, **When** the activity is displayed, **Then** the
   icon appears on the activity card; **When** the file is closed and reopened, **Then** the icon
   is still present (it round-trips through the Markdown file).
4. **Given** an activity with no assigned icon, **When** it is displayed, **Then** it renders
   cleanly with no empty icon placeholder.

---

### Edge Cases

- **Empty new card**: A card created and then confirmed/blurred with no title text is discarded
  rather than persisted, so the board does not accumulate empty cards.
- **Click vs. drag**: A pointer gesture that begins a drag-to-reorder MUST NOT also trigger inline
  title editing; the two gestures stay distinct.
- **Card containing an internal link**: Because single-clicking a title now edits it, link
  navigation must remain available another way (e.g. links live in / are reachable from the card
  details) so users can still follow internal links from a card.
- **Very long titles**: A title longer than the card width wraps or is contained within the maximum
  width; the full text remains accessible (e.g. via the edit modal).
- **Invalid or unsafe custom SVG**: A custom SVG that is malformed or contains unsafe/active markup
  is rejected or sanitized rather than rendered as-is. A custom SVG (including one pasted across
  multiple lines) is normalized to a single line when stored, so it occupies one `icon:` line in the
  Markdown body and round-trips through the single-line `icon:` field (see contracts/markdown-format §8.4).
- **Touch / no-hover devices**: Where hover is unavailable, the "+" add-activity affordance and the
  per-card pencil must still be reachable (e.g. always shown or via an equivalent control).
- **Border drag at the limits**: Dragging a card border past the minimum or maximum width clamps to
  the bound (≈180–420px) rather than continuing; the resize cursor/affordance only appears on the
  border so it is not confused with selecting, editing, or reordering the card.
- **Icon for a renamed/deleted activity**: Renaming an activity keeps its icon; deleting the
  activity removes its icon with it; an icon never leaks onto another activity.
- **Unknown Lucide icon on load**: If a saved Lucide icon name is not recognized (e.g. renamed in a
  later Lucide version), the activity still renders (icon omitted or shown as a neutral fallback)
  without breaking the board.

## Clarifications

### Session 2026-06-14

- Q: How should an activity's icon (Lucide name or custom SVG) be stored in the Markdown file? →
  A: As a structured key at the top of the activity's body content — an `icon:` line holding the
  Lucide icon name, or a custom SVG carried in the body. This keeps the activity heading (and its
  auto-number) clean, is per-activity by construction (no name/position coupling), and round-trips
  with the existing card-body mechanism. The parser recognizes and strips this field from the body
  so it is not mistaken for story content, and re-emits it on save.
- Q: Where should a map's adjusted card width be stored so it persists? → A: It is not persisted —
  card width is a view-only, in-session setting. The board opens at a default width each time; the
  user's drag adjustments last for the session and reset on reopen. This keeps the Markdown
  unchanged (no format or round-trip impact) since width is pure presentation.
- Q: When the user drags a card border, which cards' width changes? → A: A single global width for
  all cards — activities and story cards share one width, and dragging any card border resizes every
  card and column uniformly, consistent with the uniform-column rule (FR-010).
- Q: What min/max range bounds the card width? → A: Approximately 180px (min) to 420px (max); drag
  resizing is clamped to this range so cards never become unusably narrow or wide.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Creating a new node (activity, release, or story card) MUST immediately place its
  title into inline edit mode with input focus, so the user can type the title with no additional
  click or intermediate empty-card step.
- **FR-002**: A new node confirmed or blurred with an empty title MUST be discarded and MUST NOT be
  written to the Markdown file; cancelling creation MUST leave the map and file unchanged.
- **FR-003**: Single-clicking a node's title on the board MUST enter inline title-edit mode for
  that node. Confirming the edit MUST persist the new title to the Markdown file; cancelling MUST
  leave the board and file unchanged.
- **FR-004**: The board MUST display each node's auto-number inline with its title as a single
  continuous label (e.g. "I. Enter & orient", "R1. Walking skeleton", "1. Start the game") rather
  than as a separate or detached element.
- **FR-005**: Inline title editing MUST modify only the title portion of a node, never its
  auto-number prefix, consistent with the parent feature's identity rules (auto-numbers are
  position-derived presentation, not identity).
- **FR-006**: Each node card MUST present an edit (pencil) affordance that opens an edit modal for
  that node.
- **FR-007**: The edit modal MUST present exactly two text fields — Title and Details — where
  Details maps to the node's body content (its user story / acceptance criteria), pre-populated from
  any existing body content. For an activity, the same modal additionally exposes an icon selector
  (FR-013); this icon control is a distinct affordance and is not counted among the two text fields,
  so the modal stays a two-text-field surface for every node type.
- **FR-008**: Saving the edit modal MUST persist both the title and the details to the Markdown
  file (title to the heading, details to the body), preserving round-trip stability and all
  unmanaged file content; cancelling the modal MUST discard all changes.
- **FR-009**: Activity and story cards MUST render at a single shared width; content exceeding that
  width MUST wrap or be contained rather than widening the card. The board MUST open at a sensible
  default width of 240px, which lies within the clamp range defined in FR-023.
- **FR-010**: Every activity column MUST be sized to the shared card width so all columns share a
  consistent width; adding or removing cards in a column MUST NOT change its width.
- **FR-011**: When the user hovers the activity backbone row, a blank "+" add-activity card MUST
  appear at the right end of the row; activating it MUST append a new activity and (per FR-001)
  immediately open its title for editing.
- **FR-012**: The hover "+" add-activity card MUST be hidden in the board's resting (non-hover)
  state so it adds no permanent visual clutter, while remaining reachable on devices without hover.
- **FR-013**: When editing an activity, the user MUST be able to assign an icon, choosing either
  from the Lucide icon set or by supplying a custom SVG; assigning an icon MUST be optional. The
  icon selector lives in the activity's edit modal (FR-007), reached via the pencil affordance.
  Because creating an activity drops straight into inline title editing (FR-001) with no modal, icon
  assignment happens through this edit flow after creation rather than at the moment of creation.
- **FR-014**: When choosing a Lucide icon, the user MUST be able to browse and/or search the
  available Lucide icons.
- **FR-015**: An assigned activity icon MUST be displayed on that activity's card on the board;
  activities with no icon MUST render cleanly with no empty placeholder.
- **FR-016**: An activity's icon (whether a Lucide reference or a custom SVG) MUST be persisted in
  the Markdown file so it round-trips and the Markdown remains the single source of truth. The icon
  MUST be stored as a structured field at the top of the activity's body content — a simple
  `icon:` line carrying the Lucide name, or a custom SVG carried in the activity body — so the
  activity heading (and its auto-number) is untouched and the field is per-activity by
  construction (see Clarifications). The parser MUST recognize and strip this field from the
  body so it is not treated as story content, and MUST re-emit it on save.
- **FR-017**: A custom SVG icon that is malformed or contains unsafe/active content MUST NOT be
  stored or rendered raw. On parse, a likely-unsafe value is **rejected** (the icon is not assigned
  and the raw line is preserved in the activity body rather than corrupting the file); before render,
  the SVG is **DOM-sanitized** (unsafe/active markup stripped). This satisfies the plugin's
  data-safety obligations.
- **FR-018**: A pointer gesture that initiates drag-to-reorder MUST NOT also trigger inline title
  editing, keeping reorder and edit as distinct gestures.
- **FR-019**: Internal links contained in a node MUST remain navigable from the board even though
  single-clicking a title now edits it (e.g. links are followed from the card details rather than
  by clicking the title).
- **FR-020**: All new interactions (inline edit, edit modal, icon selector, hover "+" card) MUST
  respect the user's active Obsidian theme and remain operable via keyboard.
- **FR-021**: Every change introduced by this feature (inline title edits, modal title/detail
  edits, added activities, assigned icons) MUST preserve the parent feature's round-trip stability:
  re-saving an unchanged map reproduces the file unchanged.
- **FR-022**: The user MUST be able to adjust the shared card width by clicking and dragging a
  card's left or right border; the adjustment MUST apply uniformly to all cards and columns
  (a single global width), keeping the grid consistent.
- **FR-023**: Drag-resizing MUST be clamped to a defined minimum and maximum width (approximately
  180px to 420px) so cards can never be dragged to an unusable size.
- **FR-024**: The adjusted card width MUST be view-only and is NOT persisted to the Markdown file or
  to plugin storage: it applies for the current session and resets to the default width when the
  file is reopened. This MUST NOT alter the Markdown file in any way (no format or round-trip
  impact), since width is presentation, not map state.
- **FR-025**: Border-resize MUST be a third distinct gesture alongside the title-edit/reorder
  distinction of FR-018: dragging a card border MUST NOT trigger inline title editing (FR-003) or
  drag-to-reorder (FR-018).

### Key Entities *(include if feature involves data)*

- **Activity Icon**: An optional visual marker attached to an activity to aid scanning the
  backbone. It is one of two kinds — a reference to a named icon in the Lucide set, or a custom SVG
  supplied by the user. It is optional, belongs to exactly one activity, and is persisted in the
  Markdown file so it round-trips. It is presentation, not identity, and does not affect
  referencing, ordering, or auto-numbering.
- **Card Detail (Details field)**: The fuller body content of a node (its user story / acceptance
  criteria), surfaced and edited through the edit modal's Details field and stored as the node's
  Markdown body — the same body content defined by the parent feature, now given a first-class
  editing surface.

*(All other entities — Story Map, Release, Activity, Story Card, Auto-number, Markdown File — are
unchanged from `001-story-map-editor`; this feature adds the Activity Icon and a dedicated editing
surface for card details.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can begin typing a new card's title in a single action — creating a card and
  reaching an editable, focused title takes exactly one interaction with no intermediate step.
- **SC-002**: A user can rename any card from the board with a single click on its title, type, and
  confirm — completing a rename in under 3 seconds.
- **SC-003**: 100% of nodes display their auto-number inline with their title as one label, with no
  detached number element anywhere on the board.
- **SC-004**: A user can edit a card's title and details together in one modal, and both are
  persisted to the Markdown file with round-trip stability in 100% of saves.
- **SC-005**: All activity columns render at a single uniform width on any map, and adding or
  removing cards changes no column's width — verifiable as identical column widths regardless of
  card count.
- **SC-006**: A user can add a new activity via the hover "+" card and be typing its title in under
  3 seconds, and the "+" card is not visible in the resting state.
- **SC-007**: A user can assign a Lucide or custom-SVG icon to an activity and see it persist
  unchanged across a close-and-reopen of the file in 100% of cases.
- **SC-008**: The board's resting state shows no per-card pencil clutter or "+" affordance beyond
  what hover/focus reveals, while every such affordance remains reachable (including without
  hover).
- **SC-009**: A user can drag a card border to resize all cards and columns together; the width
  stays within the ~180–420px bounds (it cannot be dragged outside them) and returns to the default
  on reopen, with the Markdown file unchanged by the resize.

## Assumptions

- **Uniform card behavior**: Items 1–2 ("creating a new card", "clicking a card") apply to all node
  types rendered as cards — activities, releases, and story cards — since the parent feature renders
  all three as cards and item 5 explicitly groups "activity and story cards".
- **Title vs. details split**: The edit modal's "Details" field is the existing card body content
  (user story / acceptance criteria) defined by the parent feature (FR-017 there); this feature
  adds no new storage location for details, only a dedicated editing surface.
- **Empty-card cleanup**: A newly created card left empty is discarded rather than persisted as a
  blank node, to keep the board and file clean.
- **Click resolves to edit; drag resolves to reorder; links live in details**: Single-click on a
  title edits it; a drag gesture reorders; internal link navigation is preserved via card details
  rather than by clicking the title, resolving the tension between inline editing and the parent
  feature's "links remain navigable" requirement.
- **Card width is one shared, user-adjustable, view-only value**: There is a single card width
  shared by all cards and columns. It opens at a sensible default (240px, within the ~180–420px
  range) and the user can drag a card border to change it for the session.
  The width is not persisted — it resets to the default on reopen and never alters the Markdown file
  (per FR-022–FR-025) — so it stays pure presentation and does not affect portability or round-trip.
- **Icons are activity-only**: Item 7 scopes icons to activities; releases and story cards do not
  gain icons in this version.
- **Lucide is bundled/available**: The Lucide icon set is available to the plugin (Obsidian ships
  Lucide), so offering Lucide icons adds no external service or network dependency, consistent with
  the constitution's lightweight and no-telemetry principles.
- **Reintroducing icons updates a prior decision**: The parent feature explicitly kept the Markdown
  icon-free and deferred icons; this feature reintroduces them as the planned later enhancement.
  The format decision (FR-016 / Clarifications) — an `icon:` field in the activity body — keeps
  "Markdown as the single source of truth" intact and is an additive extension to the existing
  card-body convention rather than a change to headings or auto-numbering.
