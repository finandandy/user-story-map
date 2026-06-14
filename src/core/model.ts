/*
 * Core data model for a story map (contracts/core-api.md §Types).
 *
 * This module is the pure, Obsidian-independent heart of the plugin
 * (Constitution I) — it imports nothing from `obsidian`. Auto-number prefixes
 * are NEVER stored here; titles are clean identities (FR-020).
 *
 * Mutation helpers (add/delete/reorder/rename/edit) and `createEmptyMap` are
 * introduced in later phases (US2 / US3); Phase 2 defines the types only.
 */

export interface StoryMap {
  releases: Release[];
  activities: Activity[];
  /** Raw YAML frontmatter block, preserved verbatim (managed key: story-map). */
  frontmatter: string;
  /** Raw content between the frontmatter and `# Releases`, preserved verbatim. */
  preamble: string;
  /** Raw content after the `# Activities` section, preserved verbatim. */
  trailing: string;
  diagnostics: Diagnostic[];
}

export interface Release {
  /** Identity / cross-cutting key (text before the first " - "). */
  title: string;
  subtitle: string | null;
  /** 0-based position in the `# Releases` declaration. */
  order: number;
}

export interface Activity {
  title: string;
  /** 0-based position along the backbone. */
  order: number;
  /** Release-band cells keyed by release title; insertion order is incidental. */
  cells: Map<string, Card[]>;
}

export interface Card {
  /** Clean identity (auto-number prefix stripped). */
  title: string;
  /** Raw markdown body, preserved. Empty string when the card has no body. */
  body: string;
  /** 0-based position within its activity×release cell. */
  order: number;
  activityTitle: string;
  releaseTitle: string;
}

export interface Diagnostic {
  severity: "warning" | "error";
  message: string;
  line: number | null;
}

/**
 * Addresses a single card by position (contracts/core-api.md §Addressing model):
 * its activity's backbone index, the release-band title, and the card's order
 * within that activity×release cell. Position-based so duplicate titles stay
 * individually addressable.
 */
export interface CardRef {
  activityIndex: number;
  releaseTitle: string;
  order: number;
}

// --- Edit mutation helpers (US2 / FR-004/FR-005/FR-018) ---------------------
//
// Each returns a NEW StoryMap and never mutates its input or performs I/O. The
// view calls one of these, then `requestSave()`. Identities are clean titles;
// auto-numbers are derived later by `serialize`, never stored here (FR-020).

/** Deep-clone a StoryMap so mutation helpers can return a fresh value. */
function cloneMap(map: StoryMap): StoryMap {
  return {
    releases: map.releases.map((r) => ({ ...r })),
    activities: map.activities.map(cloneActivity),
    frontmatter: map.frontmatter,
    preamble: map.preamble,
    trailing: map.trailing,
    diagnostics: map.diagnostics.map((d) => ({ ...d })),
  };
}

function cloneActivity(activity: Activity): Activity {
  const cells = new Map<string, Card[]>();
  for (const [key, cards] of activity.cells) {
    cells.set(
      key,
      cards.map((c) => ({ ...c })),
    );
  }
  return { title: activity.title, order: activity.order, cells };
}

/**
 * Edit a card's title and/or body in place (FR-004). Only the addressed card is
 * touched; every other card body is preserved byte-for-byte by `serialize`.
 */
export function editCard(
  map: StoryMap,
  ref: CardRef,
  patch: { title?: string; body?: string },
): StoryMap {
  const next = cloneMap(map);
  const activity = next.activities[ref.activityIndex];
  if (!activity) return next;
  const cell = activity.cells.get(ref.releaseTitle);
  if (!cell) return next;
  const card = cell.find((c) => c.order === ref.order);
  if (!card) return next;
  if (patch.title !== undefined) card.title = patch.title;
  if (patch.body !== undefined) card.body = patch.body;
  return next;
}

/**
 * Rename an activity by backbone position, not text — two activities sharing the
 * same title stay individually addressable (contracts/core-api.md §Addressing).
 */
export function renameActivity(
  map: StoryMap,
  activityIndex: number,
  newTitle: string,
): StoryMap {
  const next = cloneMap(map);
  const activity = next.activities[activityIndex];
  if (!activity) return next;
  activity.title = newTitle;
  for (const cards of activity.cells.values()) {
    for (const card of cards) card.activityTitle = newTitle;
  }
  return next;
}

/**
 * Rename a release, rewriting its `# Releases` declaration AND every `###`
 * reference across activities together — the title is the release's
 * cross-cutting identity (FR-018). Re-keys each cell, preserving order.
 */
export function renameRelease(
  map: StoryMap,
  oldTitle: string,
  newTitle: string,
): StoryMap {
  const next = cloneMap(map);
  if (oldTitle === newTitle) return next;

  const release = next.releases.find((r) => r.title === oldTitle);
  if (release) release.title = newTitle;

  for (const activity of next.activities) {
    if (!activity.cells.has(oldTitle)) continue;
    // Rebuild the cell map to rename the key in place (preserve insertion order).
    const rebuilt = new Map<string, Card[]>();
    for (const [key, cards] of activity.cells) {
      if (key === oldTitle) {
        for (const card of cards) card.releaseTitle = newTitle;
        rebuilt.set(newTitle, cards);
      } else {
        rebuilt.set(key, cards);
      }
    }
    activity.cells = rebuilt;
  }
  return next;
}

/**
 * Set (or clear) a release's subtitle (FR-004). An empty/whitespace value clears
 * it to `null` so `serialize` omits the ` - subtitle` suffix.
 */
export function setReleaseSubtitle(
  map: StoryMap,
  title: string,
  subtitle: string,
): StoryMap {
  const next = cloneMap(map);
  const release = next.releases.find((r) => r.title === title);
  if (release) {
    const trimmed = subtitle.trim();
    release.subtitle = trimmed.length > 0 ? trimmed : null;
  }
  return next;
}

// --- US3: create + structural mutation helpers ------------------------------
//
// `createEmptyMap` produces the canonical marker skeleton; the add/delete/reorder
// helpers grow and restructure a map. All are pure (new StoryMap, no I/O). `order`
// fields are re-derived from array position after every change so `serialize`
// renumbers correctly (FR-007/FR-008/FR-009/FR-021). Identities (clean titles)
// and card↔release links are preserved; auto-numbers are never stored (FR-020).

/**
 * Minimal valid story map: marker frontmatter + empty `# Releases`/`# Activities`
 * (contracts/core-api.md, FR-011). An optional `title` becomes a preamble H1.
 * Serializes to the canonical shape and round-trips.
 */
export function createEmptyMap(opts?: { title?: string }): StoryMap {
  const title = opts?.title?.trim();
  return {
    releases: [],
    activities: [],
    frontmatter: "---\nstory-map: true\n---\n",
    preamble: title ? `\n# ${title}\n\n` : "\n",
    trailing: "",
    diagnostics: [],
  };
}

/** Move `arr[from]` to `to`, clamping `to` into range. No-op if `from` is invalid. */
function moveInArray<T>(arr: T[], from: number, to: number): void {
  if (from < 0 || from >= arr.length) return;
  const dest = Math.max(0, Math.min(to, arr.length - 1));
  const [item] = arr.splice(from, 1);
  arr.splice(dest, 0, item);
}

function reindexReleases(map: StoryMap): void {
  map.releases.forEach((r, i) => (r.order = i));
}

function reindexActivities(map: StoryMap): void {
  map.activities.forEach((a, i) => (a.order = i));
}

function reindexCell(cards: Card[]): void {
  cards.forEach((c, i) => (c.order = i));
}

/** Append a release. A blank/whitespace subtitle is stored as `null`. */
export function addRelease(
  map: StoryMap,
  title: string,
  subtitle?: string,
): StoryMap {
  const next = cloneMap(map);
  const sub = subtitle?.trim();
  next.releases.push({
    title,
    subtitle: sub && sub.length > 0 ? sub : null,
    order: next.releases.length,
  });
  reindexReleases(next);
  return next;
}

/**
 * Delete a release by title, removing its declaration AND its `###` band across
 * every activity (FR-008). Remaining releases renumber by position on serialize.
 */
export function deleteRelease(map: StoryMap, title: string): StoryMap {
  const next = cloneMap(map);
  next.releases = next.releases.filter((r) => r.title !== title);
  reindexReleases(next);
  for (const activity of next.activities) {
    activity.cells.delete(title);
  }
  return next;
}

/** Reorder the release declaration; bands and R{n} recompute on serialize (FR-009). */
export function reorderReleases(
  map: StoryMap,
  fromIndex: number,
  toIndex: number,
): StoryMap {
  const next = cloneMap(map);
  moveInArray(next.releases, fromIndex, toIndex);
  reindexReleases(next);
  return next;
}

/** Append an activity (no cells yet) to the backbone. */
export function addActivity(map: StoryMap, title: string): StoryMap {
  const next = cloneMap(map);
  next.activities.push({
    title,
    order: next.activities.length,
    cells: new Map<string, Card[]>(),
  });
  reindexActivities(next);
  return next;
}

/** Delete an activity by backbone position; following Romans renumber (FR-008). */
export function deleteActivity(map: StoryMap, activityIndex: number): StoryMap {
  const next = cloneMap(map);
  if (activityIndex < 0 || activityIndex >= next.activities.length) return next;
  next.activities.splice(activityIndex, 1);
  reindexActivities(next);
  return next;
}

/** Reorder activities along the backbone; Roman numerals recompute (FR-009). */
export function reorderActivities(
  map: StoryMap,
  fromIndex: number,
  toIndex: number,
): StoryMap {
  const next = cloneMap(map);
  moveInArray(next.activities, fromIndex, toIndex);
  reindexActivities(next);
  return next;
}

/** Append a card to an activity×release cell, creating the cell if needed (FR-007). */
export function addCard(
  map: StoryMap,
  activityIndex: number,
  releaseTitle: string,
  title: string,
  body = "",
): StoryMap {
  const next = cloneMap(map);
  const activity = next.activities[activityIndex];
  if (!activity) return next;
  let cell = activity.cells.get(releaseTitle);
  if (!cell) {
    cell = [];
    activity.cells.set(releaseTitle, cell);
  }
  cell.push({
    title,
    body,
    order: cell.length,
    activityTitle: activity.title,
    releaseTitle,
  });
  reindexCell(cell);
  return next;
}

/** Delete a card by position; remaining cards in the cell renumber (FR-008). */
export function deleteCard(map: StoryMap, ref: CardRef): StoryMap {
  const next = cloneMap(map);
  const activity = next.activities[ref.activityIndex];
  if (!activity) return next;
  const cell = activity.cells.get(ref.releaseTitle);
  if (!cell) return next;
  const idx = cell.findIndex((c) => c.order === ref.order);
  if (idx === -1) return next;
  cell.splice(idx, 1);
  reindexCell(cell);
  return next;
}

/** Reorder a card within its activity×release cell; per-cell {n} recomputes (FR-009). */
export function reorderCard(
  map: StoryMap,
  ref: CardRef,
  toIndex: number,
): StoryMap {
  const next = cloneMap(map);
  const activity = next.activities[ref.activityIndex];
  if (!activity) return next;
  const cell = activity.cells.get(ref.releaseTitle);
  if (!cell) return next;
  const from = cell.findIndex((c) => c.order === ref.order);
  if (from === -1) return next;
  moveInArray(cell, from, toIndex);
  reindexCell(cell);
  return next;
}

/**
 * Move a card to any cell — within its cell, to another activity (left/right),
 * or to another release band (up/down) — inserting at `dest.order` (FR-009). The
 * card keeps its identity (title/body) but adopts the destination's
 * activity/release links; both cells renumber, and an emptied source cell is
 * dropped so the map stays sparse (markdown-format §F4). Same-cell moves behave
 * like `reorderCard`.
 */
export function moveCard(
  map: StoryMap,
  ref: CardRef,
  dest: { activityIndex: number; releaseTitle: string; order: number },
): StoryMap {
  const next = cloneMap(map);
  const srcActivity = next.activities[ref.activityIndex];
  if (!srcActivity) return next;
  const srcCell = srcActivity.cells.get(ref.releaseTitle);
  if (!srcCell) return next;
  const from = srcCell.findIndex((c) => c.order === ref.order);
  if (from === -1) return next;

  const destActivity = next.activities[dest.activityIndex];
  if (!destActivity) return next;

  const sameCell =
    ref.activityIndex === dest.activityIndex &&
    ref.releaseTitle === dest.releaseTitle;
  if (sameCell) {
    moveInArray(srcCell, from, dest.order);
    reindexCell(srcCell);
    return next;
  }

  const [card] = srcCell.splice(from, 1);
  reindexCell(srcCell);
  if (srcCell.length === 0) srcActivity.cells.delete(ref.releaseTitle);

  let destCell = destActivity.cells.get(dest.releaseTitle);
  if (!destCell) {
    destCell = [];
    destActivity.cells.set(dest.releaseTitle, destCell);
  }
  card.activityTitle = destActivity.title;
  card.releaseTitle = dest.releaseTitle;
  const insertAt = Math.max(0, Math.min(dest.order, destCell.length));
  destCell.splice(insertAt, 0, card);
  reindexCell(destCell);
  return next;
}
