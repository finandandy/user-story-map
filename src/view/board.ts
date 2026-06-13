/*
 * Board rendering (US1 / FR-001/FR-002/FR-012/FR-014).
 *
 * Vanilla DOM (no UI framework, Constitution II). Layout mirrors the approved
 * mockup and uses only the classes in styles.css (theme CSS variables):
 *   - backbone: activities left -> right with Roman labels
 *   - one release band (R{n}) per release, each a grid of activity cells
 *   - cards inside each activity×release cell, in document order
 */

import { StoryMap } from "../core/model";
import { formatActivityNumber, formatReleaseNumber } from "../core/numbering";
import { CardContext, renderCard } from "./card";

export function renderBoard(
  container: HTMLElement,
  map: StoryMap,
  ctx: CardContext,
): void {
  const root = container.createDiv({ cls: "smap" });

  renderDiagnostics(root, map);

  const isEmpty = map.releases.length === 0 && map.activities.length === 0;
  if (isEmpty) {
    renderEmptyState(root);
    return;
  }

  renderBackbone(root, map);

  // One band per release, in global release order. Each band shows that
  // release's cards for every activity column (sparse cells stay empty).
  map.releases.forEach((release, rIndex) => {
    const head = root.createDiv({ cls: "band-head" });
    head.createDiv({ cls: "band-num", text: formatReleaseNumber(rIndex + 1) });
    head.createSpan({ cls: "band-title", text: release.title });
    if (release.subtitle) {
      head.createSpan({ cls: "band-sub", text: release.subtitle });
    }

    const grid = root.createDiv({ cls: "grid" });
    for (const activity of map.activities) {
      const cell = grid.createDiv({ cls: "cell" });
      const cards = activity.cells.get(release.title) ?? [];
      cards.forEach((card, ci) => renderCard(cell, card, ci, ctx));
    }
  });
}

function renderBackbone(root: HTMLElement, map: StoryMap): void {
  const backbone = root.createDiv({ cls: "backbone" });
  map.activities.forEach((activity, index) => {
    const act = backbone.createDiv({ cls: "act" });
    act.createSpan({ cls: "usm-act-num", text: formatActivityNumber(index + 1) });
    act.createSpan({ cls: "usm-act-title", text: activity.title });
  });
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
