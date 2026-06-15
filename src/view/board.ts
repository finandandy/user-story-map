/*
 * Board rendering (US1 / FR-001/FR-003/FR-004, US2 / FR-006, US3 / FR-022,
 * US4 / FR-011/FR-012, US5 / FR-013/FR-015).
 *
 * Vanilla DOM (no UI framework, Constitution II). Layout mirrors the approved
 * mockup and uses only the classes in styles.css (theme CSS variables):
 *   - backbone: activities left -> right, each an inline `Roman. title` label,
 *     with an optional icon and a hover-revealed "+" add-activity card at the end
 *   - one release band (R{n}) per release, each a grid of activity cells
 *   - cards inside each activity×release cell, in document order
 *
 * Editable nodes drop straight into focused inline editing on create and on a
 * single title click; commits route through the pure core helpers and the view
 * persists + re-renders. Drafts apply without saving until a non-empty commit.
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
import {
  CardContext,
  renderCard,
  ActivityEditModal,
  renderActivityIcon,
} from "./card";
import {
  EditContext,
  addEditButton,
  addControlButton,
  addDeleteButton,
  addActionButton,
  addResizeHandle,
  makeDraggable,
  makeCellDropTarget,
  makeTitleEditable,
  editInline,
} from "./interactions";

export function renderBoard(
  container: HTMLElement,
  map: StoryMap,
  ctx: CardContext,
): void {
  // Build the whole board detached, then attach once (SC-007): for maps with
  // hundreds of cards this collapses hundreds of incremental mutations on a live
  // tree into a single insertion, avoiding repeated layout thrash. Draft editors
  // are opened only after attach (an input needs a live, focusable parent).
  const root = container.ownerDocument.createElement("div");
  root.addClass("smap");
  const postAttach: (() => void)[] = [];
  const bctx: CardContext = {
    ...ctx,
    registerPostAttach: (fn) => postAttach.push(fn),
  };

  renderDiagnostics(root, map);

  // Build controls (US3) are available even on an empty map so a story map can be
  // grown from scratch (Independent Test: "from an empty file, define releases…").
  if (bctx.edit) renderBuildControls(root, map, bctx);

  const isEmpty = map.releases.length === 0 && map.activities.length === 0;
  if (isEmpty) {
    renderEmptyState(root);
    container.appendChild(root);
    postAttach.forEach((fn) => fn());
    return;
  }

  renderBackbone(root, map, bctx, postAttach);

  // One band per release, in global release order. Each band shows that
  // release's cards for every activity column (sparse cells stay empty).
  map.releases.forEach((release, rIndex) => {
    const head = root.createDiv({ cls: "band-head" });
    const label = head.createSpan({ cls: "usm-card-label" });
    label.createSpan({
      cls: "usm-num usm-band-num",
      text: formatReleaseNumber(rIndex + 1),
    });
    const titleEl = label.createSpan({
      cls: "usm-title band-title",
      text: release.title,
    });
    const subEl = head.createSpan({
      cls: "band-sub",
      text: release.subtitle ?? "",
    });
    if (!release.subtitle) subEl.addClass("usm-sub-empty");

    if (bctx.edit) {
      const edit = bctx.edit;
      const releaseTitle = release.title;
      // Releases keep inline Title/Subtitle editing (research R13).
      addEditButton(
        titleEl,
        () => releaseTitle,
        (value) => edit.apply((m) => renameRelease(m, releaseTitle, value)),
      );
      addEditButton(
        subEl,
        () => release.subtitle ?? "",
        (value) => edit.apply((m) => setReleaseSubtitle(m, releaseTitle, value)),
        { placeholder: "subtitle" },
      );
      makeDraggable(head, "releases", rIndex, (from, to) =>
        edit.apply((m) => reorderReleases(m, from, to)),
      );
      addDeleteButton(
        head,
        edit.app,
        `Delete release "${releaseTitle}" and its cards across all activities?`,
        () => edit.apply((m) => deleteRelease(m, releaseTitle)),
      );
      // Create-into-edit for a freshly added (empty-titled) release.
      if (bctx.draft?.kind === "release" && bctx.draft.releaseIndex === rIndex) {
        postAttach.push(() => openReleaseDraftEditor(titleEl, edit, releaseTitle));
      }
    }

    const grid = root.createDiv({ cls: "grid" });
    map.activities.forEach((activity, aIndex) => {
      const cell = grid.createDiv({ cls: "cell" });
      const cards = activity.cells.get(release.title) ?? [];
      cards.forEach((card, ci) =>
        renderCard(cell, card, ci, bctx, {
          activityIndex: aIndex,
          releaseTitle: release.title,
        }),
      );
      if (bctx.edit) {
        const edit = bctx.edit;
        // Dropping onto the cell (empty area / empty cell) appends the card here.
        makeCellDropTarget(
          cell,
          { activityIndex: aIndex, releaseTitle: release.title },
          cards.length,
          (from, to) => edit.apply((m) => moveCard(m, from, to)),
        );
        addControlButton(cell, "+ card", "Add card", () =>
          edit.createDraft((m) => addCard(m, aIndex, release.title, ""), {
            kind: "card",
            activityIndex: aIndex,
            releaseTitle: release.title,
            order: cards.length,
          }),
        );
      }
    });
  });

  container.appendChild(root);
  postAttach.forEach((fn) => fn());
}

function renderBackbone(
  root: HTMLElement,
  map: StoryMap,
  ctx: CardContext,
  postAttach: (() => void)[],
): void {
  const backbone = root.createDiv({ cls: "backbone" });
  map.activities.forEach((activity, index) => {
    const act = backbone.createDiv({ cls: "act" });

    // Optional icon — no placeholder element when absent (FR-015).
    if (activity.icon) {
      const iconEl = act.createSpan({ cls: "usm-act-icon" });
      renderActivityIcon(iconEl, activity.icon);
    }

    const label = act.createSpan({ cls: "usm-card-label" });
    label.createSpan({
      cls: "usm-num usm-act-num",
      text: formatActivityNumber(index + 1),
    });
    const titleEl = label.createSpan({
      cls: "usm-title usm-act-title",
      text: activity.title,
    });

    if (ctx.edit) {
      const edit = ctx.edit;
      makeTitleEditable(
        titleEl,
        () => activity.title,
        (value) => edit.apply((m) => renameActivity(m, index, value)),
      );
      // Pencil → focused activity modal (Title + icon selector, US2/US5).
      addActionButton(act, "✎", "Edit activity", () =>
        new ActivityEditModal(ctx, activity, index).open(),
      );
      makeDraggable(act, "activities", index, (from, to) =>
        edit.apply((m) => reorderActivities(m, from, to)),
      );
      addDeleteButton(
        act,
        edit.app,
        `Delete activity "${activity.title}" and all its cards?`,
        () => edit.apply((m) => deleteActivity(m, index)),
      );
      addResizeHandle(act, ctx.width);

      if (ctx.draft?.kind === "activity" && ctx.draft.activityIndex === index) {
        postAttach.push(() => openActivityDraftEditor(titleEl, edit, index));
      }
    } else {
      addResizeHandle(act, ctx.width);
    }
  });

  // US4: a hover-revealed "+" card at the right end appends an activity that
  // opens directly into title edit (reusing the create-into-edit path).
  if (ctx.edit) {
    const edit = ctx.edit;
    const addCardEl = backbone.createDiv({
      cls: "act usm-add-activity",
      attr: { role: "button", "aria-label": "Add activity", tabindex: "0" },
    });
    addCardEl.createSpan({ cls: "usm-add-activity-glyph", text: "+" });
    const startDraft = (): void =>
      edit.createDraft((m) => addActivity(m, ""), {
        kind: "activity",
        activityIndex: map.activities.length,
      });
    addCardEl.addEventListener("click", startDraft);
    addCardEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startDraft();
      }
    });
  }
}

/** Open a draft activity's title focused; empty/cancel discards with no save (FR-002). */
function openActivityDraftEditor(
  titleEl: HTMLElement,
  edit: EditContext,
  index: number,
): void {
  titleEl.setText("");
  editInline(titleEl, "", {
    placeholder: "Activity title",
    onCommit: (value) => {
      if (value.trim().length === 0) {
        edit.applyTransient((m) => deleteActivity(m, index));
      } else {
        edit.apply((m) => renameActivity(m, index, value));
      }
    },
    onCancel: () => edit.applyTransient((m) => deleteActivity(m, index)),
  });
}

/** Open a draft release's title focused; empty/cancel discards with no save (FR-002). */
function openReleaseDraftEditor(
  titleEl: HTMLElement,
  edit: EditContext,
  draftTitle: string,
): void {
  titleEl.setText("");
  editInline(titleEl, "", {
    placeholder: "Release title",
    onCommit: (value) => {
      if (value.trim().length === 0) {
        edit.applyTransient((m) => deleteRelease(m, draftTitle));
      } else {
        edit.apply((m) => renameRelease(m, draftTitle, value));
      }
    },
    onCancel: () => edit.applyTransient((m) => deleteRelease(m, draftTitle)),
  });
}

/** Top-of-board build controls (US3/US4): add an activity or a release (FR-007/FR-012). */
function renderBuildControls(
  root: HTMLElement,
  map: StoryMap,
  ctx: CardContext,
): void {
  const edit = ctx.edit!;
  const bar = root.createDiv({ cls: "usm-controls" });
  // Always-present (no-hover) create affordance (FR-012, Edge Cases).
  addControlButton(bar, "+ Activity", "Add activity", () =>
    edit.createDraft((m) => addActivity(m, ""), {
      kind: "activity",
      activityIndex: map.activities.length,
    }),
  );
  addControlButton(bar, "+ Release", "Add release", () =>
    edit.createDraft((m) => addRelease(m, ""), {
      kind: "release",
      releaseIndex: map.releases.length,
    }),
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
