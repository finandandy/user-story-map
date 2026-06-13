<!--
SYNC IMPACT REPORT
==================
Version change: (none) → 1.0.0
Bump rationale: Initial ratification — template populated with concrete principles.

Modified principles: N/A (initial adoption)
Renamed principles:
  [PRINCIPLE_1_NAME] → I. Markdown as the Single Source of Truth
  [PRINCIPLE_2_NAME] → II. Lightweight & Performant
  [PRINCIPLE_3_NAME] → III. Reusable & Project-Agnostic
  [PRINCIPLE_4_NAME] → IV. Well-Designed, Minimal UX
  [PRINCIPLE_5_NAME] → V. Obsidian-Native Integration

Added sections:
  - Technical Constraints (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])

Removed sections: None

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check is generic; no change needed
  ✅ .specify/templates/spec-template.md — no constitution coupling; no change needed
  ✅ .specify/templates/tasks-template.md — no constitution coupling; no change needed
  ✅ .specify/templates/commands/*.md — none present requiring updates

Follow-up TODOs: None
-->

# User Story Map Plugin Constitution

## Core Principles

### I. Markdown as the Single Source of Truth

The canonical representation of every user story map is a plain Markdown file in the
user's vault. The GUI is a view and editor over that file — never a separate data store.

- All map state (structure, ordering, content, links) MUST be expressible in, and
  reconstructable from, Markdown alone. No state may live only in plugin-private storage.
- Edits made in the GUI MUST round-trip: opening a map, saving it unchanged, and reopening
  it MUST produce a byte-stable file (modulo intentional edits).
- The plugin MUST be non-destructive: it MUST NOT silently reorder, reformat, or discard
  Markdown content (including user comments, frontmatter, and links) that it does not own.
- The Markdown schema for maps MUST use native Markdown constructs (headings, lists,
  links) so that files remain readable and editable without the plugin.

**Rationale**: Markdown's heading/list hierarchy naturally expresses the depth of a story
map and supports Obsidian's native linking. Treating it as the source of truth guarantees
portability, version-control friendliness, and zero lock-in.

### II. Lightweight & Performant

The plugin MUST stay small, fast, and dependency-minimal.

- Third-party runtime dependencies MUST be justified; prefer the Obsidian API and the
  platform over adding libraries. Heavyweight UI frameworks are disallowed unless a
  documented justification shows no lighter path exists.
- The plugin MUST NOT block Obsidian startup; initialization work MUST be deferred or lazy.
- Rendering and interaction on a typical map MUST feel instant; expensive work MUST be
  incremental and MUST NOT freeze the UI thread.

**Rationale**: "Simple and lightweight" is a stated product goal. Obsidian users run many
plugins; ours must be a good citizen of their performance budget.

### III. Reusable & Project-Agnostic

The plugin MUST work for any project in any vault without per-project configuration coupling.

- No project-, domain-, or vault-specific assumptions may be hardcoded. Any such values
  MUST be configuration or inferred from the file.
- The map format and UI MUST be generic enough to drop into a new project and use
  immediately, with sensible defaults requiring zero setup.
- Configuration SHOULD be optional; the plugin MUST be usable out of the box.

**Rationale**: Reusability across projects is a core requirement. Generic, convention-based
behavior maximizes the plugin's value and minimizes onboarding friction.

### IV. Well-Designed, Minimal UX

The interface MUST favor clarity and restraint over feature count.

- Every UI element MUST earn its place; when in doubt, leave it out. Features that
  complicate the common path MUST be deferred or made opt-in.
- The GUI MUST make the story-map structure (backbone, activities, steps, stories)
  visually legible at a glance.
- Interactions MUST be discoverable and consistent; destructive actions MUST be reversible
  (undo) or confirmed.
- Visual design MUST be intentional and coherent, not an accumulation of ad-hoc controls.

**Rationale**: A "well designed, lightweight GUI" is the product's reason to exist. Good
design is a constraint, not a nice-to-have.

### V. Obsidian-Native Integration

The plugin MUST behave like a native part of Obsidian.

- It MUST use the official Obsidian plugin API and lifecycle (load/unload, settings,
  views) and MUST clean up all resources on unload — no leaks, no orphaned listeners.
- It MUST respect the user's active theme (light/dark, custom themes) and MUST NOT hardcode
  colors that break theming.
- It MUST honor Obsidian's linking model so map nodes can link to and from other notes.
- It MUST NOT modify files or settings outside the scope of the map being edited.

**Rationale**: Fighting the platform produces fragile, jarring plugins. Native integration
delivers a trustworthy experience and keeps the plugin maintainable across Obsidian updates.

## Technical Constraints

- **Language & API**: TypeScript against the official Obsidian plugin API; build output
  MUST conform to Obsidian's plugin packaging (`manifest.json`, `main.js`, `styles.css`).
- **Compatibility**: The plugin MUST declare and respect a `minAppVersion` and MUST NOT use
  undocumented/private Obsidian internals.
- **Dependencies**: Runtime dependencies are minimized per Principle II. Each addition MUST
  be recorded with its justification.
- **Data safety**: All file writes MUST go through the Obsidian vault API. The plugin MUST
  never corrupt or partially write a map file; writes MUST be atomic from the user's view.
- **No telemetry**: The plugin MUST NOT phone home or collect user data.

## Development Workflow & Quality Gates

- **Constitution check**: Every plan and feature MUST be checked against these principles
  before implementation. Violations MUST be justified in writing or the design changed.
- **Round-trip verification**: Any change touching the Markdown ↔ GUI mapping MUST be
  verified for round-trip stability (Principle I) before merge.
- **Manual UX review**: Changes to the GUI MUST be exercised against the design bar in
  Principle IV before merge.
- **Simplicity gate**: New configuration, dependencies, or UI surface MUST be challenged —
  the default answer is "no" unless a principle or clear user need requires it.

## Governance

This constitution supersedes ad-hoc practice for the User Story Map plugin. When guidance
here conflicts with convenience, this document wins.

- **Amendments**: Changes to this constitution MUST be made by editing this file with a
  version bump and an updated Sync Impact Report. Dependent templates and docs MUST be
  re-checked for consistency as part of the amendment.
- **Versioning policy**: This document follows semantic versioning. MAJOR = removal or
  backward-incompatible redefinition of a principle or governance rule; MINOR = a new
  principle/section or materially expanded guidance; PATCH = clarifications and wording.
- **Compliance review**: Plans, features, and reviews MUST verify compliance with these
  principles. Any accepted deviation MUST be documented with its rationale and, where
  applicable, a remediation path.

**Version**: 1.0.0 | **Ratified**: 2026-06-13 | **Last Amended**: 2026-06-13
