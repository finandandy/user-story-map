/*
 * Plugin settings (T035, plan.md "Storage" / Constitution II & V).
 *
 * View preferences ONLY — persisted via the plugin's `loadData`/`saveData`
 * (`data.json`). Map content never lives here; the Markdown file is the single
 * source of truth (Constitution I). v0.1 keeps the surface minimal: numbering
 * toggles and per-map overrides are deferred (plan.md), and destructive-action
 * confirmation is mandated by FR-008 so it is not user-disableable.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type StoryMapPlugin from "./main";

export interface StoryMapSettings {
  /**
   * Automatically open files marked `story-map: true` as a board when they are
   * opened. When false, such files open in the normal Markdown editor and the
   * user switches to the board via the view menu / "Toggle" command.
   */
  autoOpenAsBoard: boolean;
}

export const DEFAULT_SETTINGS: StoryMapSettings = {
  autoOpenAsBoard: true,
};

export class StoryMapSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: StoryMapPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Open story maps as a board")
      .setDesc(
        "Automatically render files marked `story-map: true` as a board. " +
          "When off, they open as Markdown and you switch via the view menu.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoOpenAsBoard)
          .onChange(async (value) => {
            this.plugin.settings.autoOpenAsBoard = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
