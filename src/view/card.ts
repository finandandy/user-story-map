/*
 * Card element (US1 / FR-010/FR-017, US2 / FR-004).
 *
 * Titles (and bodies) are rendered via Obsidian's MarkdownRenderer so internal
 * links render and stay navigable. Clicking a card opens its detail; when an
 * EditContext is present the title is editable in place (hover affordance) and
 * the detail modal can edit title + body, committing through the pure core.
 */

import { App, Component, MarkdownRenderer, Modal } from "obsidian";
import { Card, CardRef, editCard, deleteCard, moveCard } from "../core/model";
import { formatCardNumber } from "../core/numbering";
import {
  EditContext,
  addEditButton,
  addDeleteButton,
  makeCardDraggable,
} from "./interactions";

export interface CardContext {
  app: App;
  /** Lifecycle owner for rendered markdown children (the view). */
  component: Component;
  /** Source path used to resolve relative internal links. */
  sourcePath: string;
  /** Present when the board is editable (US2); absent for read-only render. */
  edit?: EditContext;
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

  el.createSpan({ cls: "usm-card-num", text: formatCardNumber(index + 1) });

  const titleEl = el.createSpan({ cls: "usm-card-title" });
  // MarkdownRenderer wraps inline content in a <p>; keep the card compact.
  void MarkdownRenderer.render(ctx.app, card.title, titleEl, ctx.sourcePath, ctx.component);

  if (ctx.edit && cardRef) {
    addEditButton(
      titleEl,
      () => card.title,
      (value) => ctx.edit!.apply((m) => editCard(m, cardRef, { title: value })),
    );
    // Drag to move the card anywhere — within its cell, to another activity
    // (left/right), or to another release band (up/down) (FR-009).
    makeCardDraggable(el, cardRef, (from, to) =>
      ctx.edit!.apply((m) => moveCard(m, from, to)),
    );
    addDeleteButton(el, ctx.edit.app, `Delete card "${card.title}"?`, () =>
      ctx.edit!.apply((m) => deleteCard(m, cardRef)),
    );
  }

  el.addEventListener("click", () =>
    new CardDetailModal(ctx, card, cardRef).open(),
  );

  return el;
}

/** Modal showing a card's detail; editable when an EditContext is present (FR-004/FR-017). */
class CardDetailModal extends Modal {
  constructor(
    private ctx: CardContext,
    private card: Card,
    private ref?: CardRef,
  ) {
    super(ctx.app);
  }

  onOpen(): void {
    this.renderView();
  }

  /** Read view: rendered title + body, with an Edit affordance when editable. */
  private renderView(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(this.card.title);

    const body = this.card.body.trim();
    if (body.length > 0) {
      void MarkdownRenderer.render(
        this.ctx.app,
        body,
        contentEl,
        this.ctx.sourcePath,
        this.ctx.component,
      );
    } else {
      contentEl.createEl("p", {
        cls: "usm-card-empty",
        text: "No details yet.",
      });
    }

    if (this.ctx.edit && this.ref) {
      const actions = contentEl.createDiv({ cls: "usm-modal-actions" });
      const edit = actions.createEl("button", { text: "Edit" });
      edit.addEventListener("click", () => this.renderEdit());
    }
  }

  /** Edit view: title input + body textarea with Save / Cancel (FR-004). */
  private renderEdit(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText("Edit card");

    const titleInput = contentEl.createEl("input", { cls: "usm-edit-input" });
    titleInput.type = "text";
    titleInput.value = this.card.title;
    titleInput.placeholder = "Card title";

    const bodyInput = contentEl.createEl("textarea", {
      cls: "usm-edit-textarea",
    });
    bodyInput.value = this.card.body;
    bodyInput.placeholder = "Card details (Markdown)";

    const actions = contentEl.createDiv({ cls: "usm-modal-actions" });
    const save = actions.createEl("button", { cls: "mod-cta", text: "Save" });
    const cancel = actions.createEl("button", { text: "Cancel" });

    save.addEventListener("click", () => {
      const ref = this.ref!;
      const title = titleInput.value;
      const bodyValue = bodyInput.value;
      this.ctx.edit!.apply((m) => editCard(m, ref, { title, body: bodyValue }));
      this.close();
    });
    cancel.addEventListener("click", () => this.renderView());

    titleInput.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
