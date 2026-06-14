/*
 * In-place edit interactions (US2 / FR-004/FR-017).
 *
 * Obsidian-coupled UI glue: turns board labels into inline editors and routes
 * every commit through the pure core mutation helpers (model.ts), then asks the
 * view to persist + re-render. The core stays the only writer (Constitution I) —
 * nothing here touches Markdown directly.
 */

import { App, Modal } from "obsidian";
import { StoryMap } from "../core/model";

export interface EditContext {
  /** Obsidian app handle (for confirmation dialogs on destructive actions). */
  app: App;
  /** Apply a pure mutation, persist (`requestSave`), and re-render the board. */
  apply(mutate: (map: StoryMap) => StoryMap): void;
}

/**
 * Replace `target` with a single-line input seeded from `current`.
 * Enter or blur commits; Escape cancels. A no-op edit (value unchanged) neither
 * commits nor re-renders. `commit` is only called for a real change.
 */
export function editInline(
  target: HTMLElement,
  current: string,
  commit: (value: string) => void,
  opts: { placeholder?: string } = {},
): void {
  const parent = target.parentElement;
  if (!parent) return;

  const input = parent.createEl("input", { cls: "usm-edit-input" });
  input.type = "text";
  input.value = current;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  parent.insertBefore(input, target);
  target.style.display = "none";
  input.focus();
  input.select();

  let done = false;
  const finish = (save: boolean): void => {
    if (done) return;
    done = true;
    const value = input.value;
    input.remove();
    target.style.display = "";
    // On commit the view re-renders the whole board, discarding `target`; on
    // cancel (or no change) `target` is simply revealed again, untouched.
    if (save && value !== current) commit(value);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true));
}

/**
 * Add a hover-revealed edit affordance immediately after `target` that starts
 * inline editing. `stopPropagation` keeps it from triggering an enclosing card's
 * click-to-open handler.
 */
export function addEditButton(
  target: HTMLElement,
  getValue: () => string,
  commit: (value: string) => void,
  opts: { placeholder?: string } = {},
): void {
  const parent = target.parentElement;
  if (!parent) return;
  const btn = parent.createEl("button", {
    cls: "usm-edit-btn",
    text: "✎",
    attr: { "aria-label": "Edit", title: "Edit" },
  });
  target.insertAdjacentElement("afterend", btn);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    editInline(target, getValue(), commit, opts);
  });
}

// --- US3: add / delete / reorder affordances (FR-007/FR-008/FR-009) ---------

/**
 * Append a "+ add" control button to `parent` that runs `onClick` when pressed.
 * `stopPropagation` keeps it from triggering an enclosing card/cell handler.
 */
export function addControlButton(
  parent: HTMLElement,
  label: string,
  title: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = parent.createEl("button", {
    cls: "usm-add-btn",
    text: label,
    attr: { "aria-label": title, title },
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  return btn;
}

/**
 * Add a hover-revealed delete (✕) control after/within `parent`. Destructive, so
 * it asks for confirmation (FR-008) before running `onConfirm`.
 */
export function addDeleteButton(
  parent: HTMLElement,
  app: App,
  message: string,
  onConfirm: () => void,
): HTMLButtonElement {
  const btn = parent.createEl("button", {
    cls: "usm-del-btn",
    text: "✕",
    attr: { "aria-label": "Delete", title: "Delete" },
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    void confirmDelete(app, message).then((ok) => {
      if (ok) onConfirm();
    });
  });
  return btn;
}

/** Modal yes/no confirmation for a destructive action; resolves false on dismiss. */
export function confirmDelete(app: App, message: string): Promise<boolean> {
  return new Promise((resolve) => new ConfirmModal(app, message, resolve).open());
}

class ConfirmModal extends Modal {
  private decided = false;

  constructor(
    app: App,
    private message: string,
    private resolve: (ok: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Confirm delete");
    this.contentEl.createEl("p", { text: this.message });
    const actions = this.contentEl.createDiv({ cls: "usm-modal-actions" });
    const del = actions.createEl("button", {
      cls: "mod-warning",
      text: "Delete",
    });
    const cancel = actions.createEl("button", { text: "Cancel" });
    del.addEventListener("click", () => this.decide(true));
    cancel.addEventListener("click", () => this.decide(false));
    cancel.focus();
  }

  private decide(ok: boolean): void {
    this.decided = true;
    this.resolve(ok);
    this.close();
  }

  onClose(): void {
    if (!this.decided) this.resolve(false);
    this.contentEl.empty();
  }
}

// Shared drag state for the active board. Native HTML5 DnD, no library (research
// R6). A drop only reorders when source and target share a `group`, so cards stay
// within their cell, activities within the backbone, and releases among releases.
let dragState: { group: string; index: number } | null = null;

/**
 * Make `el` a drag source/target within `group`. On a valid same-group drop onto
 * a different position, `onReorder(from, to)` runs (the caller routes it through
 * the pure reorder helpers, then `requestSave()`).
 */
export function makeDraggable(
  el: HTMLElement,
  group: string,
  index: number,
  onReorder: (from: number, to: number) => void,
): void {
  el.setAttribute("draggable", "true");

  el.addEventListener("dragstart", (e) => {
    dragState = { group, index };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
    el.addClass("usm-dragging");
  });

  el.addEventListener("dragend", () => {
    dragState = null;
    el.removeClass("usm-dragging");
  });

  el.addEventListener("dragover", (e) => {
    if (!dragState || dragState.group !== group) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    el.addClass("usm-drop-target");
  });

  el.addEventListener("dragleave", () => el.removeClass("usm-drop-target"));

  el.addEventListener("drop", (e) => {
    el.removeClass("usm-drop-target");
    if (!dragState || dragState.group !== group) return;
    e.preventDefault();
    const from = dragState.index;
    dragState = null;
    if (from !== index) onReorder(from, index);
  });
}

// Cards drag freely across cells (up/down between release bands, left/right
// between activities), so they carry a richer source location than the 1-D
// `dragState` used for activities/releases.
export interface CardLocation {
  activityIndex: number;
  releaseTitle: string;
  order: number;
}

let cardDragSource: CardLocation | null = null;

/**
 * Make a card a drag source AND a drop target. Dropping one card onto another
 * moves the source into the target's cell at the target's position — so cards
 * can move within a cell, to another activity, or to another release band.
 */
export function makeCardDraggable(
  el: HTMLElement,
  ref: CardLocation,
  onMove: (from: CardLocation, to: CardLocation) => void,
): void {
  el.setAttribute("draggable", "true");

  el.addEventListener("dragstart", (e) => {
    cardDragSource = ref;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", ref.releaseTitle);
    }
    e.stopPropagation();
    el.addClass("usm-dragging");
  });

  el.addEventListener("dragend", () => {
    cardDragSource = null;
    el.removeClass("usm-dragging");
  });

  el.addEventListener("dragover", (e) => {
    if (!cardDragSource) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    el.addClass("usm-drop-target");
  });

  el.addEventListener("dragleave", () => el.removeClass("usm-drop-target"));

  el.addEventListener("drop", (e) => {
    el.removeClass("usm-drop-target");
    if (!cardDragSource) return;
    e.preventDefault();
    e.stopPropagation(); // a card drop wins over the enclosing cell's handler
    const from = cardDragSource;
    cardDragSource = null;
    onMove(from, ref);
  });
}

/**
 * Make a whole cell a card drop target — for dropping into an empty cell or onto
 * the cell's empty area (below the last card), appending at `appendOrder`.
 */
export function makeCellDropTarget(
  cell: HTMLElement,
  location: { activityIndex: number; releaseTitle: string },
  appendOrder: number,
  onMove: (from: CardLocation, to: CardLocation) => void,
): void {
  cell.addEventListener("dragover", (e) => {
    if (!cardDragSource) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    cell.addClass("usm-cell-drop");
  });

  cell.addEventListener("dragleave", (e) => {
    if (!cell.contains(e.relatedTarget as Node | null)) {
      cell.removeClass("usm-cell-drop");
    }
  });

  cell.addEventListener("drop", (e) => {
    cell.removeClass("usm-cell-drop");
    if (!cardDragSource) return;
    e.preventDefault();
    const from = cardDragSource;
    cardDragSource = null;
    onMove(from, { ...location, order: appendOrder });
  });
}
