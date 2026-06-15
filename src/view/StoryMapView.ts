/*
 * StoryMapView (US1 / FR-011/FR-013).
 *
 * A TextFileView subclass: the Markdown file is the source of truth. On load
 * (and on any external modification) Obsidian calls `setViewData`, where we
 * re-`parse` into a fresh model and re-render — so we never write a stale
 * in-memory model over newer on-disk content. `getViewData` serializes the
 * working model back to Markdown on save. Editing/saving mutations arrive in
 * later phases and only then call `requestSave()`.
 */

import { TextFileView, WorkspaceLeaf } from "obsidian";
import type StoryMapPlugin from "../main";
import { StoryMap } from "../core/model";
import { parse } from "../core/parser";
import { serialize } from "../core/serializer";
import { renderBoard } from "./board";
import {
  EditContext,
  DraftFocus,
  ResizeController,
  CARD_WIDTH_DEFAULT,
  clampCardWidth,
} from "./interactions";

export const VIEW_TYPE_STORY_MAP = "user-story-map-view";

export class StoryMapView extends TextFileView {
  /** Working model; null until the first `setViewData`. */
  map: StoryMap | null = null;

  /**
   * Shared card/column width — session-only view state, never persisted (FR-024).
   * Reset to the default on every `setViewData` (reopen / external load).
   */
  private cardWidth = CARD_WIDTH_DEFAULT;

  /**
   * Shared story-card height — session-only (FR-024). `cardHeight` is the height
   * currently applied to every card; it is the max of the 3-row minimum
   * (`cardHeightMin`, derived from theme metrics), any manual floor the user
   * dragged to (`userCardHeight`), and the tallest card's content — so all cards
   * stay uniform and text never clips. Reset on `setViewData`.
   */
  private cardHeight = 0;
  private userCardHeight: number | null = null;
  private cardHeightMin = 24;
  private cardHeightMax = 600;

  /**
   * A not-yet-named node to open in the focused inline editor on the next render
   * (create-into-edit, FR-001). Consumed and cleared by `render`.
   */
  private pendingDraft: DraftFocus | null = null;

  /**
   * Edit entry point handed to the board (US2): a user-initiated mutation
   * applies a pure core helper, persists, and re-renders. Only `apply` calls
   * `requestSave()` — never external loads, and never a draft (FR-002/FR-013).
   */
  private editCtx: EditContext = {
    app: this.app,
    apply: (mutate) => {
      if (!this.map) return;
      this.map = mutate(this.map);
      this.requestSave();
      this.render();
    },
    applyTransient: (mutate) => {
      if (!this.map) return;
      this.map = mutate(this.map);
      this.render();
    },
    createDraft: (mutate, focus) => {
      if (!this.map) return;
      this.map = mutate(this.map);
      this.pendingDraft = focus;
      this.render();
    },
  };

  /** Shared-width controller for the board's resize handles (US3, FR-022/FR-024). */
  private widthController: ResizeController = {
    get: (): number => this.cardWidth,
    set: (px: number): void => {
      this.cardWidth = clampCardWidth(px);
      // Update the live CSS variable only — no model mutation, no save, no
      // re-render — so dragging stays smooth on large maps.
      this.contentEl.style.setProperty(
        "--usm-card-width",
        `${this.cardWidth}px`,
      );
    },
  };

  /** Shared-height controller. During a drag `set` updates the live variable
   *  cheaply (no measuring), clamped to 1–10 rows; `end` re-fits to the default
   *  baseline + tallest content. */
  private heightController: ResizeController = {
    get: (): number => this.cardHeight || this.cardHeightMin,
    set: (px: number): void => {
      this.userCardHeight = Math.max(
        this.cardHeightMin,
        Math.min(this.cardHeightMax, Math.round(px)),
      );
      this.cardHeight = this.userCardHeight;
      this.contentEl.style.setProperty(
        "--usm-card-height",
        `${this.cardHeight}px`,
      );
    },
    end: (): void => this.applyCardHeight(),
  };

  /**
   * Compute and apply the shared card height (FR-024). Derives row-based bounds
   * from a real card's theme metrics — minimum 1 row, default 3 rows, manual-
   * resize maximum 10 rows — sets the user's height (or the 3-row default) as a
   * baseline, then grows the shared height to the tallest card so every card is
   * uniform and no text clips. Pure view state — never saved.
   */
  private applyCardHeight(): void {
    const cards = Array.from(
      this.contentEl.querySelectorAll<HTMLElement>(".card"),
    );
    if (cards.length === 0) return;

    const cs = getComputedStyle(cards[0]);
    const lh = parseFloat(cs.lineHeight);
    const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const bordV =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const lineH = Number.isFinite(lh) ? lh : 17;
    const chrome =
      (Number.isFinite(padV) ? padV : 14) +
      (Number.isFinite(bordV) ? bordV : 2);
    const rowHeight = (rows: number): number => Math.ceil(rows * lineH + chrome);
    this.cardHeightMin = rowHeight(1);
    this.cardHeightMax = rowHeight(10);

    // Short cards sit at the baseline (the user's height, else the 3-row
    // default); taller content (wrapped text) pushes past it, and that max
    // becomes the shared height for all cards.
    const baseline = this.userCardHeight ?? rowHeight(3);
    this.contentEl.style.setProperty("--usm-card-height", `${baseline}px`);
    let maxH = baseline;
    for (const c of cards) maxH = Math.max(maxH, c.offsetHeight);
    this.cardHeight = maxH;
    this.contentEl.style.setProperty("--usm-card-height", `${maxH}px`);
  }

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: StoryMapPlugin,
  ) {
    super(leaf);
    // Discoverable toggle from the board side (FR-023): a header action that
    // drops back to the raw Markdown editor for this file.
    this.addAction("file-text", "Open as Markdown", () =>
      void this.plugin.setMarkdownView(this.leaf),
    );
  }

  getViewType(): string {
    return VIEW_TYPE_STORY_MAP;
  }

  getDisplayText(): string {
    return this.file ? this.file.basename : "Story map";
  }

  getIcon(): string {
    return "layout-grid";
  }

  /** Serialize the working model back to Markdown (round-trip safe). */
  getViewData(): string {
    return this.map ? serialize(this.map) : this.data;
  }

  /** Load / external-change entry point: always re-parse fresh and re-render. */
  setViewData(data: string, _clear: boolean): void {
    this.data = data;
    this.map = parse(data);
    // A fresh load resets view-only state: drop any unsaved draft and restore
    // the default width (FR-024) so width never persists across reopen.
    this.pendingDraft = null;
    this.cardWidth = CARD_WIDTH_DEFAULT;
    this.userCardHeight = null;
    this.cardHeight = 0;
    this.render();
  }

  clear(): void {
    this.map = null;
    this.pendingDraft = null;
    this.contentEl.empty();
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("usm-view");
    container.style.setProperty("--usm-card-width", `${this.cardWidth}px`);
    if (!this.map) return;
    // The draft is consumed by this render; clear it so later renders don't
    // re-open the editor.
    const draft = this.pendingDraft ?? undefined;
    this.pendingDraft = null;
    renderBoard(container, this.map, {
      app: this.app,
      component: this,
      sourcePath: this.file ? this.file.path : "",
      edit: this.editCtx,
      draft,
      width: this.widthController,
      height: this.heightController,
    });
    // Equalize card heights to the tallest after the board is in the DOM, so a
    // wrapped-text card grows every card together (uniform, FR-024).
    this.applyCardHeight();
  }
}
