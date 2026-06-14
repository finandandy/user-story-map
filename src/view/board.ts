/*
 * Board rendering (US1 / FR-001/FR-002/FR-012/FR-014, US2 / FR-004).
 *
 * Vanilla DOM (no UI framework, Constitution II). Layout mirrors the approved
 * mockup and uses only the classes in styles.css (theme CSS variables):
 *   - backbone: activities left -> right with Roman labels
 *   - one release band (R{n}) per release, each a grid of activity cells
 *   - cards inside each activity×release cell, in document order
 *
 * When the context carries an EditContext, activity titles and release
 * title/subtitle gain hover-revealed inline edit affordances; commits route
 * through the pure core helpers and the view persists + re-renders.
 */

import { StoryMap } from "../core/model";
import {
  renameActivity,
  renameRelease,
  setReleaseSubtitle,
  addActivity,
  deleteActivity,
  reorderActivities,
  addRelease,
  deleteRelease,
  reorderReleases,
  addCard,
  moveCard,
} from "../core/model";
import { formatActivityNumber, formatReleaseNumber } from "../core/numbering";
import { CardContext, renderCard } from "./card";
import {
  addEditButton,
  addControlButton,
  addDeleteButton,
  makeDraggable,
  makeCellDropTarget,
} from "./interactions";

export function renderBoard(
  container: HTMLElement,
  map: StoryMap,
  ctx: CardContext,
): void {
  // Build the whole board detached, then attach once (T036 / SC-007): for maps
  // with hundreds of cards this collapses hundreds of incremental mutations on a
  // live tree into a single insertion, avoiding repeated layout thrash.
  const root = container.ownerDocument.createElement("div");
  root.addClass("smap");

  renderDiagnostics(root, map);

  // Build controls (US3) are available even on an empty map so a story map can be
  // grown from scratch (Independent Test: "from an empty file, define releases…").
  if (ctx.edit) renderBuildControls(root, ctx);

  const isEmpty = map.releases.length === 0 && map.activities.length === 0;
  if (isEmpty) {
    renderEmptyState(root);
    container.appendChild(root);
    return;
  }

  renderBackbone(root, map, ctx);

  // One band per release, in global release order. Each band shows that
  // release's cards for every activity column (sparse cells stay empty).
  map.releases.forEach((release, rIndex) => {
    const head = root.createDiv({ cls: "band-head" });
    head.createDiv({ cls: "band-num", text: formatReleaseNumber(rIndex + 1) });
    const titleEl = head.createSpan({ cls: "band-title", text: release.title });
    const subEl = head.createSpan({
      cls: "band-sub",
      text: release.subtitle ?? "",
    });
    if (!release.subtitle) subEl.addClass("usm-sub-empty");

    if (ctx.edit) {
      const releaseTitle = release.title;
      addEditButton(
        titleEl,
        () => releaseTitle,
        (value) => ctx.edit!.apply((m) => renameRelease(m, releaseTitle, value)),
      );
      addEditButton(
        subEl,
        () => release.subtitle ?? "",
        (value) =>
          ctx.edit!.apply((m) => setReleaseSubtitle(m, releaseTitle, value)),
        { placeholder: "subtitle" },
      );
      makeDraggable(head, "releases", rIndex, (from, to) =>
        ctx.edit!.apply((m) => reorderReleases(m, from, to)),
      );
      addDeleteButton(
        head,
        ctx.edit.app,
        `Delete release "${releaseTitle}" and its cards across all activities?`,
        () => ctx.edit!.apply((m) => deleteRelease(m, releaseTitle)),
      );
    }

    const grid = root.createDiv({ cls: "grid" });
    map.activities.forEach((activity, aIndex) => {
      const cell = grid.createDiv({ cls: "cell" });
      const cards = activity.cells.get(release.title) ?? [];
      cards.forEach((card, ci) =>
        renderCard(cell, card, ci, ctx, {
          activityIndex: aIndex,
          releaseTitle: release.title,
        }),
      );
      if (ctx.edit) {
        // Dropping onto the cell (empty area / empty cell) appends the card here.
        makeCellDropTarget(
          cell,
          { activityIndex: aIndex, releaseTitle: release.title },
          cards.length,
          (from, to) => ctx.edit!.apply((m) => moveCard(m, from, to)),
        );
        addControlButton(cell, "+ card", "Add card", () =>
          ctx.edit!.apply((m) =>
            addCard(m, aIndex, release.title, "New card"),
          ),
        );
      }
    });
  });

  container.appendChild(root);
}

function renderBackbone(
  root: HTMLElement,
  map: StoryMap,
  ctx: CardContext,
): void {
  const backbone = root.createDiv({ cls: "backbone" });
  map.activities.forEach((activity, index) => {
    const act = backbone.createDiv({ cls: "act" });
    act.createSpan({ cls: "usm-act-num", text: formatActivityNumber(index + 1) });
    const titleEl = act.createSpan({
      cls: "usm-act-title",
      text: activity.title,
    });
    if (ctx.edit) {
      addEditButton(
        titleEl,
        () => activity.title,
        (value) => ctx.edit!.apply((m) => renameActivity(m, index, value)),
      );
      makeDraggable(act, "activities", index, (from, to) =>
        ctx.edit!.apply((m) => reorderActivities(m, from, to)),
      );
      addDeleteButton(
        act,
        ctx.edit.app,
        `Delete activity "${activity.title}" and all its cards?`,
        () => ctx.edit!.apply((m) => deleteActivity(m, index)),
      );
    }
  });
}

/** Top-of-board build controls (US3): add an activity or a release (FR-007). */
function renderBuildControls(root: HTMLElement, ctx: CardContext): void {
  const bar = root.createDiv({ cls: "usm-controls" });
  addControlButton(bar, "+ Activity", "Add activity", () =>
    ctx.edit!.apply((m) => addActivity(m, "New activity")),
  );
  addControlButton(bar, "+ Release", "Add release", () =>
    ctx.edit!.apply((m) => addRelease(m, "New release")),
  );
}

function renderEmptyState(root: HTMLElement): void {
  const empty = root.createDiv({ cls: "usm-empty" });
  empty.createEl("p", { text: "This story map is empty." });
  empty.createEl("p", {
    text: "Add a # Releases and # Activities section to start mapping.",
  });
}

/** Surface what the parser could not understand (FR-012) instead of failing. */
function renderDiagnostics(root: HTMLElement, map: StoryMap): void {
  if (map.diagnostics.length === 0) return;
  const banner = root.createDiv({ cls: "usm-diagnostics" });
  banner.createSpan({
    text: `${map.diagnostics.length} issue${map.diagnostics.length === 1 ? "" : "s"} in this map:`,
  });
  const list = banner.createEl("ul");
  for (const d of map.diagnostics) {
    list.createEl("li", { text: d.message });
  }
}
