/*
 * Card element (US1 / FR-010/FR-017).
 *
 * Titles (and bodies) are rendered via Obsidian's MarkdownRenderer so internal
 * links render and stay navigable. Clicking a card opens its body detail.
 */

import { App, Component, MarkdownRenderer, Modal } from "obsidian";
import { Card } from "../core/model";
import { formatCardNumber } from "../core/numbering";

export interface CardContext {
  app: App;
  /** Lifecycle owner for rendered markdown children (the view). */
  component: Component;
  /** Source path used to resolve relative internal links. */
  sourcePath: string;
}

/** Render a single card into a cell. `index` is 0-based within its cell. */
export function renderCard(
  cell: HTMLElement,
  card: Card,
  index: number,
  ctx: CardContext,
): HTMLElement {
  const el = cell.createDiv({ cls: "card" });

  el.createSpan({ cls: "usm-card-num", text: formatCardNumber(index + 1) });

  const titleEl = el.createSpan({ cls: "usm-card-title" });
  // MarkdownRenderer wraps inline content in a <p>; keep the card compact.
  void MarkdownRenderer.render(ctx.app, card.title, titleEl, ctx.sourcePath, ctx.component);

  el.addEventListener("click", () => new CardDetailModal(ctx, card).open());

  return el;
}

/** Modal showing a card's title and body detail (FR-017). */
class CardDetailModal extends Modal {
  constructor(
    private ctx: CardContext,
    private card: Card,
  ) {
    super(ctx.app);
  }

  onOpen(): void {
    this.titleEl.setText(this.card.title);
    const body = this.card.body.trim();
    if (body.length > 0) {
      void MarkdownRenderer.render(
        this.ctx.app,
        body,
        this.contentEl,
        this.ctx.sourcePath,
        this.ctx.component,
      );
    } else {
      this.contentEl.createEl("p", {
        cls: "usm-card-empty",
        text: "No details yet.",
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
