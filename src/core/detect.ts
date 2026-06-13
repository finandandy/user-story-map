/*
 * Story-map detection (contracts/core-api.md §isStoryMap, markdown-format.md §5).
 *
 * A file is a story map when its YAML frontmatter contains `story-map: true`.
 * Pure string check — no `obsidian`, no I/O.
 */

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const MARKER = /(^|\n)[ \t]*story-map[ \t]*:[ \t]*true[ \t]*(\r?\n|$)/;

export function isStoryMap(markdown: string): boolean {
  const fm = markdown.match(FRONTMATTER);
  if (!fm) return false;
  return MARKER.test(fm[1]);
}
