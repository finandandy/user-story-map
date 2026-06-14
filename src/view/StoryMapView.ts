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
import { EditContext } from "./interactions";

export const VIEW_TYPE_STORY_MAP = "user-story-map-view";

export class StoryMapView extends TextFileView {
  /** Working model; null until the first `setViewData`. */
  map: StoryMap | null = null;

  /**
   * Edit entry point handed to the board (US2): a user-initiated mutation
   * applies a pure core helper, persists, and re-renders. Only here do we call
   * `requestSave()` — never on external loads (FR-013).
   */
  private editCtx: EditContext = {
    app: this.app,
    apply: (mutate) => {
      if (!this.map) return;
      this.map = mutate(this.map);
      this.requestSave();
      this.render();
    },
  };

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
    this.render();
  }

  clear(): void {
    this.map = null;
    this.contentEl.empty();
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("usm-view");
    if (!this.map) return;
    renderBoard(container, this.map, {
      app: this.app,
      component: this,
      sourcePath: this.file ? this.file.path : "",
      edit: this.editCtx,
    });
  }
}
