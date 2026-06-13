/*
 * Plugin entry (US1 / FR-011, plan.md, Constitution V).
 *
 * - Registers the StoryMapView for the custom view type.
 * - Detects story-map files (frontmatter `story-map: true`) and opens them as a
 *   board, mirroring the Obsidian Kanban pattern.
 * - Offers a "Toggle Markdown / board view" command and file-menu item so users
 *   can switch a file between the raw editor and the board.
 * - Releases all resources on unload (no leaked views/listeners).
 */

import {
  MarkdownView,
  Plugin,
  TFile,
  WorkspaceLeaf,
  Menu,
} from "obsidian";
import { StoryMapView, VIEW_TYPE_STORY_MAP } from "./view/StoryMapView";

export default class StoryMapPlugin extends Plugin {
  /** Guards re-entrant auto-switching while a leaf's view state is changing. */
  private switching = new Set<string>();

  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_STORY_MAP,
      (leaf) => new StoryMapView(leaf),
    );

    this.addCommand({
      id: "toggle-story-map-view",
      name: "Toggle Markdown / board view",
      checkCallback: (checking) => {
        const leaf = this.app.workspace.activeLeaf;
        const type = leaf?.getViewState().type;
        const can = type === "markdown" || type === VIEW_TYPE_STORY_MAP;
        if (can && !checking && leaf) void this.toggleView(leaf);
        return can;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        if (!this.hasMarker(file)) return;
        menu.addItem((item) =>
          item
            .setTitle("Open as story map board")
            .setIcon("layout-grid")
            .onClick(() => void this.openAsBoard(file)),
        );
      }),
    );

    // Auto-open story-map files as a board when their markdown view loads.
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        if (!this.hasMarker(file)) return;
        const leaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
        if (leaf) void this.setViewType(leaf, VIEW_TYPE_STORY_MAP);
      }),
    );
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_STORY_MAP);
  }

  /** True when the file's cached frontmatter carries `story-map: true`. */
  private hasMarker(file: TFile): boolean {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return fm?.["story-map"] === true;
  }

  private async openAsBoard(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    await this.setViewType(leaf, VIEW_TYPE_STORY_MAP);
  }

  private async toggleView(leaf: WorkspaceLeaf): Promise<void> {
    const current = leaf.getViewState().type;
    const next =
      current === VIEW_TYPE_STORY_MAP ? "markdown" : VIEW_TYPE_STORY_MAP;
    await this.setViewType(leaf, next);
  }

  /** Switch a leaf to `type` while preserving its file state; guarded vs loops. */
  private async setViewType(leaf: WorkspaceLeaf, type: string): Promise<void> {
    const state = leaf.getViewState();
    if (state.type === type) return;

    const key = (state.state?.file as string | undefined) ?? "";
    if (this.switching.has(key)) return;
    this.switching.add(key);
    try {
      await leaf.setViewState({ ...state, type, active: true });
    } finally {
      this.switching.delete(key);
    }
  }
}
