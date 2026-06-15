/*
 * Markdown -> StoryMap (contracts/core-api.md §parse, markdown-format.md §5).
 *
 * Guarantees: never throws; malformed input becomes diagnostics (FR-012).
 * Captures frontmatter / preamble / trailing and card bodies verbatim (FR-005);
 * resolves cards to releases by name; assigns `order` from document order;
 * strips auto-number prefixes so stored titles are clean identities (FR-020).
 *
 * Pure — imports nothing from `obsidian`.
 */

import {
  StoryMap,
  Release,
  Activity,
  ActivityIcon,
  Card,
  Diagnostic,
  isLikelyUnsafeSvg,
} from "./model";
import {
  stripActivityNumber,
  stripReleaseNumber,
  stripCardNumber,
} from "./numbering";

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

export function parse(markdown: string): StoryMap {
  const diagnostics: Diagnostic[] = [];

  // 1. Frontmatter (preserved verbatim, including delimiters + trailing NL).
  let frontmatter = "";
  let pos = 0;
  const fm = markdown.match(FRONTMATTER);
  if (fm) {
    frontmatter = fm[0];
    pos = frontmatter.length;
  }

  // 2. Managed sections. Without `# Releases` the file is an empty/markerless
  //    map; the remainder is preserved as preamble (FR-011).
  const releasesIdx = findHeadingLine(markdown, pos, "# Releases");
  if (releasesIdx === -1) {
    return {
      releases: [],
      activities: [],
      frontmatter,
      preamble: markdown.slice(pos),
      trailing: "",
      diagnostics,
    };
  }

  const preamble = markdown.slice(pos, releasesIdx);
  const activitiesIdx = findHeadingLine(markdown, releasesIdx, "# Activities");

  const releasesEnd =
    activitiesIdx === -1 ? findTrailing(markdown, releasesIdx) : activitiesIdx;
  const releases = parseReleases(
    markdown.slice(releasesIdx, releasesEnd),
    diagnostics,
  );

  let activities: Activity[] = [];
  let trailing: string;
  if (activitiesIdx === -1) {
    trailing = markdown.slice(releasesEnd);
  } else {
    const trailingIdx = findTrailing(markdown, activitiesIdx);
    activities = parseActivities(
      markdown.slice(activitiesIdx, trailingIdx),
      releases,
      diagnostics,
    );
    trailing = markdown.slice(trailingIdx);
  }

  return { releases, activities, frontmatter, preamble, trailing, diagnostics };
}

// --- Section location -------------------------------------------------------

/** Index of the start of a top-level heading line (`# Releases` / `# Activities`). */
function findHeadingLine(md: string, from: number, heading: string): number {
  const slice = md.slice(from);
  const re = new RegExp(`(^|\\n)${escapeRegExp(heading)}[ \\t]*(\\n|$)`);
  const m = slice.match(re);
  if (!m || m.index === undefined) return -1;
  return from + m.index + (m[1] ? m[1].length : 0);
}

/**
 * Start of the trailing (unmanaged) region following a managed `# ` section:
 * the next top-level `# ` heading after `headingStart`, else end of file.
 */
function findTrailing(md: string, headingStart: number): number {
  const lineEnd = md.indexOf("\n", headingStart);
  const from = lineEnd === -1 ? md.length : lineEnd + 1;
  const next = md.indexOf("\n# ", from);
  return next === -1 ? md.length : next + 1;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Releases ---------------------------------------------------------------

const RELEASE_LINE = /^\s*\d+\.\s+(.*\S)\s*$/;

function parseReleases(text: string, diagnostics: Diagnostic[]): Release[] {
  const releases: Release[] = [];
  const seen = new Set<string>();
  let order = 0;

  for (const line of text.split("\n")) {
    const m = line.match(RELEASE_LINE);
    if (!m) continue;
    const rest = m[1];
    const sep = rest.indexOf(" - ");
    const title = (sep >= 0 ? rest.slice(0, sep) : rest).trim();
    const subtitle = sep >= 0 ? rest.slice(sep + 3).trim() : null;

    if (seen.has(title)) {
      diagnostics.push({
        severity: "warning",
        message: `Duplicate release title: "${title}"`,
        line: null,
      });
    }
    seen.add(title);
    releases.push({ title, subtitle, order: order++ });
  }

  return releases;
}

// --- Activities -------------------------------------------------------------

function parseActivities(
  text: string,
  releases: Release[],
  diagnostics: Diagnostic[],
): Activity[] {
  const declared = new Set(releases.map((r) => r.title));
  const activities: Activity[] = [];
  const lines = text.split("\n");

  let activity: Activity | null = null;
  let releaseKey: string | null = null;
  let activityOrder = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^# Activities\s*$/.test(line)) {
      i++;
      continue;
    }

    const h2 = line.match(/^## (.*)$/);
    if (h2) {
      activity = {
        title: stripActivityNumber(h2[1].trim()),
        order: activityOrder++,
        cells: new Map<string, Card[]>(),
        body: "",
        icon: null,
      };
      activities.push(activity);
      releaseKey = null;
      i++;
      // Capture the activity body verbatim up to the first ###/next heading,
      // then strip a leading `icon:` field into `Activity.icon` (markdown §8).
      const bodyLines: string[] = [];
      while (i < lines.length && !/^#{1,4} /.test(lines[i])) {
        bodyLines.push(lines[i]);
        i++;
      }
      const { icon, body } = extractActivityIcon(bodyLines);
      activity.icon = icon;
      activity.body = body;
      continue;
    }

    const h3 = line.match(/^### (.*)$/);
    if (h3) {
      const title = stripReleaseNumber(h3[1].trim());
      if (!activity) {
        diagnostics.push({
          severity: "warning",
          message: `Release group "${title}" appears before any activity`,
          line: null,
        });
        i++;
        continue;
      }
      if (!declared.has(title)) {
        diagnostics.push({
          severity: "warning",
          message: `Release group references an undeclared release: "${title}"`,
          line: null,
        });
      }
      releaseKey = title;
      if (!activity.cells.has(title)) activity.cells.set(title, []);
      i++;
      continue;
    }

    const h4 = line.match(/^#### (.*)$/);
    if (h4) {
      const title = stripCardNumber(h4[1].trim());
      if (!activity || releaseKey === null) {
        diagnostics.push({
          severity: "warning",
          message: `Card "${title}" appears outside a release group`,
          line: null,
        });
        i++;
        continue;
      }
      // Capture body verbatim up to the next heading of level <= 4.
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && !/^#{1,4} /.test(lines[i])) {
        bodyLines.push(lines[i]);
        i++;
      }
      const cell = activity.cells.get(releaseKey)!;
      cell.push({
        title,
        body: bodyLines.join("\n").trim(),
        order: cell.length,
        activityTitle: activity.title,
        releaseTitle: releaseKey,
      });
      continue;
    }

    i++;
  }

  return activities;
}

const ICON_LINE = /^icon:\s*(.+?)\s*$/;

/**
 * Split captured activity-body lines into an optional leading `icon:` field and
 * the remaining verbatim body (markdown-format §8.5). The icon line is only
 * recognized as the FIRST non-blank line; a value starting with `<` is a custom
 * SVG (kept ONLY if it passes the pure unsafe-SVG guard — else `icon: null` and
 * the line stays in the body, F18/F19), otherwise a Lucide name. The body is
 * trimmed like card bodies so the canonical serializer round-trips it.
 */
function extractActivityIcon(bodyLines: string[]): {
  icon: ActivityIcon | null;
  body: string;
} {
  const firstNonBlank = bodyLines.findIndex((l) => l.trim().length > 0);
  if (firstNonBlank !== -1) {
    const m = bodyLines[firstNonBlank].match(ICON_LINE);
    if (m) {
      const value = m[1];
      const icon: ActivityIcon | null = value.startsWith("<")
        ? isLikelyUnsafeSvg(value)
          ? null
          : { type: "custom-svg", svg: value }
        : { type: "lucide", name: value };
      if (icon) {
        const rest = bodyLines.slice();
        rest.splice(firstNonBlank, 1);
        return { icon, body: rest.join("\n").trim() };
      }
    }
  }
  return { icon: null, body: bodyLines.join("\n").trim() };
}
