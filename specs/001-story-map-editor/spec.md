# Feature Specification: Story Map Editor

**Feature Branch**: `001-story-map-editor`

**Created**: 2026-06-13

**Status**: Draft

**Input**: User description: "v0.1 Obsidian plugin that displays clean markdown user story maps in a GUI that enables users to edit and build user story maps for use in other projects"

## User Scenarios & Testing *(mandatory)*

A user story map organizes a product's work along two dimensions: a left-to-right
**backbone** of high-level **activities**, and, beneath each activity, **story** cards grouped
into named **release** bands that cut across the whole map. This feature lets a user open a
Markdown file that holds such a map and work with it through a clean visual board instead of
editing raw Markdown by hand — while the Markdown file stays the source of truth so the map can
be reused in any project.

The map is stored in a fixed, human-readable Markdown convention (see Clarifications and
Assumptions): a `# Releases` section defines the release bands once, and a `# Activities`
section holds each activity (`##`) with release sub-groups (`###`) containing story cards
(`####`). Releases are referenced by name, so they cut across all activities.

### User Story 1 - View a Markdown map as a visual board (Priority: P1)

A user opens a Markdown file that contains a user story map and sees it rendered as a clean
visual board: activities across the top as the backbone, with story cards beneath each activity
arranged into the release bands that cut across the map. They can read the whole map structure
at a glance without parsing the raw Markdown.

**Why this priority**: Visualization is the core reason the plugin exists and the smallest
slice that delivers standalone value. Even with no editing, turning an existing Markdown map
into a legible board is immediately useful and is a prerequisite for all editing.

**Independent Test**: Open a sample Markdown map file and confirm the board displays every
activity, release band, and story card in the correct hierarchy and order, with no raw Markdown
visible. Delivers value as a read-only map viewer.

**Acceptance Scenarios**:

1. **Given** a Markdown file containing a well-formed story map, **When** the user opens it in
   the map view, **Then** all activities appear left-to-right as the backbone, and each story
   card appears in the column under its activity within its release band, in document order.
2. **Given** a story map whose `# Releases` section defines named release bands, **When** the
   user views it, **Then** cards are visually grouped into their respective release bands (by
   name) with the release titles and subtitles shown.
3. **Given** a Markdown file that is empty or contains no recognizable map structure, **When**
   the user opens it in the map view, **Then** an empty-state message explains how to start a
   map rather than showing an error.
4. **Given** a card whose text contains an internal link to another note, **When** the map is
   displayed, **Then** the link is shown and remains usable to navigate to that note.

---

### User Story 2 - Edit map content in place (Priority: P2)

A user editing a displayed map changes the text of a card, a release, or an activity directly on
the board. The change is written back into the underlying Markdown file without disturbing the
rest of the file's content or formatting.

**Why this priority**: Editing turns the viewer into a working tool. It depends on P1 being in
place and is the second-most-valuable slice, but the map is still useful for viewing without
it.

**Independent Test**: Open a map, rename a card and an activity, confirm the board reflects the
change, then inspect the Markdown file to confirm only the targeted text changed and the file
still opens as the same map.

**Acceptance Scenarios**:

1. **Given** a displayed map, **When** the user edits a card's text and confirms, **Then** the
   board shows the new text and the underlying Markdown file is updated to match.
2. **Given** a Markdown file that contains content the plugin does not manage (e.g.
   frontmatter, notes, or links elsewhere in the file), **When** the user edits a card, **Then**
   that unmanaged content is preserved unchanged.
3. **Given** a map edited through the board and then saved and reopened, **When** no further
   changes are made, **Then** the reopened map is identical to what was saved (round-trip
   stable).
4. **Given** an edit in progress, **When** the user cancels it, **Then** neither the board nor
   the file is changed.

---

### User Story 3 - Build and restructure a map (Priority: P3)

A user creates a new map or grows an existing one by adding releases, activities, and story
cards, removing them, and reordering them on the board. The Markdown file is kept in sync so the
resulting map can be committed to a project repository and reused elsewhere.

**Why this priority**: Authoring from scratch is the most complete capability but the largest
slice; viewing and editing existing maps already deliver value before this exists.

**Independent Test**: Starting from an empty file, define two releases, add two activities, add
story cards under an activity within a release, reorder a card, delete a card, and confirm both
the board and the Markdown file reflect the final structure and reopen identically.

**Acceptance Scenarios**:

1. **Given** an empty or new map file, **When** the user adds a release, an activity, and a story
   card under that activity within the release, **Then** all three appear on the board and are
   persisted to the Markdown file in the defined convention.
2. **Given** a map with multiple cards in an activity×release cell, **When** the user reorders
   them, **Then** the new order is shown and reflected in the Markdown file's order.
3. **Given** an existing activity, release, or card, **When** the user deletes it, **Then** it
   and its contained cards are removed from the board and the file after a confirmation.
4. **Given** a newly built map saved to a file, **When** that file is opened in another vault or
   project, **Then** it renders as the same map.

---

### Edge Cases

- **Malformed structure**: A file partially matches the map convention (e.g. a card under a
  release name not declared in `# Releases`, an activity outside `# Activities`, or inconsistent
  heading nesting). The view shows what it can and clearly indicates the unrecognized parts
  rather than failing.
- **Very large maps**: A map with many activities and hundreds of cards remains navigable
  (scrollable on both axes) and responsive.
- **External edits**: The same file is changed outside the board (raw editor or another device
  sync) while the board is open. The board reflects the latest saved file and does not overwrite
  external changes with stale data.
- **Non-map Markdown**: A normal note with no map structure opens without corrupting the file
  and offers a clear empty/initialize state.
- **Special characters and links**: Card text containing Markdown syntax, internal links, or
  unicode is displayed and preserved correctly on round-trip.
- **Duplicate names**: Two activities or cards share the same text; each remains individually
  addressable and editable because activities are addressed by backbone position and cards by
  their order within a cell — not by their text. Release names, by contrast, are the cross-cutting
  key, so two releases sharing a name is treated as a malformed structure and surfaced to the user.

## Clarifications

### Session 2026-06-13

- Q: How should the activity × release grid serialize into the Markdown file? → A: Activity-major,
  heading-based. A `# Releases` section defines releases once; a `# Activities` section holds each
  activity (`##`), with release sub-groups (`###`) containing story-card headings (`####`).
- Q: How is a release referenced inside an activity? → A: By name (e.g. `### Walking skeleton`),
  not by ordinal — so renumbering or reordering releases never remaps cards.
- Q: How deep is the backbone hierarchy for v0.1? → A: Activities only; no intermediate "step"
  tier. Story cards sit directly under each activity, grouped by release.
- Q: Can a story card hold detail content? → A: Yes; a `####` card heading may optionally contain
  body text (its user story / acceptance criteria). The board shows the title and surfaces the
  detail when the card is opened.
- Q: Must every activity list every release? → A: No; an activity includes only the release
  sub-headings it actually has cards in (sparse releases allowed).
- Q: Are per-activity icons part of the format? → A: Not in v0.1; the Markdown stays icon-free.
  Icons are deferred as a possible later view-layer enhancement.
- Q: Should activities, releases, and stories be auto-numbered, and where do the numbers live? →
  A: Yes. Numbers are auto-derived from position and **written into the heading text** on save —
  activities as Roman numerals (`## I. Enter & orient`), release groups as `R{n}` (`### R1. Walking
  skeleton`), and story cards as `{n}` (`#### 1. Start the game`). The parser **strips** these
  auto-number prefixes to recover the clean underlying identity (release name "Walking skeleton",
  card title "Start the game"), so name-based referencing (FR-018) and reordering still hold.
- Q: Where does the story-card counter restart? → A: Per cell — each activity×release group
  numbers its cards `1, 2, 3…` independently (matching the board's visual grouping). Activity
  Roman numerals follow backbone order; release `R{n}` follows global release order.
- Q: Is numbering configurable in v1? → A: Always on in v1 (no toggle UI yet). A future version
  adds a toggle plus per-map overrides (e.g. start index, custom step like tenths `0.1`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render a Markdown file's story map as a visual board showing
  activities (left-to-right backbone) and the story cards beneath each activity, grouped into the
  release bands that cut across the map.
- **FR-002**: The system MUST present story cards in document order within each activity×release
  cell, and group cards under the release band whose name they are nested within.
- **FR-003**: The system MUST treat the Markdown file as the single source of truth; the board
  is a view over it, and all map state MUST be reconstructable from the Markdown alone.
- **FR-004**: The system MUST allow users to edit the text of activities, releases, and story
  cards from the board and persist those edits back to the Markdown file.
- **FR-016**: The system MUST read and write maps using the defined Markdown convention: a
  `# Releases` section listing releases once as an ordered list (`N. Title - subtitle`), and a
  `# Activities` section where each activity is a `##` heading, each release group within it is a
  `###` heading referenced by release name, and each story card is a `####` heading. Heading text
  carries auto-numbers per FR-019 (e.g. `## I. <name>`, `### R1. <name>`, `#### 1. <title>`).
- **FR-017**: The system MUST preserve any body text beneath a story-card heading (its user story
  / acceptance criteria) on round-trip, display the card by its title, and make that detail
  accessible when the card is opened.
- **FR-018**: The system MUST resolve a card's release by the release name it is nested under
  (not by ordinal), so reordering or renumbering releases never reassigns cards.
- **FR-019**: The system MUST auto-number map elements, derived from position, and write the
  numbers into the heading text on save: activities as Roman numerals (`## I. <name>`), release
  groups as `R{n}` where `{n}` is the release's global order (`### R1. <name>`), and story cards
  as `{n}` restarting per activity×release cell (`#### 1. <title>`). In v1 numbering is always on
  (no toggle).
- **FR-020**: When parsing, the system MUST strip the auto-number prefix from each heading to
  recover the clean underlying identity (activity name, release name, card title). The stripped
  identity — not the numbered text — is what is stored, referenced (FR-018), and edited; a user
  renaming an element changes only the name portion, never the auto-number.
- **FR-021**: The system MUST recompute and rewrite all auto-numbers whenever elements are added,
  deleted, or reordered, so the numbers always reflect current position. This recomputation MUST
  NOT alter any element's underlying identity or reassign cards.
- **FR-022**: Round-trip stability (FR-006) MUST hold with numbering applied: re-saving an
  unchanged numbered map reproduces the file unchanged, and auto-numbers are deterministic from
  order.
- **FR-005**: The system MUST preserve all file content it does not manage (e.g. frontmatter,
  prose, links elsewhere) when writing edits.
- **FR-006**: The system MUST guarantee round-trip stability: viewing then saving a map with no
  intentional change MUST not alter the file's meaningful content or structure.
- **FR-007**: Users MUST be able to add releases, activities, and story cards to a map.
- **FR-008**: Users MUST be able to delete releases, activities, and story cards, with contained
  items removed accordingly, after a confirmation for destructive actions.
- **FR-009**: Users MUST be able to reorder story cards within an activity×release cell, reorder
  activities along the backbone, and reorder releases, with the new order reflected in the file.
- **FR-010**: The system MUST preserve internal links contained in card or node text and keep
  them navigable from the board.
- **FR-011**: The system MUST show a clear empty/initialize state for files with no recognizable
  map, without corrupting the file.
- **FR-012**: The system MUST display partially-recognized or malformed map content gracefully,
  indicating what was not understood instead of failing to open.
- **FR-013**: The system MUST reflect the file's latest saved state when it changes and MUST NOT
  overwrite external changes with stale in-memory data.
- **FR-014**: The map view MUST allow users to navigate large maps by scrolling both axes
  (horizontal backbone and vertical release bands) so all content remains reachable.
- **FR-015**: A map file authored through the plugin MUST be portable — openable and renderable
  identically in any vault or project without additional configuration.

### Key Entities

- **Story Map**: The whole map, backed by one Markdown file. Has an ordered list of releases
  (declared once) and an ordered set of activities.
- **Release**: A named, ordered horizontal band (with a title and optional subtitle) that cuts
  across all activities, organizing story cards by delivery slice/priority. Declared once in the
  `# Releases` section; the name is its identity and the key cards reference. Its display number
  `R{n}` derives from global release order and is stripped from group headings on parse (FR-020).
- **Activity**: A backbone item representing a high-level user goal; ordered along the backbone.
  Contains release-grouped columns of story cards (a `##` heading under `# Activities`). Its
  Roman-numeral label derives from backbone order and is stripped from the heading on parse.
- **Story Card**: A unit of work under an activity within a release. Has a title, an order
  position within its activity×release cell, optional internal links, and optional body content
  (its user story / acceptance criteria). Belongs to exactly one activity and one release (a
  `####` heading nested under a `###` release group). Its display number `{n}` restarts per cell
  and is stripped from the heading on parse.
- **Auto-number**: A position-derived label written into heading text on save (Roman for
  activities, `R{n}` for releases, `{n}` for cards) and stripped on parse. It is presentation, not
  identity: it never participates in referencing and is recomputed on add/delete/reorder (FR-021).
- **Markdown File**: The persistent, canonical representation of the map and the unit of
  portability between projects, structured as a `# Releases` section followed by a `# Activities`
  section.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open an existing Markdown map and see the full visual board within 2
  seconds for a typical map (tens of cards).
- **SC-002**: A first-time user can identify a map's activities, release bands, and story cards
  from the board within 30 seconds, without reading the raw Markdown.
- **SC-003**: 100% of view-then-save operations with no intentional edit leave the file's
  meaningful content unchanged (round-trip stable).
- **SC-004**: 100% of edits made through the board are correctly reflected in the Markdown file,
  with no unmanaged content lost or altered.
- **SC-005**: A user can build a complete small map (2 releases, 3 activities, and several cards)
  from an empty file in under 5 minutes using only the board.
- **SC-006**: A map authored in one project opens and renders identically in a different
  vault/project in 100% of cases, with no extra setup.
- **SC-007**: Large maps (hundreds of cards) remain interactive, with the board responding to
  navigation and edits without noticeable freezing.

## Assumptions

- **Story map convention**: Maps are stored using native Markdown headings (no plugin-private
  data), so files stay human-readable and editable without the plugin. The convention (decided in
  Clarifications) is a `# Releases` section that declares release bands once as an ordered list
  (`N. Title - subtitle`), followed by a `# Activities` section where each activity is `##`, each
  release group within it is `###` (referenced by release name), and each story card is `####`
  with optional body content. This is consistent with the constitution's "Markdown as the Single
  Source of Truth" principle.
- **Backbone depth**: v0.1 uses a single backbone tier — activities only, with no intermediate
  "step/task" tier. Story cards sit directly under each activity, grouped by release.
- **Auto-numbering**: v1 always writes position-derived numbers into headings (Roman for
  activities, `R{n}` for release groups, per-cell `{n}` for cards) and strips them on parse so
  identity stays clean. The `# Releases` declaration keeps its existing `N.` ordered-list
  numbering; the `R{n}` prefix appears on the `###` group headings. A toggle to disable numbering
  and per-map overrides (custom start index, custom step such as tenths `0.1`) are deferred to a
  later version.
- **Scope of v0.1**: Releases are first-class — read, displayed as cross-cutting bands, and
  editable (add/rename/reorder/delete). Per-activity icons are out of scope for v0.1 (the
  Markdown stays icon-free) and may return later as a view-layer enhancement.
- **Single-file maps**: Each map lives in one Markdown file; multi-file/linked maps are out of
  scope for v0.1 (links between notes are preserved but not assembled into one board).
- **Single-user, local editing**: Real-time multi-user collaboration is out of scope; the file
  on disk is the synchronization point.
- **Platform**: The plugin runs inside Obsidian and uses the user's active theme; no external
  services, accounts, or network access are required.
- **No telemetry**: The plugin does not collect or transmit user data.
