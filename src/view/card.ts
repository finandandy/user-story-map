/*
 * Card element (US1 / FR-003/FR-004, US2 / FR-006/FR-007/FR-008, US3 / FR-022).
 *
 * A card renders its auto-number inline with its title as one continuous
 * `.usm-card-label` (FR-004); single-clicking the title edits it in place
 * (FR-003), while a hover-revealed pencil opens a focused two-field Title/Details
 * modal (FR-006). Titles/bodies render via Obsidian's MarkdownRenderer so
 * internal links stay navigable from the rendered details (FR-019).
 */

import { App, Component, MarkdownRenderer, Modal } from "obsidian";
import {
  Card,
  CardRef,
  editCard,
  deleteCard,
  moveCard,
  StoryMap,
  Activity,
  renameActivity,
  setActivityIcon,
  ActivityIcon,
} from "../core/model";
import { formatCardNumber } from "../core/numbering";
import {
  EditContext,
  DraftFocus,
  ResizeController,
  addActionButton,
  addDeleteButton,
  addResizeHandle,
  makeCardDraggable,
  makeTitleEditable,
  editInline,
} from "./interactions";
import { mountIconPicker, renderActivityIcon } from "./icon";

export interface CardContext {
  app: App;
  /** Lifecycle owner for rendered markdown children (the view). */
  component: Component;
  /** Source path used to resolve relative internal links. */
  sourcePath: string;
  /** Present when the board is editable (US2); absent for read-only render. */
  edit?: EditContext;
  /** A pending create-into-edit draft to open after attach (FR-001). */
  draft?: DraftFocus;
  /** Shared card/column width controller (US3); absent for read-only render. */
  width?: ResizeController;
  /** Shared story-card height controller (US3); absent for read-only render. */
  height?: ResizeController;
  /** Register a callback to run once the detached board is attached to the DOM. */
  registerPostAttach?: (fn: () => void) => void;
}

/** Render a single card into a cell. `index` is 0-based within its cell. */
export function renderCard(
  cell: HTMLElement,
  card: Card,
  index: number,
  ctx: CardContext,
  ref?: { activityIndex: number; releaseTitle: string },
): HTMLElement {
  const el = cell.createDiv({ cls: "card" });
  const cardRef: CardRef | undefined = ref
    ? { ...ref, order: index }
    : undefined;

  // Auto-number + title read as one continuous label (FR-004); only the title
  // span is ever swapped by the inline editor (FR-005).
  const label = el.createSpan({ cls: "usm-card-label" });
  label.createSpan({ cls: "usm-num", text: formatCardNumber(index + 1) });
  const titleEl = label.createSpan({ cls: "usm-title" });
  // MarkdownRenderer wraps inline content in a <p>; keep the card compact.
  void MarkdownRenderer.render(
    ctx.app,
    card.title,
    titleEl,
    ctx.sourcePath,
    ctx.component,
  );

  if (ctx.edit && cardRef) {
    const edit = ctx.edit;
    makeTitleEditable(
      titleEl,
      () => card.title,
      (value) => edit.apply((m) => editCard(m, cardRef, { title: value })),
      { multiline: true },
    );
    // Pencil → focused two-field Title/Details modal (US2, FR-006).
    addActionButton(el, "✎", "Edit card", () =>
      new CardEditModal(ctx, card, cardRef).open(),
    );
    // Drag to move the card anywhere — within its cell, to another activity
    // (left/right), or to another release band (up/down) (FR-009).
    makeCardDraggable(el, cardRef, (from, to) =>
      edit.apply((m) => moveCard(m, from, to)),
    );
    addDeleteButton(el, edit.app, `Delete card "${card.title}"?`, () =>
      edit.apply((m) => deleteCard(m, cardRef)),
    );
    addResizeHandle(el, ctx.width, ctx.height);

    // Create-into-edit: a freshly added draft card opens focused once attached.
    if (
      ctx.draft &&
      ctx.draft.kind === "card" &&
      ctx.draft.activityIndex === cardRef.activityIndex &&
      ctx.draft.releaseTitle === cardRef.releaseTitle &&
      ctx.draft.order === cardRef.order
    ) {
      ctx.registerPostAttach?.(() =>
        openCardDraftEditor(titleEl, edit, cardRef),
      );
    }
  } else {
    addResizeHandle(el, ctx.width, ctx.height);
  }

  return el;
}

/**
 * Open a draft card's title in the focused inline editor (FR-001). A non-empty
 * commit persists via `editCard`; an empty commit or cancel discards the draft
 * with a no-save apply, so nothing is ever written for an empty card (FR-002).
 */
function openCardDraftEditor(
  titleEl: HTMLElement,
  edit: EditContext,
  ref: CardRef,
): void {
  titleEl.empty();
  editInline(titleEl, "", {
    placeholder: "Card title",
    multiline: true,
    onCommit: (value) => {
      if (value.trim().length === 0) {
        edit.applyTransient((m) => deleteCard(m, ref));
      } else {
        edit.apply((m) => editCard(m, ref, { title: value }));
      }
    },
    onCancel: () => edit.applyTransient((m) => deleteCard(m, ref)),
  });
}

/**
 * Focused two-field edit modal for a story card (US2, FR-006/FR-007/FR-008):
 * opens directly in edit mode with exactly two text fields — Title and Details
 * (pre-populated from the body) — plus a rendered preview so internal links in
 * the details stay navigable (FR-019). Save writes title→heading, details→body;
 * Cancel discards.
 */
class CardEditModal extends Modal {
  constructor(
    private ctx: CardContext,
    private card: Card,
    private ref: CardRef,
  ) {
    super(ctx.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("Edit card");

    contentEl.createEl("label", { cls: "usm-field-label", text: "Title" });
    const titleInput = contentEl.createEl("input", { cls: "usm-edit-input" });
    titleInput.type = "text";
    titleInput.value = this.card.title;
    titleInput.placeholder = "Card title";

    contentEl.createEl("label", { cls: "usm-field-label", text: "Details" });
    const bodyInput = contentEl.createEl("textarea", {
      cls: "usm-edit-textarea",
    });
    bodyInput.value = this.card.body;
    bodyInput.placeholder = "Card details (Markdown)";

    // Rendered preview so internal links remain navigable (FR-019/T012).
    if (this.card.body.trim().length > 0) {
      contentEl.createEl("label", {
        cls: "usm-field-label",
        text: "Preview",
      });
      const preview = contentEl.createDiv({ cls: "usm-card-preview" });
      void MarkdownRenderer.render(
        this.ctx.app,
        this.card.body,
        preview,
        this.ctx.sourcePath,
        this.ctx.component,
      );
    }

    const actions = contentEl.createDiv({ cls: "usm-modal-actions" });
    const save = actions.createEl("button", { cls: "mod-cta", text: "Save" });
    const cancel = actions.createEl("button", { text: "Cancel" });

    save.addEventListener("click", () => {
      const title = titleInput.value;
      const body = bodyInput.value;
      this.ctx.edit?.apply((m) => editCard(m, this.ref, { title, body }));
      this.close();
    });
    cancel.addEventListener("click", () => this.close());

    titleInput.focus();
    titleInput.select();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * Focused edit modal for an activity (US2/US5, research R13): a Title text field
 * plus the icon selector (mounted in the T010 slot). Save writes the renamed
 * title and the chosen icon together; Cancel discards.
 */
export class ActivityEditModal extends Modal {
  private pendingIcon: ActivityIcon | null;

  constructor(
    private ctx: CardContext,
    private activity: Activity,
    private activityIndex: number,
  ) {
    super(ctx.app);
    this.pendingIcon = activity.icon;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("Edit activity");

    contentEl.createEl("label", { cls: "usm-field-label", text: "Title" });
    const titleInput = contentEl.createEl("input", { cls: "usm-edit-input" });
    titleInput.type = "text";
    titleInput.value = this.activity.title;
    titleInput.placeholder = "Activity title";

    contentEl.createEl("label", { cls: "usm-field-label", text: "Icon" });
    const iconSlot = contentEl.createDiv({ cls: "usm-icon-slot" });
    mountIconPicker(iconSlot, this.activity.icon, (icon) => {
      this.pendingIcon = icon;
    });

    const actions = contentEl.createDiv({ cls: "usm-modal-actions" });
    const save = actions.createEl("button", { cls: "mod-cta", text: "Save" });
    const cancel = actions.createEl("button", { text: "Cancel" });

    save.addEventListener("click", () => {
      const title = titleInput.value;
      const idx = this.activityIndex;
      const icon = this.pendingIcon;
      this.ctx.edit?.apply((m: StoryMap) =>
        setActivityIcon(renameActivity(m, idx, title), idx, icon),
      );
      this.close();
    });
    cancel.addEventListener("click", () => this.close());

    titleInput.focus();
    titleInput.select();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** Re-export so the backbone can render an activity's assigned icon (US5). */
export { renderActivityIcon };
