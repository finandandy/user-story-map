/*
 * StoryMap -> Markdown (contracts/core-api.md §serialize, markdown-format.md §4).
 *
 * Round-trip guarantee: serialize(parse(x)) === x for conformant input
 * (FR-006/FR-022). Preserved segments (frontmatter/preamble/trailing) and
 * untouched card bodies are reproduced exactly (FR-005); auto-number prefixes
 * are WRITTEN from position on every serialize (FR-019/FR-021).
 *
 * Canonical shape: blocks separated by a single blank line, ending with one
 * trailing newline after the last managed block (markdown-format.md §1).
 *
 * Pure — imports nothing from `obsidian`.
 */

import { StoryMap, ActivityIcon } from "./model";
import {
  formatActivityNumber,
  formatReleaseNumber,
  formatCardNumber,
} from "./numbering";

/** A Lucide icon serializes to its name; a custom SVG to its (single-line) document. */
function formatActivityIcon(icon: ActivityIcon): string {
  return `icon: ${icon.type === "lucide" ? icon.name : icon.svg}`;
}

export function serialize(map: StoryMap): string {
  const blocks: string[] = [];

  // # Releases — re-number ordinals sequentially from 1 (display only).
  blocks.push("# Releases");
  if (map.releases.length > 0) {
    blocks.push(
      map.releases
        .map((r, idx) => {
          const sub = r.subtitle ? ` - ${r.subtitle}` : "";
          return `${idx + 1}. ${r.title}${sub}`;
        })
        .join("\n"),
    );
  }

  // # Activities — R{n} reflects GLOBAL release order (1-based).
  blocks.push("# Activities");
  const releaseOrder = new Map<string, number>();
  map.releases.forEach((r, idx) => releaseOrder.set(r.title, idx + 1));

  for (let a = 0; a < map.activities.length; a++) {
    const activity = map.activities[a];
    // The ## heading, an optional managed `icon:` line, and the preserved body
    // form one block (markdown-format §8.4); release groups follow as their own.
    let head = `## ${formatActivityNumber(a + 1)} ${activity.title}`;
    if (activity.icon) head += `\n\n${formatActivityIcon(activity.icon)}`;
    if (activity.body && activity.body.length > 0) {
      head += `\n\n${activity.body}`;
    }
    blocks.push(head);

    for (const releaseTitle of orderedGroups(map, activity)) {
      const cards = activity.cells.get(releaseTitle) ?? [];
      const rNum = releaseOrder.get(releaseTitle) ?? releaseOrder.size + 1;
      blocks.push(`### ${formatReleaseNumber(rNum)} ${releaseTitle}`);

      cards.forEach((card, ci) => {
        let block = `#### ${formatCardNumber(ci + 1)} ${card.title}`;
        if (card.body && card.body.length > 0) {
          block += `\n\n${card.body}`;
        }
        blocks.push(block);
      });
    }
  }

  const managed = blocks.join("\n\n") + "\n";
  return map.frontmatter + map.preamble + managed + map.trailing;
}

/**
 * Release groups an activity emits, in global release order first (matching the
 * declaration / R{n}), then any orphan groups (cells keyed by an undeclared
 * release) so malformed maps still round-trip their content (FR-012).
 */
function orderedGroups(map: StoryMap, activity: StoryMap["activities"][number]): string[] {
  const groups: string[] = [];
  const seen = new Set<string>();
  for (const r of map.releases) {
    if (activity.cells.has(r.title)) {
      groups.push(r.title);
      seen.add(r.title);
    }
  }
  for (const key of activity.cells.keys()) {
    if (!seen.has(key)) groups.push(key);
  }
  return groups;
}
