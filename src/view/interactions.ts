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

/**
 * Identifies the not-yet-named node a create-into-edit draft should open in the
 * focused inline editor after the next render (US1/US4, FR-001).
 */
export type DraftFocus =
  | { kind: "activity"; activityIndex: number }
  | { kind: "release"; releaseIndex: number }
  | { kind: "card"; activityIndex: number; releaseTitle: string; order: number };

export interface EditContext {
  /** Obsidian app handle (for confirmation dialogs on destructive actions). */
  app: App;
  /** Apply a pure mutation, persist (`requestSave`), and re-render the board. */
  apply(mutate: (map: StoryMap) => StoryMap): void;
  /**
   * Apply a pure mutation and re-render WITHOUT saving (research R11). Used for
   * draft creation and discard so a not-yet-named node never touches the file
   * (FR-002).
   */
  applyTransient(mutate: (map: StoryMap) => StoryMap): void;
  /**
   * Create a node transiently (no save) and open it in the focused inline editor
   * on the next render (FR-001/FR-002). A non-empty commit persists; an empty
   * commit or cancel discards the draft, leaving the file byte-unchanged.
   */
  createDraft(mutate: (map: StoryMap) => StoryMap, focus: DraftFocus): void;
}

/**
 * Whether a drag-to-reorder gesture is currently in flight. A click that lands
 * after a drag must NOT also open the inline title editor (FR-018/T008); the
 * draggable helpers set this for the duration of the drag.
 */
let isDragging = false;

/**
 * Replace `target` with a single-line input seeded from `initialValue`.
 * Enter or blur commits (`onCommit`); Escape cancels (`onCancel`). The editor
 * only ever swaps `target` — never an adjacent auto-number prefix (FR-005).
 */
export function editInline(
  target: HTMLElement,
  initialValue: string,
  handlers: {
    onCommit: (value: string) => void;
    onCancel?: () => void;
    placeholder?: string;
    /** Edit in a textarea overlay that fills the nearest card, so the editing
     *  viewport scales with the (possibly multi-line) card instead of a single
     *  line. The value is still one logical line — Enter commits, never inserts
     *  a newline. */
    multiline?: boolean;
  },
): void {
  const parent = target.parentElement;
  if (!parent) return;

  // A multi-line title editor overlays the whole card so it grows with it.
  const card = handlers.multiline
    ? target.closest<HTMLElement>(".card")
    : null;
  let field: HTMLInputElement | HTMLTextAreaElement;
  if (card) {
    field = card.createEl("textarea", {
      cls: "usm-edit-input usm-edit-overlay",
    });
    field.value = initialValue;
    if (handlers.placeholder) field.placeholder = handlers.placeholder;
    target.style.display = "none";
  } else {
    const input = parent.createEl("input", { cls: "usm-edit-input" });
    input.type = "text";
    input.value = initialValue;
    if (handlers.placeholder) input.placeholder = handlers.placeholder;
    parent.insertBefore(input, target);
    target.style.display = "none";
    field = input;
  }
  field.focus();
  field.select();

  let done = false;
  const finish = (save: boolean): void => {
    if (done) return;
    done = true;
    // A title is a single logical line; collapse any pasted/typed newlines.
    const value = field.value.replace(/\s*\n\s*/g, " ");
    field.remove();
    target.style.display = "";
    // On commit the view typically re-renders the whole board, discarding
    // `target`; on cancel `target` is simply revealed again, untouched.
    if (save) handlers.onCommit(value);
    else handlers.onCancel?.();
  };

  field.addEventListener("keydown", (e) => {
    const key = (e as KeyboardEvent).key;
    if (key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  });
  field.addEventListener("blur", () => finish(true));
}

/**
 * Make a node's title span single-click editable in place (US1, FR-003): a plain
 * click swaps it for an inline editor; a no-op edit (unchanged) neither commits
 * nor re-renders. Isolated from drag (FR-018) and from any enclosing card click.
 */
export function makeTitleEditable(
  target: HTMLElement,
  getValue: () => string,
  commit: (value: string) => void,
  opts: { multiline?: boolean } = {},
): void {
  target.addClass("usm-editable");
  target.addEventListener("click", (e) => {
    if (isDragging) return; // a drag-to-reorder must not open the editor (T008)
    e.stopPropagation();
    e.preventDefault();
    const original = getValue();
    editInline(target, original, {
      multiline: opts.multiline,
      onCommit: (value) => {
        if (value !== original) commit(value);
      },
    });
  });
}

/**
 * Add a hover-revealed edit affordance immediately after `target` that starts
 * inline editing (used for releases, which keep inline Title/Subtitle editing —
 * research R13). `stopPropagation` keeps it from triggering a card click.
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
    const original = getValue();
    editInline(target, original, {
      onCommit: (value) => {
        if (value !== original) commit(value);
      },
      placeholder: opts.placeholder,
    });
  });
}

/**
 * A hover-revealed action button (e.g. a pencil that opens the focused modal,
 * US2). Rendered as a small round corner button alongside delete (`.usm-del-btn`);
 * `stopPropagation` keeps it from triggering an enclosing card/title handler.
 */
export function addActionButton(
  parent: HTMLElement,
  glyph: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = parent.createEl("button", {
    cls: "usm-action-btn",
    text: glyph,
    attr: { "aria-label": label, title: label },
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  return btn;
}

/** Clamp a candidate card width to the allowed range (FR-023). */
// The default width is also the minimum — narrower than this isn't supported.
export const CARD_WIDTH_MIN = 180;
export const CARD_WIDTH_MAX = 420;
export const CARD_WIDTH_DEFAULT = 180;
export function clampCardWidth(px: number): number {
  return Math.max(CARD_WIDTH_MIN, Math.min(CARD_WIDTH_MAX, Math.round(px)));
}

/** Upper bound for a manual card-height drag; content can still exceed it. */
export const CARD_HEIGHT_MAX = 600;

/**
 * A shared dimension controller for a resize grip: read the current value, set a
 * new one (the controller clamps), and optionally `end()` to settle once a drag
 * finishes (the height controller re-fits to content there).
 */
export interface ResizeController {
  get(): number;
  set(px: number): void;
  end?(): void;
}

/**
 * Turn a thin card-border handle into a shared-dimension resize grip (US3, R12).
 * `axis: "x"` resizes width (right border), `axis: "y"` resizes height (bottom
 * border); a pointer drag feeds `controller.set` (which clamps). `stopPropagation`
 * + suppressing drag keep it distinct from title-edit and reorder (FR-025).
 * Listeners live on the handle (pointer capture), so nothing leaks on unload.
 */
export function makeResizable(
  handle: HTMLElement,
  controller: ResizeController,
  axis: "x" | "y" = "x",
): void {
  // A resize grip must never start a card drag-to-reorder.
  handle.setAttribute("draggable", "false");
  handle.addEventListener("dragstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const start = axis === "x" ? e.clientX : e.clientY;
    const startSize = controller.get();
    // Pointer capture routes all move/up events to the handle itself, so the
    // listeners live on (and are GC'd with) the handle — nothing on document to
    // leak on unload (T031, clean-unload obligation).
    handle.setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent): void => {
      const cur = axis === "x" ? ev.clientX : ev.clientY;
      controller.set(startSize + (cur - start));
    };
    const onUp = (): void => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      handle.releasePointerCapture?.(e.pointerId);
      controller.end?.();
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

/**
 * Append border resize grips to a card-like element: a right grip for the shared
 * width and/or a bottom grip for the shared height (US3). Each is a no-op when
 * its controller is absent (read-only render, or width-only for activities).
 */
export function addResizeHandle(
  el: HTMLElement,
  width?: ResizeController,
  height?: ResizeController,
): void {
  if (width) {
    const h = el.createDiv({ cls: "usm-resize-handle usm-resize-x" });
    h.setAttribute("aria-hidden", "true");
    makeResizable(h, width, "x");
  }
  if (height) {
    const h = el.createDiv({ cls: "usm-resize-handle usm-resize-y" });
    h.setAttribute("aria-hidden", "true");
    makeResizable(h, height, "y");
  }
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
    isDragging = true;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
    el.addClass("usm-dragging");
  });

  el.addEventListener("dragend", () => {
    dragState = null;
    isDragging = false;
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
    isDragging = true;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", ref.releaseTitle);
    }
    e.stopPropagation();
    el.addClass("usm-dragging");
  });

  el.addEventListener("dragend", () => {
    cardDragSource = null;
    isDragging = false;
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
