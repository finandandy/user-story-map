/*
 * Plugin entry (US1 / FR-011/FR-023, plan.md, Constitution V).
 *
 * - Registers the StoryMapView for the custom view type.
 * - Auto-opens story-map files (frontmatter `story-map: true`) as a board by
 *   patching `WorkspaceLeaf.setViewState`: any attempt to open a marked file as
 *   Markdown is rewritten to the board view. This is the robust pattern the
 *   Obsidian Kanban plugin uses — it covers clicks, link navigation, and
 *   workspace restore, where the `file-open` event alone is racy.
 * - A per-leaf mode map (`fileModes`) lets an explicit "Open as Markdown" toggle
 *   stick instead of being immediately re-rewritten back to the board.
 * - Offers a "Toggle Markdown / board view" command, a file-menu item, and a
 *   board header action so the switch is discoverable from both sides (FR-023).
 * - Releases all resources on unload (patch restored, views detached).
 */

import {
  MarkdownView,
  Plugin,
  TFile,
  ViewState,
  WorkspaceLeaf,
  Menu,
} from "obsidian";
import { StoryMapView, VIEW_TYPE_STORY_MAP } from "./view/StoryMapView";
import { createEmptyMap } from "./core/model";
import { serialize } from "./core/serializer";
import {
  DEFAULT_SETTINGS,
  StoryMapSettings,
  StoryMapSettingTab,
} from "./settings";

/** Sentinel stored in `fileModes` when the user explicitly chose raw Markdown. */
const MARKDOWN = "markdown";

export default class StoryMapPlugin extends Plugin {
  /** Persisted view preferences (never map content). */
  settings: StoryMapSettings = DEFAULT_SETTINGS;

  /**
   * Per-leaf desired view type, keyed by leaf id. When a user toggles a marked
   * file to Markdown we record `MARKDOWN` here so the setViewState patch does
   * not immediately switch it back to the board. A freshly opened file uses a
   * new leaf id (absent here) and therefore auto-opens as a board again.
   */
  private fileModes: Record<string, string> = {};

  /** Tracks the "Open as story map board" header action added to a Markdown leaf. */
  private markdownActions = new WeakMap<WorkspaceLeaf, HTMLElement>();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_STORY_MAP,
      (leaf) => new StoryMapView(leaf, this),
    );

    this.addSettingTab(new StoryMapSettingTab(this.app, this));

    // Auto-open marked files as a board (covers clicks, links, restore).
    this.registerMonkeyPatch();

    this.addCommand({
      id: "create-story-map",
      name: "Create story map",
      callback: () => void this.createStoryMap(),
    });

    this.addCommand({
      id: "toggle-story-map-view",
      name: "Toggle Markdown / board view",
      checkCallback: (checking) => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        const type = leaf?.getViewState().type;
        const can = type === MARKDOWN || type === VIEW_TYPE_STORY_MAP;
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

    // Give the raw-Markdown view of a marked file a one-click button back to the
    // board (the mirror of the board's "Open as Markdown" action), kept in sync
    // so it never lingers on a non-map note.
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) =>
        this.syncMarkdownAction(leaf),
      ),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () =>
        this.syncMarkdownAction(this.app.workspace.getMostRecentLeaf()),
      ),
    );
    this.app.workspace.onLayoutReady(() =>
      this.syncMarkdownAction(this.app.workspace.getMostRecentLeaf()),
    );
  }

  /**
   * Ensure a Markdown leaf showing a marked file carries a header action to
   * switch to the board, and that the action is removed once the leaf no longer
   * shows a story map (file changed or view switched).
   */
  private syncMarkdownAction(leaf: WorkspaceLeaf | null): void {
    if (!leaf) return;
    const view = leaf.view;
    const existing = this.markdownActions.get(leaf);
    const isMarkedMarkdown =
      view instanceof MarkdownView &&
      !!view.file &&
      this.hasMarker(view.file);

    if (isMarkedMarkdown && !existing) {
      const action = view.addAction(
        "layout-grid",
        "Open as story map board",
        () => void this.setBoardView(leaf),
      );
      this.markdownActions.set(leaf, action);
    } else if (!isMarkedMarkdown && existing) {
      existing.remove();
      this.markdownActions.delete(leaf);
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_STORY_MAP);
  }

  /** Load persisted view preferences, falling back to defaults for any gaps. */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Patch `WorkspaceLeaf.prototype.setViewState` so opening a marked file as
   * Markdown is transparently upgraded to the board view. Restored on unload.
   */
  private registerMonkeyPatch(): void {
    const self = this;
    const proto = WorkspaceLeaf.prototype as unknown as {
      setViewState: (state: ViewState, ...rest: unknown[]) => unknown;
    };
    const original = proto.setViewState;

    proto.setViewState = function (
      this: WorkspaceLeaf,
      state: ViewState,
      ...rest: unknown[]
    ) {
      const path = state?.state?.file as string | undefined;
      const leafId = (this as unknown as { id?: string }).id ?? path ?? "";
      if (
        self.settings.autoOpenAsBoard &&
        state?.type === MARKDOWN &&
        path &&
        self.fileModes[leafId] !== MARKDOWN
      ) {
        const file = self.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile && self.hasMarker(file)) {
          self.fileModes[leafId] = VIEW_TYPE_STORY_MAP;
          return original.apply(this, [
            { ...state, type: VIEW_TYPE_STORY_MAP },
            ...rest,
          ]);
        }
      }
      return original.apply(this, [state, ...rest]);
    };

    this.register(() => {
      proto.setViewState = original;
    });
  }

  /** True when the file's cached frontmatter carries `story-map: true`. */
  private hasMarker(file: TFile): boolean {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return fm?.["story-map"] === true;
  }

  private async openAsBoard(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    await this.setBoardView(leaf);
  }

  /**
   * Create a new story-map file (marker skeleton via `createEmptyMap`) and open
   * it as a board, ready to build from empty (FR-011).
   */
  private async createStoryMap(): Promise<void> {
    const path = this.uniquePath("Untitled story map");
    const file = await this.app.vault.create(path, serialize(createEmptyMap()));
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    await this.setBoardView(leaf);
  }

  /** First non-colliding `<base>.md` (then `<base> 2.md`, …) in the vault root. */
  private uniquePath(base: string): string {
    let candidate = `${base}.md`;
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = `${base} ${n}.md`;
      n++;
    }
    return candidate;
  }

  /** Flip a leaf between the board and the raw Markdown editor (FR-023). */
  async toggleView(leaf: WorkspaceLeaf): Promise<void> {
    const current = leaf.getViewState().type;
    if (current === VIEW_TYPE_STORY_MAP) {
      await this.setMarkdownView(leaf);
    } else {
      await this.setBoardView(leaf);
    }
  }

  /** Switch a leaf to the board view and remember that choice for this leaf. */
  async setBoardView(leaf: WorkspaceLeaf): Promise<void> {
    const leafId = (leaf as unknown as { id?: string }).id ?? "";
    this.fileModes[leafId] = VIEW_TYPE_STORY_MAP;
    const state = leaf.getViewState();
    await leaf.setViewState({ ...state, type: VIEW_TYPE_STORY_MAP, active: true });
  }

  /**
   * Switch a leaf to the raw Markdown editor. Records `MARKDOWN` for this leaf
   * so the auto-open patch leaves it alone instead of reverting to the board.
   */
  async setMarkdownView(leaf: WorkspaceLeaf): Promise<void> {
    const leafId = (leaf as unknown as { id?: string }).id ?? "";
    this.fileModes[leafId] = MARKDOWN;
    const state = leaf.getViewState();
    await leaf.setViewState(
      { ...state, type: MARKDOWN, active: true },
      { focus: true },
    );
  }
}
